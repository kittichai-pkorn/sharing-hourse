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
| 4.1 | แสดงรายการสมาชิก | P0 | 2 | ✅ Done | 100% |
| 4.3 | ลบสมาชิก | P2 | 2 | ✅ Done | 100% |

**Total Points:** 11 | **Completed:** 11 | **Progress:** 100%

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

### 4.1 แสดงรายการสมาชิก ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงรายการสมาชิก (รหัส, ชื่อเล่น, สถานะ, เบอร์โทร) | ✅ |
| แสดงสถานะ เปียแล้ว/ยังไม่เปีย | ✅ |
| แสดงงวดที่เปีย (ถ้าเปียแล้ว) | ✅ |
| แสดงจำนวน สมาชิก/สูงสุด | ✅ |
| แสดงสรุป เปียแล้ว vs ยังไม่เปีย | ✅ |

**Files:**
- `backend/src/routes/share-groups.ts` - GET /:id (with member status)
- `frontend/src/pages/dashboard/ShareGroupDetailPage.tsx` - Members table

---

### 4.3 ลบสมาชิก ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| ลบสมาชิกที่ยังไม่เปีย | ✅ |
| ไม่ให้ลบคนที่เปียแล้ว | ✅ |
| ไม่ให้ลบท้าวแชร์ | ⏸️ (Optional) |
| ไม่ให้ลบถ้าวงเปิดแล้ว | ✅ |
| Confirmation ก่อนลบ | ✅ |

**Files:**
- `backend/src/routes/members.ts` - DELETE /api/members/:id
- `frontend/src/pages/dashboard/ShareGroupDetailPage.tsx` - Delete button

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
