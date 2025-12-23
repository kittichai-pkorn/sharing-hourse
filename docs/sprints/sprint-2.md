# Sprint 2: Epic 2 & 4 - Dashboard & Members

**Period:** Dec 2024
**Goal:** Dashboard ภาพรวม และ จัดการสมาชิก
**Status:** ✅ DONE

---

## Stories

| # | Story | Priority | Points | Status | Progress |
|---|-------|----------|--------|--------|----------|
| 2.1 | แสดงภาพรวม | P1 | 2 | ✅ Done | 100% |
| 2.2 | รายการวงแชร์ | P1 | 3 | ✅ Done | 100% |
| 2.3 | Filter & Search | P2 | 2 | ✅ Done | 100% |
| 4.1 | แสดงรายการสมาชิก (ในระบบ) | P0 | 2 | ✅ Done | 100% |
| 4.2 | เพิ่มสมาชิกลงระบบ | P0 | 3 | ✅ Done | 100% |
| 4.3 | ลบสมาชิกออกจากระบบ | P2 | 2 | ✅ Done | 100% |

**Total Points:** 14 | **Completed:** 14 | **Progress:** 100%

---

## Story Details

### 2.1 แสดงภาพรวม ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงจำนวนวงทั้งหมด | ✅ |
| แสดงจำนวนวงที่กำลังดำเนินการ | ✅ |
| แสดงจำนวนงวดที่รอดำเนินการ | ✅ |
| แสดงจำนวนที่รอเก็บเงิน | ✅ |

**Files:**
- `backend/src/routes/dashboard.ts` - GET /api/dashboard/summary
- `frontend/src/pages/dashboard/DashboardPage.tsx` - Overview cards

---

### 2.2 รายการวงแชร์ ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงการ์ดวงแชร์ | ✅ |
| แสดงชื่อ, ประเภท, จำนวนสมาชิก | ✅ |
| แสดง Progress bar (งวดปัจจุบัน/ทั้งหมด) | ✅ |
| แสดงสถานะด้วยสี | ✅ |
| คลิกเข้าดูรายละเอียด | ✅ |

**Files:**
- `backend/src/routes/share-groups.ts` - GET /api/share-groups (with progress)
- `frontend/src/pages/dashboard/ShareGroupsPage.tsx` - Group cards
- `frontend/src/pages/dashboard/DashboardPage.tsx` - Recent groups

---

### 2.3 Filter & Search ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| ค้นหาด้วยชื่อวง | ✅ |
| Filter ตามสถานะ | ✅ |
| Filter ตามประเภทวง | ✅ |

**Files:**
- `backend/src/routes/share-groups.ts` - query params support
- `frontend/src/pages/dashboard/ShareGroupsPage.tsx` - Search & Filter UI

---

### 4.1 แสดงรายการสมาชิก (ในระบบ) ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงรายการสมาชิก (รหัส, ชื่อเล่น, เบอร์โทร, ไลน์) | ✅ |
| รหัสสมาชิก (memberCode) แสดงเป็น A, B, C, ... | ✅ |
| แสดงข้อความถ้ายังไม่มีสมาชิก | ✅ |
| สมาชิกถูกเก็บในระดับ tenant | ✅ |

**Files:**
- `backend/src/routes/members.ts` - GET /api/members
- `frontend/src/pages/dashboard/MembersPage.tsx` - Members table

---

### 4.2 เพิ่มสมาชิกลงระบบ ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| Admin เท่านั้นที่เพิ่มได้ | ✅ |
| กรอกข้อมูลสมาชิกตาม spec (ชื่อเล่น, ที่อยู่, เบอร์โทร, ไลน์) | ✅ |
| Validate ชื่อเล่นต้องกรอก | ✅ |
| สมาชิกถูกเก็บในระดับ tenant | ✅ |
| รหัสสมาชิก (memberCode) สร้างอัตโนมัติ A, B, C, ... | ✅ |
| แสดงข้อความสำเร็จหลังเพิ่ม | ✅ |

**Files:**
- `backend/src/routes/members.ts` - POST /api/members
- `frontend/src/pages/dashboard/MembersPage.tsx` - Add Member Modal

---

### 4.3 ลบสมาชิกออกจากระบบ ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| ลบสมาชิกที่ยังไม่อยู่ในวงใดๆ | ✅ |
| ไม่ให้ลบถ้าสมาชิกอยู่ในวงแชร์ | ✅ |
| Confirmation ก่อนลบ | ✅ |
| แสดงข้อความสำเร็จหลังลบ | ✅ |

**Files:**
- `backend/src/routes/members.ts` - DELETE /api/members/:id
- `frontend/src/pages/dashboard/MembersPage.tsx` - Delete button

---

## Blockers / Issues

| Issue | Status | Solution |
|-------|--------|----------|
| - | - | - |

---

## Next Sprint

→ [Sprint 3: Epic 3 - สร้างวงแชร์](./sprint-3.md)

---

*Last updated: Dec 22, 2024*
