# Sprint 4: Epic 5 - จัดการงวด

**Period:** Dec 2024
**Goal:** Rounds Management, Payments, Deductions
**Status:** ✅ Completed

---

## Stories

| # | Story | Priority | Points | Status | Progress |
|---|-------|----------|--------|--------|----------|
| 5.1 | แสดง Timeline งวด | P0 | 3 | ✅ Done | 100% |
| 5.2 | แสดงรายละเอียดงวด | P0 | 2 | ✅ Done | 100% |
| 5.3 | บันทึกผู้ชนะ | P0 | 5 | ✅ Done | 100% |
| 5.4 | งวดแรก (ท้าวแชร์) | P1 | 2 | ✅ Done | 100% |
| 5.5 | งวดสุดท้าย | P1 | 2 | ✅ Done | 100% |
| 5.6 | ตารางชำระทั้งหมด | P1 | 3 | ✅ Done | 100% |
| 5.7 | บันทึกการชำระเงิน | P1 | 3 | ✅ Done | 100% |
| 5.8 | แก้ไขดอกเบี้ยงวด | P2 | 1 | ✅ Done | 100% |
| 5.9 | แสดงผลการชำระงวดแรก | P1 | 1 | ✅ Done | 100% |

**Total Points:** 22 | **Completed:** 22 | **Progress:** 100%

---

## Story Details

### 5.1 แสดง Timeline งวด ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดง Timeline แนวนอน (desktop) | ✅ |
| แสดงสถานะแต่ละงวด (สำเร็จ/ปัจจุบัน/รอ) | ✅ |
| แสดงชื่อผู้ชนะ (ถ้ามี) | ✅ |
| แสดงดอกเบี้ย (ถ้ามี) | ✅ |
| คลิกดูรายละเอียดงวด | ✅ |

---

### 5.2 แสดงรายละเอียดงวด ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงเลขงวด | ✅ |
| แสดงกำหนดชำระ | ✅ |
| แสดงเงินกองกลาง | ✅ |
| แสดงผู้ชนะ (ถ้ามี) | ✅ |
| แสดงดอกเบี้ย | ✅ |
| แสดงเงินที่ได้รับจริง | ✅ |
| ปุ่มบันทึกผู้ชนะ (ถ้ายังไม่มี) | ✅ |

---

### 5.3 บันทึกผู้ชนะ ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| เลือกผู้ชนะจาก dropdown (เฉพาะคนที่ยังไม่เปีย) | ✅ |
| กรอกดอกเบี้ย (สำหรับวงประมูล) | ✅ |
| แสดง real-time คำนวณเงินที่ได้รับ | ✅ |
| Confirmation ก่อนบันทึก | ✅ |
| อัพเดทสถานะสมาชิกเป็น "เปียแล้ว" | ✅ |
| อัพเดทสถานะงวดเป็น "สำเร็จ" | ✅ |

---

### 5.4 งวดแรก (ท้าวแชร์) ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| งวดแรกผู้ชนะ = ท้าวแชร์ (auto-select) | ✅ |
| ไม่มีดอกเบี้ย (= 0) / disabled field | ✅ |
| Admin กดยืนยันเท่านั้น | ✅ |
| แสดงข้อความ "งวดแรกเป็นสิทธิ์ของท้าวแชร์" | ✅ |

---

### 5.5 งวดสุดท้าย ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| เหลือคนเดียว = ผู้ชนะอัตโนมัติ (auto-select) | ✅ |
| ไม่มีดอกเบี้ย (= 0) / disabled field | ✅ |
| Admin กดยืนยันเท่านั้น | ✅ |
| แสดงข้อความ "งวดสุดท้าย - ได้รับเงินเต็ม" | ✅ |
| หลังยืนยัน → ปิดวง (สถานะ = COMPLETED) | ✅ |

---

### 5.6 ตารางชำระทั้งหมด ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงตารางชำระรายบุคคล (matrix view) | ✅ |
| แสดงสถานะ PENDING/PAID/WON | ✅ |
| สรุปยอดชำระต่อคน | ✅ |
| ปุ่มคัดลอกข้อความ | ✅ |
| ปุ่มแชร์ไปยัง LINE | ✅ |
| ปุ่มอยู่ใน header ถัดจาก tabs | ✅ |

---

### 5.7 บันทึกการชำระเงิน ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| แสดงรายชื่อลูกแชร์ที่ต้องชำระในแต่ละงวด | ✅ |
| สามารถ tick ✓ ว่าลูกแชร์คนนั้นชำระแล้ว | ✅ |
| แสดงสถานะ: ยังไม่ชำระ / ชำระแล้ว | ✅ |
| แสดงจำนวนคนที่ชำระแล้ว / ทั้งหมด | ✅ |
| สามารถยกเลิกการชำระได้ (กรณีบันทึกผิด) | ✅ |
| บันทึกวันที่และเวลาที่ชำระ | ✅ |
| Tab "การชำระเงิน" ใน Round Modal | ✅ |

---

### 5.8 แก้ไขดอกเบี้ยงวด ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| คลิกแก้ไขดอกเบี้ยในตารางงวดได้ (inline edit) | ✅ |
| แสดงค่าดอกเบี้ยที่คำนวณอัตโนมัติเป็นค่าเริ่มต้น | ✅ |
| บันทึกดอกเบี้ยที่แก้ไขลง database | ✅ |
| แสดงดอกเบี้ยที่แก้ไขแล้วในตาราง | ✅ |
| แก้ไขดอกเบี้ยใน Modal สำหรับ BID_INTEREST | ✅ |

---

### 5.9 แสดงผลการชำระงวดแรก ✅

| Acceptance Criteria | Status |
|---------------------|--------|
| งวดแรก: แสดง banner "ท้าวได้รับเงิน" | ✅ |
| งวดแรก: ท้าวไม่แสดงในรายการชำระ | ✅ |
| งวดอื่น: แสดง banner "ผู้เปียงวดนี้" | ✅ |
| งวดอื่น: ผู้เปียไม่แสดงในรายการชำระ | ✅ |
| ท้าวแสดงแยกด้วยสีม่วง (ไม่ต้องชำระ) | ✅ |

---

## Schema Changes

```prisma
// เพิ่มใหม่ใน Sprint นี้
model RoundPayment {
  id            Int       @id @default(autoincrement())
  roundId       Int
  groupMemberId Int
  amount        Float
  paidAt        DateTime?
  note          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  round       Round       @relation(...)
  groupMember GroupMember @relation(...)

  @@unique([roundId, groupMemberId])
}
```

---

## Files Created/Modified

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added RoundPayment model |
| `backend/src/routes/rounds.ts` | Added payment APIs, interest update |
| `backend/src/routes/share-groups.ts` | Added payment schedule API |
| `frontend/src/pages/dashboard/ShareGroupDetailPage.tsx` | Payment tab, inline edit, winner banner |
| `docs/stories/epic-5-rounds/5.6-payment-schedule.md` | NEW |
| `docs/stories/epic-5-rounds/5.7-record-payment.md` | NEW |
| `docs/stories/epic-5-rounds/5.8-edit-round-interest.md` | NEW |
| `docs/stories/epic-5-rounds/5.9-first-round-payment-display.md` | NEW |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rounds/group/:groupId` | Get all rounds for a group |
| GET | `/api/rounds/:id` | Get round detail |
| PUT | `/api/rounds/:id` | Update round (dueDate, winnerId, interest) |
| POST | `/api/rounds/:id/winner` | Record winner |
| POST | `/api/rounds/generate/:groupId` | Generate rounds for a group |
| GET | `/api/rounds/:roundId/payments` | Get payment status for round |
| POST | `/api/rounds/:roundId/payments` | Bulk save payments |
| PUT | `/api/rounds/:roundId/payments/:groupMemberId` | Update single payment |
| GET | `/api/share-groups/:id/payment-schedule` | Get full payment schedule |

---

## Blockers / Issues

| Issue | Status | Solution |
|-------|--------|----------|
| - | - | - |

---

## Commits

| Hash | Message |
|------|---------|
| 7db842d | feat: add payment recording and inline interest editing |
| d868b64 | feat: add interest editing in modal for BID_INTEREST type |
| 976d675 | feat: improve first round payment display |
| 8e390fe | feat: apply winner banner to all rounds in payment tab |
| f217eb7 | feat: disable host payment checkbox in all rounds |
| b9620f9 | feat: improve host row UX with purple styling |

---

## Next Sprint

- [ ] Epic 6: รายงาน (Reports)
- [ ] Epic 7: แจ้งเตือน (Notifications)

---

*Last updated: Dec 23, 2024*
