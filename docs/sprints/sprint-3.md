# Sprint 3: Epic 3 - สร้างวงแชร์

**Period:** Dec 2024
**Goal:** Multi-step Wizard สำหรับสร้างวงแชร์
**Status:** ✅ DONE

---

## Stories

| # | Story | Priority | Points | Status | Progress |
|---|-------|----------|--------|--------|----------|
| 3.1 | Step 1 - ข้อมูลพื้นฐาน | P0 | 2 | ✅ Done | 100% |
| 3.2 | Step 2 - ตั้งค่าวง | P0 | 3 | ✅ Done | 100% |
| 3.3 | Step 3 - ตรวจสอบและบันทึก | P0 | 3 | ✅ Done | 100% |

> **Note:** Story รายการหักรับ ถูกย้ายไป Epic 6: หักเงิน

**Total Points:** 8 | **Completed:** 8 | **Progress:** 100%

---

## Story Details

### 3.1 Step 1 - ข้อมูลพื้นฐาน ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| กรอกชื่อวง (required) | ✅ |
| เลือกประเภทวง (dropdown) | ✅ |
| แสดง Tooltip อธิบายแต่ละประเภท | ✅ |
| Validate ก่อนไป step ถัดไป | ✅ |

---

### 3.2 Step 2 - ตั้งค่าวง ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| กรอกจำนวนสมาชิก (min 2) | ✅ |
| กรอกเงินต้นต่องวด | ✅ |
| แสดงเงินกองกลาง (real-time) | ✅ |
| เลือกรอบชำระ | ✅ |
| เลือกวันที่เริ่มต้น | ✅ |
| กรอกค่าดูแลวง (optional) | ✅ |
| กรอกดอกเบี้ยคงที่ (optional) | ✅ |

---

### 3.3 Step 3 - ตรวจสอบและบันทึก ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงสรุปข้อมูลทั้งหมด | ✅ |
| แสดงคำเตือน | ✅ |
| ปุ่มย้อนกลับแก้ไข | ✅ |
| ปุ่มบันทึก | ✅ |
| สร้างวงแชร์ | ✅ |
| Redirect ไปหน้าวงที่สร้าง | ✅ |

---

## Schema Changes

```prisma
model ShareGroup {
  // ... existing fields
  managementFee   Float?  // ค่าดูแลวง (NEW)
}
```

> **Note:** GroupDeductionTemplate model จะถูกเพิ่มใน Epic 6: หักเงิน

---

## Files Created/Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added managementFee |
| `backend/src/routes/share-groups.ts` | Updated POST/PUT |
| `frontend/src/pages/dashboard/CreateShareGroupPage.tsx` | **NEW** - Multi-step wizard (3 steps) |
| `frontend/src/App.tsx` | Added route /share-groups/new |
| `frontend/src/pages/dashboard/ShareGroupsPage.tsx` | Navigate to wizard instead of modal |

---

## Blockers / Issues

| Issue | Status | Solution |
|-------|--------|----------|
| - | - | - |

---

## Next Sprint

- [ ] Epic 5: จัดการงวด
- [ ] Epic 6: หักเงิน
- [ ] Epic 7: เปิด/ปิดวง

---

*Last updated: Dec 22, 2024*
