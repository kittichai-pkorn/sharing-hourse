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

// PUT /api/rounds/:id - Update round (dueDate, assignedMember)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { dueDate, winnerId } = req.body;

    if (!dueDate && winnerId === undefined) {
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

    // Only allow editing if round is not completed
    if (round.status === 'COMPLETED') {
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

    // Build update data
    const updateData: any = {};
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    if (winnerId !== undefined) {
      updateData.winnerId = winnerId || null; // null to unassign
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

    // Calculate payout
    const totalPool = round.shareGroup.principalAmount * round.shareGroup.maxMembers;
    const interestAmount = interest || 0;

    // Get deduction templates total
    const templateDeductions = round.shareGroup.deductionTemplates.reduce((sum, d) => sum + d.amount, 0);

    const payoutAmount = totalPool - interestAmount - templateDeductions;

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

export default router;
