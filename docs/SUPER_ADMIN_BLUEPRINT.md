# Super Admin System Blueprint

## Overview

เอกสารนี้เป็น Blueprint สำหรับสร้างระบบ Super Admin Panel ที่ใช้จัดการ Multi-tenant SaaS Platform สามารถนำไปประยุกต์ใช้กับระบบอื่นๆ ได้

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Super Admin Panel                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Dashboard  │  │   Tenants   │  │    Plans    │  │Settings │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     Super Admin API Layer                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Tenant    │  │Subscription │  │     Platform Stats      │  │
│  │  Service    │  │   Service   │  │        Service          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                         Database Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ SuperAdmin  │  │   Tenant    │  │    Plan     │              │
│  │   Table     │  │   Table     │  │   Table     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Authentication Flow

```
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│  Login   │────▶│ Verify Creds │────▶│ Generate    │
│  Page    │     │              │     │ JWT Token   │
└──────────┘     └──────────────┘     └──────┬──────┘
                                              │
                                              ▼
┌──────────┐     ┌──────────────┐     ┌─────────────┐
│Protected │◀────│   Validate   │◀────│Store Token  │
│  Routes  │     │    Token     │     │localStorage │
└──────────┘     └──────────────┘     └─────────────┘
```

**Token Strategy:**
- Super Admin ใช้ `superadmin_token` แยกจาก regular user `token`
- Token มี role: `SUPERADMIN` เพื่อ authorize
- Token expiry: 24 hours (configurable)

---

## 2. Database Schema

### 2.1 SuperAdmin Table

```prisma
model SuperAdmin {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2.2 Plan Table (Subscription Plans)

```prisma
model Plan {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  description   String?
  priceMonthly  Float    @default(0)
  priceYearly   Float    @default(0)
  maxResources  Int      @default(100)    // -1 = unlimited (ปรับตามระบบ)
  maxUsers      Int      @default(5)      // -1 = unlimited
  features      Json     @default("[]")   // Array of feature strings
  isActive      Boolean  @default(true)
  displayOrder  Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscriptions Subscription[]
}
```

### 2.3 Tenant Table

```prisma
model Tenant {
  id        String       @id @default(cuid())
  name      String
  slug      String       @unique
  status    TenantStatus @default(active)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  users        User[]
  subscription Subscription?
  // ... other tenant-related tables
}

enum TenantStatus {
  active
  suspended
  cancelled
}
```

### 2.4 Subscription Table

```prisma
model Subscription {
  id               String             @id @default(cuid())
  tenantId         String             @unique
  planId           String
  status           SubscriptionStatus @default(active)
  currentPeriodEnd DateTime
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id])
  plan   Plan   @relation(fields: [planId], references: [id])
}

enum SubscriptionStatus {
  active
  trialing
  past_due
  cancelled
}
```

---

## 3. API Specification

### 3.1 Authentication APIs

#### POST /api/superadmin/login
```typescript
// Request
{
  email: string;
  password: string;
}

// Response
{
  success: true,
  data: {
    token: string;
    user: {
      id: string;
      email: string;
    }
  }
}
```

#### GET /api/superadmin/me
```typescript
// Headers: Authorization: Bearer <token>

// Response
{
  success: true,
  data: {
    id: string;
    email: string;
  }
}
```

### 3.2 Statistics API

#### GET /api/superadmin/stats
```typescript
// Response
{
  success: true,
  data: {
    tenants: {
      total: number;
      active: number;
      pending: number;
    };
    users: {
      total: number;
    };
    resources: {
      total: number;
      active: number;
    };
    planStats: Array<{
      planName: string;
      count: number;
    }>;
  }
}
```

### 3.3 Tenant Management APIs

#### GET /api/superadmin/tenants
```typescript
// Query params: ?search=&status=&page=&limit=

// Response
{
  success: true,
  data: Array<{
    id: string;
    name: string;
    slug: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING';
    createdAt: string;
    subscription?: {
      plan: { name: string };
      status: string;
    };
    _count: {
      users: number;
      resources: number;
    };
  }>
}
```

#### POST /api/superadmin/tenants
```typescript
// Request - Create new tenant with admin user
{
  tenantName: string;
  tenantSlug: string;
  tenantEmail: string;
  tenantPhone?: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
  adminFullName?: string;
  planId?: string;
  activateImmediately?: boolean;
}

// Response
{
  success: true,
  data: {
    tenant: Tenant;
    user: User;
  }
}
```

#### PUT /api/superadmin/tenants/:id/status
```typescript
// Request
{ status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' }

// Response
{ success: true, message: string }
```

#### DELETE /api/superadmin/tenants/:id
```typescript
// Deletes tenant and ALL related data
// Response
{ success: true, message: string }
```

#### POST /api/superadmin/tenants/:id/impersonate
```typescript
// Request - Login as tenant user
{
  userId?: string;  // Optional, defaults to first admin
}

// Response
{
  success: true,
  data: {
    token: string;
    user: User;
    tenant: Tenant;
  }
}
```

### 3.4 Plan Management APIs

#### GET /api/superadmin/plans
```typescript
// Response
{
  success: true,
  data: Array<Plan>
}
```

#### POST /api/superadmin/plans
```typescript
// Request
{
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  maxResources: number;
  maxUsers: number;
  features: string[];
  isActive: boolean;
  displayOrder: number;
}
```

---

## 4. Frontend Architecture

### 4.1 Directory Structure

```
src/
├── layouts/
│   ├── SuperAdminLayout.tsx
│   └── SuperAdminLayout.scss
│
├── components/superadmin/
│   ├── PageHeader.tsx
│   ├── StatsCard.tsx
│   ├── DataTable.tsx
│   ├── ContentCard.tsx
│   └── index.ts
│
├── pages/superadmin/
│   ├── SuperAdminLoginPage.tsx
│   ├── SuperAdminDashboard.tsx
│   ├── TenantsPage.tsx
│   ├── PlansPage.tsx
│   ├── SettingsPage.tsx
│   └── index.ts
│
├── stores/
│   └── superadminStore.ts
│
└── services/
    └── api.ts
```

### 4.2 State Management (Zustand)

```typescript
interface SuperAdminState {
  superAdmin: SuperAdmin | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}
```

---

## 5. Styling Guidelines

### 5.1 Color Palette

```scss
// Dark theme colors
$gray-700: #334155;
$gray-800: #1e293b;
$gray-900: #0f172a;

// Accent colors
$primary: #2563eb;
$success: #22c55e;
$warning: #f59e0b;
$danger: #ef4444;
```

### 5.2 Layout Variables

```scss
$sidebar-width-open: 260px;
$sidebar-width-closed: 70px;
$header-height: 60px;
```

---

## 6. Security Considerations

- Password hashing: bcrypt with salt rounds 10+
- JWT with expiration
- Separate token namespace for super admin
- Audit logs for all super admin actions
- Rate limiting on login endpoints

---

## 7. Tenant Login Flow

### Multi-tenant Authentication

Tenant users must specify their organization code (tenant slug) during login:

```typescript
// Request
{
  tenantSlug: string;
  username: string;
  password: string;
}
```

This allows different organizations to have the same usernames without conflicts.

---

## 8. Deployment Checklist

### Environment Variables
```env
SUPERADMIN_JWT_SECRET=your-secret-key
SUPERADMIN_TOKEN_EXPIRY=24h
INITIAL_SUPERADMIN_EMAIL=admin@example.com
INITIAL_SUPERADMIN_PASSWORD=secure-password
```

### Production Checklist
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Configure backup strategy

---

*Document Version: 1.0*
*Last Updated: December 2024*
