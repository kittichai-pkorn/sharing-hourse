# Tech Stack Blueprint

เอกสารนี้รวบรวม Tech Stack ทั้งหมดที่ใช้ในโปรเจค พร้อมคำอธิบายและ Configuration สำหรับนำไปใช้เป็น Template ในโปรเจคใหม่

---

## Overview

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | 18.x |
| Backend | Node.js + Express | 20.x |
| Database | MySQL + Prisma | 8.x |
| State Management | Zustand | 4.x |
| Styling | SCSS | - |
| Build Tool | Vite | 5.x |

---

## 1. Frontend Stack

### 1.1 Core Framework

#### React + TypeScript
```bash
npm create vite@latest frontend -- --template react-ts
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 1.2 Routing

#### React Router DOM
```bash
npm install react-router-dom
```

**Usage:**
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 1.3 State Management

#### Zustand
```bash
npm install zustand
```

**Store Pattern:**
```tsx
// stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials) => {
    const response = await api.login(credentials);
    const { token, user } = response.data.data;
    localStorage.setItem('token', token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const response = await api.getMe();
      set({ user: response.data.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
```

### 1.4 HTTP Client

#### Axios
```bash
npm install axios
```

**API Configuration:**
```tsx
// services/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// API modules
export const authApi = {
  login: (data: LoginData) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};
```

### 1.5 Styling

#### SCSS
```bash
npm install -D sass
```

**Variables Pattern:**
```scss
// styles/_variables.scss

// Colors
$primary: #2563eb;
$primary-dark: #1d4ed8;
$primary-light: #3b82f6;

$secondary: #64748b;
$success: #22c55e;
$warning: #f59e0b;
$danger: #ef4444;
$info: #06b6d4;

$white: #ffffff;
$black: #000000;

// Gray scale
$gray-50: #f8fafc;
$gray-100: #f1f5f9;
$gray-200: #e2e8f0;
$gray-300: #cbd5e1;
$gray-400: #94a3b8;
$gray-500: #64748b;
$gray-600: #475569;
$gray-700: #334155;
$gray-750: #283548;
$gray-800: #1e293b;
$gray-850: #172033;
$gray-900: #0f172a;
$gray-950: #0a0f1a;

// Typography
$font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-size-xs: 0.75rem;
$font-size-sm: 0.875rem;
$font-size-base: 1rem;
$font-size-lg: 1.125rem;
$font-size-xl: 1.25rem;
$font-size-2xl: 1.5rem;
$font-size-3xl: 1.875rem;

// Spacing
$spacing-1: 0.25rem;
$spacing-2: 0.5rem;
$spacing-3: 0.75rem;
$spacing-4: 1rem;
$spacing-5: 1.25rem;
$spacing-6: 1.5rem;
$spacing-8: 2rem;
$spacing-10: 2.5rem;
$spacing-12: 3rem;

// Border radius
$radius-sm: 0.25rem;
$radius-md: 0.375rem;
$radius-lg: 0.5rem;
$radius-xl: 0.75rem;
$radius-full: 9999px;

// Shadows
$shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
$shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
$shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
$shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

// Breakpoints
$breakpoint-sm: 640px;
$breakpoint-md: 768px;
$breakpoint-lg: 1024px;
$breakpoint-xl: 1280px;
```

**Global Styles:**
```scss
// styles/global.scss
@import 'variables';

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
}

body {
  font-family: $font-family;
  background: $gray-900;
  color: $gray-100;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

button {
  cursor: pointer;
  font-family: inherit;
}

input, textarea, select {
  font-family: inherit;
}
```

### 1.6 Icons

#### React Icons (Feather)
```bash
npm install react-icons
```

**Usage:**
```tsx
import { FiHome, FiUser, FiSettings, FiLogOut } from 'react-icons/fi';

<FiHome size={24} />
```

### 1.7 Notifications

#### React Toastify
```bash
npm install react-toastify
```

**Setup:**
```tsx
// App.tsx
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <>
      {/* Routes */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="dark"
      />
    </>
  );
}

// Usage
import { toast } from 'react-toastify';

toast.success('Success message');
toast.error('Error message');
toast.warning('Warning message');
toast.info('Info message');
```

---

## 2. Backend Stack

### 2.1 Core Framework

#### Node.js + Express + TypeScript
```bash
npm init -y
npm install express cors dotenv
npm install -D typescript ts-node @types/node @types/express @types/cors nodemon
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**package.json scripts:**
```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Express Setup:**
```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### 2.2 Database & ORM

#### Prisma + MySQL
```bash
npm install @prisma/client
npm install -D prisma
npx prisma init
```

**prisma/schema.prisma:**
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  firstName String?
  lastName  String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum Role {
  ADMIN
  USER
}
```

**Prisma Commands:**
```bash
# Generate client
npx prisma generate

# Create migration
npx prisma migrate dev --name init

# Push schema (dev only)
npx prisma db push

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed
```

**Prisma Client Usage:**
```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;

// Usage in services
import prisma from '../lib/prisma';

const users = await prisma.user.findMany();
const user = await prisma.user.create({ data: { ... } });
```

### 2.3 Authentication

#### JWT + Bcrypt
```bash
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs
```

**Auth Utilities:**
```typescript
// src/utils/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};
```

**Auth Middleware:**
```typescript
// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import prisma from '../lib/prisma';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
};
```

### 2.4 Validation

#### Zod
```bash
npm install zod
```

**Usage:**
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Validation middleware
export const validate = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          errors: error.errors,
        });
      }
      next(error);
    }
  };
};
```

### 2.5 Error Handling

```typescript
// src/middlewares/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
```

---

## 3. Project Structure

### 3.1 Frontend Structure

```
frontend/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/           # Reusable components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── index.ts
│   │   └── layout/           # Layout components
│   │       ├── MainLayout.tsx
│   │       ├── Sidebar.tsx
│   │       └── index.ts
│   ├── pages/
│   │   ├── auth/
│   │   │   └── LoginPage.tsx
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   ├── services/
│   │   └── api.ts            # API client & endpoints
│   ├── stores/
│   │   └── authStore.ts      # Zustand stores
│   ├── styles/
│   │   ├── _variables.scss
│   │   └── global.scss
│   ├── types/
│   │   └── index.ts          # TypeScript types
│   ├── utils/
│   │   └── helpers.ts        # Utility functions
│   ├── App.tsx
│   └── main.tsx
├── .env
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 3.2 Backend Structure

```
backend/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   └── user.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── user.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── user.service.ts
│   ├── lib/
│   │   └── prisma.ts
│   ├── utils/
│   │   └── auth.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 4. Environment Variables

### 4.1 Frontend (.env)
```env
VITE_API_URL=http://localhost:3001/api
VITE_APP_NAME=My App
```

### 4.2 Backend (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="mysql://user:password@localhost:3306/mydb"

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Optional: External services
STRIPE_SECRET_KEY=sk_test_xxx
SMTP_HOST=smtp.example.com
SMTP_USER=user@example.com
SMTP_PASS=password
```

---

## 5. Development Tools

### 5.1 ESLint
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

**.eslintrc.json:**
```json
{
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

### 5.2 Prettier
```bash
npm install -D prettier
```

**.prettierrc:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 5.3 Git Hooks (Husky)
```bash
npm install -D husky lint-staged
npx husky install
```

---

## 6. Testing

### 6.1 Backend Testing (Jest)
```bash
npm install -D jest ts-jest @types/jest supertest @types/supertest
```

**jest.config.js:**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

### 6.2 Frontend Testing (Vitest)
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

---

## 7. Deployment

### 7.1 Docker

**Dockerfile (Backend):**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=mysql://user:password@db:3306/mydb
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "5173:80"

  db:
    image: mysql:8
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: mydb
      MYSQL_USER: user
      MYSQL_PASSWORD: password
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

---

## 8. Quick Start Commands

```bash
# Clone and setup
git clone <repo>
cd project

# Backend
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (new terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## 9. UX & Responsive Design

### 9.1 Responsive Breakpoints

```scss
// Breakpoints
$breakpoint-sm: 640px;   // Mobile
$breakpoint-md: 768px;   // Tablet
$breakpoint-lg: 1024px;  // Desktop
$breakpoint-xl: 1280px;  // Large Desktop
```

### 9.2 Responsive Mixins

```scss
// Responsive Mixins
@mixin mobile {
  @media (max-width: #{$breakpoint-sm - 1}) {
    @content;
  }
}

@mixin tablet {
  @media (max-width: #{$breakpoint-md - 1}) {
    @content;
  }
}

@mixin tablet-up {
  @media (min-width: $breakpoint-md) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: $breakpoint-lg) {
    @content;
  }
}

// Usage
.element {
  padding: $spacing-6;

  @include tablet {
    padding: $spacing-4;
  }

  @include mobile {
    padding: $spacing-3;
  }
}
```

### 9.3 Mobile Sidebar Pattern

```tsx
// Sidebar.tsx - Mobile responsive sidebar
const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <button onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <FiX /> : <FiMenu />}
        </button>
        <h1>Logo</h1>
      </div>

      {/* Overlay (mobile only) */}
      {isOpen && <div className="sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Navigation */}
      </aside>
    </>
  );
};
```

```scss
// Sidebar.scss
.mobile-header {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: $gray-900;
  z-index: 99;

  @media (max-width: #{$breakpoint-md - 1}) {
    display: flex;
    align-items: center;
    gap: $spacing-3;
  }
}

.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;

  @media (max-width: #{$breakpoint-md - 1}) {
    display: block;
  }
}

.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 260px;
  transition: transform 0.3s ease;

  @media (max-width: #{$breakpoint-md - 1}) {
    transform: translateX(-100%);

    &.sidebar-open {
      transform: translateX(0);
    }
  }
}

.main-content {
  margin-left: 260px;

  @media (max-width: #{$breakpoint-md - 1}) {
    margin-left: 0;
    padding-top: 60px; // Mobile header height
  }
}
```

### 9.4 Responsive Tables

```scss
// Table wrapper for horizontal scroll
.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 600px; // Force horizontal scroll on mobile

  th, td {
    white-space: nowrap;
    padding: $spacing-3 $spacing-4;

    @media (max-width: #{$breakpoint-sm - 1}) {
      padding: $spacing-2 $spacing-3;
      font-size: $font-size-sm;
    }
  }
}
```

### 9.5 Responsive Grid Patterns

```scss
// Stats grid - 4 → 2 → 1 columns
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: $spacing-4;

  @media (max-width: $breakpoint-lg) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: $breakpoint-sm) {
    grid-template-columns: 1fr;
  }
}

// Form grid - 3 → 2 → 1 columns
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-4;

  @media (max-width: $breakpoint-lg) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: $breakpoint-sm) {
    grid-template-columns: 1fr;
  }
}
```

### 9.6 Responsive Page Header

```scss
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-3;

  @media (max-width: #{$breakpoint-sm - 1}) {
    flex-direction: column;
    align-items: stretch;
  }

  .page-title {
    font-size: $font-size-2xl;

    @media (max-width: #{$breakpoint-sm - 1}) {
      font-size: $font-size-xl;
    }
  }
}
```

### 9.7 Responsive Forms

```scss
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: $spacing-3;

  @media (max-width: #{$breakpoint-sm - 1}) {
    flex-direction: column;

    button {
      width: 100%;
    }
  }
}

.filter-row {
  display: flex;
  gap: $spacing-3;
  align-items: flex-end;

  @media (max-width: #{$breakpoint-sm - 1}) {
    flex-direction: column;
    align-items: stretch;
  }
}
```

### 9.8 Modal (Mobile Bottom Sheet)

```scss
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;

  @media (max-width: #{$breakpoint-sm - 1}) {
    align-items: flex-end; // Slide from bottom
  }
}

.modal-content {
  max-height: 90vh;
  border-radius: $radius-lg;

  @media (max-width: #{$breakpoint-sm - 1}) {
    max-height: 85vh;
    border-radius: $radius-lg $radius-lg 0 0;
    width: 100%;
  }
}
```

### 9.9 Touch-Friendly Elements

```scss
// Minimum touch target size (44x44px)
.action-btn, .mobile-menu-btn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

// Larger tap targets for mobile
.nav-link {
  padding: $spacing-3 $spacing-4;

  @media (max-width: #{$breakpoint-md - 1}) {
    padding: $spacing-4 $spacing-4;
  }
}
```

### 9.10 UX Patterns Summary

| Pattern | Desktop | Mobile |
|---------|---------|--------|
| Sidebar | Fixed left | Hidden, hamburger menu |
| Page Header | Horizontal flex | Vertical stack |
| Tables | Normal | Horizontal scroll |
| Stats Grid | 4 columns | 1-2 columns |
| Form Grid | 2-3 columns | 1 column |
| Modal | Centered | Bottom sheet |
| Buttons | Inline | Full width |

---

## 10. Package Summary

### Frontend
| Package | Purpose |
|---------|---------|
| react | UI library |
| react-router-dom | Routing |
| zustand | State management |
| axios | HTTP client |
| react-icons | Icons |
| react-toastify | Notifications |
| sass | Styling |

### Backend
| Package | Purpose |
|---------|---------|
| express | Web framework |
| @prisma/client | Database ORM |
| jsonwebtoken | JWT auth |
| bcryptjs | Password hashing |
| zod | Validation |
| cors | CORS middleware |
| dotenv | Environment variables |

---

*Document Version: 1.0*
*Last Updated: December 2024*
