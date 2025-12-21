# Sprint 1: Epic 1 - Authentication

**Period:** Dec 2024
**Goal:** ระบบ Authentication สำหรับ ท้าวแชร์ และ SuperAdmin
**Status:** ✅ DONE

---

## Stories

| # | Story | Priority | Points | Status | Progress |
|---|-------|----------|--------|--------|----------|
| 1.1 | ลงทะเบียน Tenant (ท้าวแชร์) | P0 | 5 | ✅ Done | 100% |
| 1.2 | เข้าสู่ระบบ (Multi-tenant) | P0 | 3 | ✅ Done | 100% |
| 1.3 | จัดการโปรไฟล์ | P2 | 2 | ✅ Done | 100% |
| 1.4 | เพิ่ม User เข้า Tenant | P2 | 3 | ⏸️ Skipped | - |
| 1.5 | SuperAdmin Login | P0 | 2 | ✅ Done | 100% |

**Total Points:** 12 (excl. skipped) | **Completed:** 12 | **Progress:** 100%

---

## Story Details

### 1.1 ลงทะเบียน Tenant (ท้าวแชร์) ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| กรอกข้อมูล Tenant (ชื่อองค์กร/วง) | ✅ |
| กรอกข้อมูล Admin (ท้าวแชร์) | ✅ |
| สร้าง Tenant slug อัตโนมัติ | ✅ |
| Validate email/เบอร์โทรไม่ซ้ำ | ✅ |
| สถานะเริ่มต้น = PENDING | ✅ |

**Files:**
- `backend/src/routes/auth.ts` - POST /api/auth/register
- `frontend/src/pages/auth/RegisterPage.tsx`

---

### 1.2 เข้าสู่ระบบ (Multi-tenant) ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| กรอกรหัสวง (tenant slug) | ✅ |
| กรอกเบอร์โทร/email + รหัสผ่าน | ✅ |
| ตรวจสอบ Tenant status = ACTIVE | ✅ |
| แสดง error ถ้าข้อมูลไม่ถูกต้อง | ✅ |
| แสดง error ถ้า Tenant ยังไม่ได้อนุมัติ | ✅ |
| จำการ login (Remember me) | ✅ |
| Redirect ไป Dashboard หลัง login | ✅ |
| ลูกแชร์ไม่สามารถ login ได้ | ✅ |

**Files:**
- `backend/src/routes/auth.ts` - POST /api/auth/login
- `frontend/src/pages/auth/LoginPage.tsx`

---

### 1.3 จัดการโปรไฟล์ ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| ดูข้อมูลส่วนตัว | ✅ |
| แก้ไขชื่อ | ✅ |
| เปลี่ยนรหัสผ่าน (ต้องใส่รหัสเดิม) | ✅ |
| อัพโหลดรูปโปรไฟล์ | ⏸️ (Skip - P2) |
| แสดงข้อมูล Tenant ที่สังกัด | ✅ |

**Files:**
- `backend/src/routes/users.ts` - GET/PUT /api/users/me, PUT /api/users/me/password
- `frontend/src/pages/dashboard/ProfilePage.tsx`

---

### 1.4 เพิ่ม User เข้า Tenant ⏸️ Skipped

**เหตุผล:** ลูกแชร์ไม่ต้อง login - ท้าวแชร์จัดการให้ทั้งหมด

ดู **Story 4.2** สำหรับการเพิ่มสมาชิกเข้าวงแชร์ (GroupMember)

---

### 1.5 SuperAdmin Login ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| Login ด้วย email + password | ✅ |
| ใช้ token แยกจาก tenant users | ✅ |
| Redirect ไป Super Admin Dashboard | ✅ |
| Token expiry: 24 hours | ✅ |

**Files:**
- `backend/src/routes/superadmin.ts` - POST /api/superadmin/login
- `frontend/src/pages/superadmin/SuperAdminLoginPage.tsx`
- `frontend/src/pages/superadmin/SuperAdminDashboard.tsx`

---

## Bonus: เพิ่มเติมนอก Stories

| Feature | Status | Notes |
|---------|--------|-------|
| สร้างวงแชร์ (ShareGroup) | ✅ | CRUD API + UI |
| เพิ่มสมาชิกวง (GroupMember) | ✅ | รหัสลูกแชร์ auto (A,B,C...) |
| SuperAdmin อนุมัติ Tenant | ✅ | Approve/Reject |

---

## Blockers / Issues

| Issue | Status | Solution |
|-------|--------|----------|
| - | - | - |

---

## Next Sprint

→ ดู [Sprint 2](./sprint-2.md) - Epic 2 & 4 (Dashboard & Members)

---

*Last updated: Dec 21, 2024*
