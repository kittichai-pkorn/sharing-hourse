import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import { notifyWinnerRecorded, notifyGroupCompleted } from '../services/notificationService.js';

const router = Router();

// GET /api/rounds/group/:groupId - Get all rounds for a share group
router.get('/group/:groupId', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verify the group belongs to user's tenant
    const shareGroup = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(groupId),
        tenantId: req.user!.tenantId,
      },
    });

    if (!shareGroup) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    const rounds = await prisma.round.findMany({
      where: { shareGroupId: parseInt(groupId) },
      include: {
        winner: {
          include: {
            member: true,
          },
        },
      },
      orderBy: { roundNumber: 'asc' },
    });

    res.json({
      success: true,
      data: rounds,
    });
  } catch (error) {
    console.error('Get rounds error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/rounds/:id - Get single round detail
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const round = await prisma.round.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: {
          include: {
            host: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            members: {
              include: {
                member: true,
                rounds: {
                  select: { id: true },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
        winner: {
          include: {
            member: true,
          },
        },
        deductions: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    // Get members who haven't won yet
    const availableMembers = round.shareGroup.members.filter(m => m.rounds.length === 0);

    // Find host member
    const hostMember = round.shareGroup.members.find(m => m.userId === round.shareGroup.hostId);

    // Calculate totals
    const totalPool = round.shareGroup.principalAmount * round.shareGroup.maxMembers;
    const totalDeductions = round.deductions.reduce((sum, d) => sum + d.amount, 0);

    res.json({
      success: true,
      data: {
        ...round,
        availableMembers,
        hostMember,
        totalPool,
        totalDeductions,
        netPayout: round.payoutAmount || (totalPool - (round.winningBid || 0) - totalDeductions),
      },
    });
  } catch (error) {
    console.error('Get round error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/rounds/:id - Update round (dueDate, assignedMember, interest)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, winnerId, interest } = req.body;

    if (!dueDate && winnerId === undefined && interest === undefined) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข',
      });
    }

    const round = await prisma.round.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: true,
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    // Only allow editing dueDate/winnerId if round is not completed
    // But interest can be edited anytime
    if (round.status === 'COMPLETED' && (dueDate || winnerId !== undefined)) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถแก้ไขงวดที่เสร็จสิ้นแล้ว',
      });
    }

    // First round's winner (host) cannot be changed
    if (round.roundNumber === 1 && winnerId !== undefined) {
      return res.status(400).json({
        success: false,
        error: 'งวดแรกเป็นของท้าวแชร์เสมอ ไม่สามารถเปลี่ยนแปลงได้',
      });
    }

    // Validate interest
    if (interest !== undefined && interest < 0) {
      return res.status(400).json({
        success: false,
        error: 'ดอกเบี้ยต้องไม่ติดลบ',
      });
    }

    // Build update data
    const updateData: any = {};
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    if (winnerId !== undefined) {
      updateData.winnerId = winnerId || null; // null to unassign
    }
    if (interest !== undefined) {
      updateData.winningBid = interest;
    }

    const updatedRound = await prisma.round.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        winner: {
          include: {
            member: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedRound,
      message: 'แก้ไขงวดเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Update round error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/rounds/:id/winner - Record winner for a round
router.post('/:id/winner', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId, interest } = req.body;

    // Validate input
    if (!memberId) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาเลือกผู้ชนะ',
      });
    }

    const round = await prisma.round.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: {
          include: {
            members: {
              include: {
                rounds: true,
                member: true,
              },
            },
            deductionTemplates: true,
          },
        },
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    if (round.winnerId) {
      return res.status(400).json({
        success: false,
        error: 'งวดนี้มีผู้ชนะแล้ว',
      });
    }

    // Verify member hasn't won yet
    const member = round.shareGroup.members.find(m => m.id === memberId);
    if (!member) {
      return res.status(400).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    if (member.rounds.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ลูกแชร์นี้เปียแล้ว',
      });
    }

    // First round must be the host
    if (round.roundNumber === 1) {
      const hostMember = round.shareGroup.members.find(m => m.userId === round.shareGroup.hostId);
      if (!hostMember || memberId !== hostMember.id) {
        return res.status(400).json({
          success: false,
          error: 'งวดแรกต้องเป็นท้าวแชร์เท่านั้น',
        });
      }
    }

    // Calculate payout based on group type
    let payoutAmount: number;
    const interestAmount = interest || 0;
    const templateDeductions = round.shareGroup.deductionTemplates.reduce((sum, d) => sum + d.amount, 0);

    if (round.shareGroup.type === 'STEP_INTEREST') {
      // STEP_INTEREST: คำนวณยอดรับตามสูตรขั้นบันได
      const hostMember = round.shareGroup.members.find(m => m.userId === round.shareGroup.hostId);
      const isHostWinning = hostMember && memberId === hostMember.id;

      // Get all non-host members' payment amounts
      const nonHostMembers = round.shareGroup.members.filter(m => m.userId !== round.shareGroup.hostId);
      const totalMemberPayments = nonHostMembers.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);

      if (round.roundNumber === 1 || isHostWinning) {
        // งวดแรก หรือท้าวรับ: ยอดรับ = ผลรวมยอดส่งลูกแชร์ทั้งหมด
        payoutAmount = totalMemberPayments;
      } else {
        // ลูกแชร์รับ: ยอดรับ = เงินต้น - ยอดส่งลูกแชร์คนอื่น - ยอดหักท้าย(ตัวเอง)
        const winnerMember = round.shareGroup.members.find(m => m.id === memberId);
        const winnerPaymentAmount = winnerMember?.paymentAmount || 0;

        // ยอดส่งลูกแชร์คนอื่น = ผลรวมยอดส่งทั้งหมด - ยอดส่งตัวเอง
        const otherMembersPayments = totalMemberPayments - winnerPaymentAmount;

        // Check if this round is in tail deduction rounds
        // tailDeductionRounds is now the count of tail rounds (e.g., 3 = last 3 rounds)
        let isTailRound = false;
        if (round.shareGroup.tailDeductionRounds && round.shareGroup.tailDeductionRounds > 0) {
          const firstTailRound = round.shareGroup.maxMembers - round.shareGroup.tailDeductionRounds + 1;
          isTailRound = round.roundNumber >= firstTailRound;
        }

        payoutAmount = round.shareGroup.principalAmount - otherMembersPayments - winnerPaymentAmount;
      }
    } else {
      // Default calculation for other group types
      const totalPool = round.shareGroup.principalAmount * round.shareGroup.maxMembers;
      payoutAmount = totalPool - interestAmount - templateDeductions;
    }

    // Use transaction to update round and create deductions
    const updatedRound = await prisma.$transaction(async (tx) => {
      // Create deductions from templates
      if (round.shareGroup.deductionTemplates.length > 0) {
        await tx.deduction.createMany({
          data: round.shareGroup.deductionTemplates.map(template => ({
            roundId: round.id,
            type: 'OTHER',
            amount: template.amount,
            note: template.name,
          })),
        });
      }

      // Add interest as deduction if present
      if (interestAmount > 0) {
        await tx.deduction.create({
          data: {
            roundId: round.id,
            type: 'INTEREST',
            amount: interestAmount,
            note: 'ดอกเบี้ย',
          },
        });
      }

      // Update round
      const updated = await tx.round.update({
        where: { id: round.id },
        data: {
          winnerId: memberId,
          winningBid: interestAmount,
          payoutAmount,
          status: 'COMPLETED',
        },
        include: {
          winner: {
            include: {
              member: true,
            },
          },
          deductions: true,
        },
      });

      // Check if this is the last round
      const remainingRounds = await tx.round.count({
        where: {
          shareGroupId: round.shareGroupId,
          status: { not: 'COMPLETED' },
        },
      });

      // If no remaining rounds, mark group as completed
      if (remainingRounds === 0) {
        await tx.shareGroup.update({
          where: { id: round.shareGroupId },
          data: { status: 'COMPLETED' },
        });
      }

      return { updated, isGroupCompleted: remainingRounds === 0 };
    });

    // Create notifications (outside transaction)
    const winnerName = updatedRound.updated.winner?.nickname ||
      updatedRound.updated.winner?.member?.nickname ||
      'ผู้ชนะ';

    try {
      await notifyWinnerRecorded({
        id: round.id,
        roundNumber: round.roundNumber,
        shareGroup: {
          id: round.shareGroup.id,
          name: round.shareGroup.name,
          tenantId: round.shareGroup.tenantId,
          hostId: round.shareGroup.hostId,
        },
        winnerName,
      });

      // If group completed, send group completed notification
      if (updatedRound.isGroupCompleted) {
        await notifyGroupCompleted({
          id: round.shareGroup.id,
          name: round.shareGroup.name,
          tenantId: round.shareGroup.tenantId,
          hostId: round.shareGroup.hostId,
        });
      }
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: updatedRound.updated,
      message: 'บันทึกผู้ชนะเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Record winner error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/rounds/generate/:groupId - Generate rounds for a share group
router.post('/generate/:groupId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;

    const shareGroup = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(groupId),
        tenantId: req.user!.tenantId,
      },
    });

    if (!shareGroup) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Check if rounds already exist
    const existingRounds = await prisma.round.count({
      where: { shareGroupId: parseInt(groupId) },
    });

    if (existingRounds > 0) {
      return res.status(400).json({
        success: false,
        error: 'วงนี้มีงวดแล้ว',
      });
    }

    // Generate rounds based on maxMembers
    const rounds = [];
    let currentDate = new Date(shareGroup.startDate);

    for (let i = 1; i <= shareGroup.maxMembers; i++) {
      rounds.push({
        shareGroupId: shareGroup.id,
        roundNumber: i,
        dueDate: new Date(currentDate),
        status: 'PENDING' as const,
      });

      // Calculate next due date based on cycle type
      if (shareGroup.cycleType === 'DAILY') {
        currentDate.setDate(currentDate.getDate() + (shareGroup.cycleDays || 1));
      } else if (shareGroup.cycleType === 'WEEKLY') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        // MONTHLY
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }

    await prisma.round.createMany({
      data: rounds,
    });

    const createdRounds = await prisma.round.findMany({
      where: { shareGroupId: parseInt(groupId) },
      orderBy: { roundNumber: 'asc' },
    });

    res.status(201).json({
      success: true,
      data: createdRounds,
      message: `สร้าง ${createdRounds.length} งวดเรียบร้อยแล้ว`,
    });
  } catch (error) {
    console.error('Generate rounds error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// ==================== Round Payment APIs ====================

// GET /api/rounds/:roundId/payments - Get all payments for a round
router.get('/:roundId/payments', authMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;

    const round = await prisma.round.findFirst({
      where: { id: parseInt(roundId) },
      include: {
        shareGroup: {
          include: {
            members: {
              include: {
                member: true,
                user: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
        payments: true,
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    const principalAmount = round.shareGroup.principalAmount;
    const winnerId = round.winnerId;

    // Build payments list
    const payments = round.shareGroup.members.map((gm) => {
      const isWinner = gm.id === winnerId;
      const existingPayment = round.payments.find((p) => p.groupMemberId === gm.id);
      const isHost = gm.userId === round.shareGroup.hostId;

      // Get nickname from groupMember, member, or user
      const nickname =
        gm.nickname || gm.member?.nickname || (gm.user ? `${gm.user.firstName} ${gm.user.lastName}` : 'ไม่ระบุชื่อ');
      const memberCode = gm.member?.memberCode || null;

      if (isWinner) {
        return {
          id: existingPayment?.id || null,
          groupMemberId: gm.id,
          memberCode,
          nickname,
          isHost,
          isWinner: true,
          amount: 0,
          isPaid: null, // null = เปียงวดนี้
          paidAt: null,
          note: 'เปียงวดนี้',
        };
      }

      return {
        id: existingPayment?.id || null,
        groupMemberId: gm.id,
        memberCode,
        nickname,
        isHost,
        isWinner: false,
        amount: principalAmount,
        isPaid: existingPayment?.paidAt ? true : false,
        paidAt: existingPayment?.paidAt || null,
        note: existingPayment?.note || null,
      };
    });

    // Calculate stats (exclude winner)
    const nonWinnerPayments = payments.filter((p) => !p.isWinner);
    const paidCount = nonWinnerPayments.filter((p) => p.isPaid).length;
    const totalMembers = nonWinnerPayments.length;
    const paidAmount = paidCount * principalAmount;
    const totalAmount = totalMembers * principalAmount;

    res.json({
      success: true,
      data: {
        roundId: round.id,
        roundNumber: round.roundNumber,
        dueDate: round.dueDate,
        principalAmount,
        totalMembers,
        paidCount,
        paidAmount,
        totalAmount,
        winnerId,
        payments,
      },
    });
  } catch (error) {
    console.error('Get round payments error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/rounds/:roundId/payments - Bulk save/update payments
router.post('/:roundId/payments', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { payments } = req.body;

    if (!payments || !Array.isArray(payments)) {
      return res.status(400).json({
        success: false,
        error: 'กรุณาระบุรายการชำระเงิน',
      });
    }

    const round = await prisma.round.findFirst({
      where: { id: parseInt(roundId) },
      include: {
        shareGroup: true,
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    const principalAmount = round.shareGroup.principalAmount;

    // Process payments in transaction
    await prisma.$transaction(async (tx) => {
      for (const payment of payments) {
        const { groupMemberId, isPaid, note } = payment;

        // Skip winner
        if (groupMemberId === round.winnerId) continue;

        // Upsert payment record
        await tx.roundPayment.upsert({
          where: {
            roundId_groupMemberId: {
              roundId: round.id,
              groupMemberId,
            },
          },
          create: {
            roundId: round.id,
            groupMemberId,
            amount: principalAmount,
            paidAt: isPaid ? new Date() : null,
            note: note || null,
          },
          update: {
            paidAt: isPaid ? new Date() : null,
            note: note || null,
          },
        });
      }
    });

    res.json({
      success: true,
      message: 'บันทึกการชำระเงินเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Save round payments error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/rounds/:roundId/payments/:groupMemberId - Update single payment
router.put('/:roundId/payments/:groupMemberId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { roundId, groupMemberId } = req.params;
    const { isPaid, note } = req.body;

    const round = await prisma.round.findFirst({
      where: { id: parseInt(roundId) },
      include: {
        shareGroup: true,
      },
    });

    if (!round || round.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบงวด',
      });
    }

    // Cannot update winner's payment
    if (parseInt(groupMemberId) === round.winnerId) {
      return res.status(400).json({
        success: false,
        error: 'ผู้ชนะไม่ต้องชำระเงิน',
      });
    }

    const principalAmount = round.shareGroup.principalAmount;

    // Upsert payment
    const payment = await prisma.roundPayment.upsert({
      where: {
        roundId_groupMemberId: {
          roundId: round.id,
          groupMemberId: parseInt(groupMemberId),
        },
      },
      create: {
        roundId: round.id,
        groupMemberId: parseInt(groupMemberId),
        amount: principalAmount,
        paidAt: isPaid ? new Date() : null,
        note: note || null,
      },
      update: {
        paidAt: isPaid ? new Date() : null,
        note: note || null,
      },
    });

    res.json({
      success: true,
      data: {
        id: payment.id,
        groupMemberId: payment.groupMemberId,
        isPaid: payment.paidAt ? true : false,
        paidAt: payment.paidAt,
        note: payment.note,
      },
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
