import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

// GET /api/member-deductions/round/:roundId - Get member deductions for a round
router.get('/round/:roundId', authMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify round belongs to tenant
    const round = await prisma.round.findFirst({
      where: {
        id: parseInt(roundId),
        shareGroup: { tenantId },
      },
      include: {
        shareGroup: {
          include: {
            members: {
              include: {
                member: true,
                user: true,
              },
            },
          },
        },
        memberDeductions: {
          include: {
            groupMember: {
              include: {
                member: true,
                user: true,
              },
            },
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    // Build response with all members and their deductions
    const membersWithDeductions = round.shareGroup.members.map((gm) => {
      const deduction = round.memberDeductions.find((d) => d.groupMemberId === gm.id);
      return {
        groupMemberId: gm.id,
        nickname: gm.nickname || gm.member?.nickname || gm.user?.firstName || 'Unknown',
        memberCode: gm.member?.memberCode || null,
        isHost: !!gm.userId && !gm.memberId,
        deduction: deduction
          ? {
              id: deduction.id,
              amount: deduction.amount,
              note: deduction.note,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      data: {
        roundId: round.id,
        roundNumber: round.roundNumber,
        members: membersWithDeductions,
      },
    });
  } catch (error) {
    console.error('Get member deductions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// POST /api/member-deductions/round/:roundId - Save member deductions for a round
router.post('/round/:roundId', authMiddleware, async (req, res) => {
  try {
    const { roundId } = req.params;
    const { deductions } = req.body; // Array of { groupMemberId, amount, note? }
    const tenantId = req.user!.tenantId;

    if (!Array.isArray(deductions)) {
      return res.status(400).json({ success: false, message: 'Invalid deductions format' });
    }

    // Verify round belongs to tenant
    const round = await prisma.round.findFirst({
      where: {
        id: parseInt(roundId),
        shareGroup: { tenantId },
      },
      include: {
        shareGroup: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!round) {
      return res.status(404).json({ success: false, message: 'Round not found' });
    }

    // Validate all groupMemberIds belong to this group
    const groupMemberIds = round.shareGroup.members.map((m) => m.id);
    for (const d of deductions) {
      if (!groupMemberIds.includes(d.groupMemberId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid groupMemberId: ${d.groupMemberId}`,
        });
      }
    }

    // Upsert deductions
    await prisma.$transaction(async (tx) => {
      for (const d of deductions) {
        if (d.amount > 0) {
          await tx.memberRoundDeduction.upsert({
            where: {
              roundId_groupMemberId: {
                roundId: parseInt(roundId),
                groupMemberId: d.groupMemberId,
              },
            },
            create: {
              roundId: parseInt(roundId),
              groupMemberId: d.groupMemberId,
              amount: d.amount,
              note: d.note || null,
            },
            update: {
              amount: d.amount,
              note: d.note || null,
            },
          });
        } else {
          // If amount is 0 or less, delete the deduction if exists
          await tx.memberRoundDeduction.deleteMany({
            where: {
              roundId: parseInt(roundId),
              groupMemberId: d.groupMemberId,
            },
          });
        }
      }
    });

    return res.json({
      success: true,
      message: 'Member deductions saved successfully',
    });
  } catch (error) {
    console.error('Save member deductions error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// PUT /api/member-deductions/:id - Update a single member deduction
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;
    const tenantId = req.user!.tenantId;

    // Verify deduction belongs to tenant
    const deduction = await prisma.memberRoundDeduction.findFirst({
      where: {
        id: parseInt(id),
        round: {
          shareGroup: { tenantId },
        },
      },
    });

    if (!deduction) {
      return res.status(404).json({ success: false, message: 'Deduction not found' });
    }

    const updated = await prisma.memberRoundDeduction.update({
      where: { id: parseInt(id) },
      data: {
        amount: amount !== undefined ? amount : deduction.amount,
        note: note !== undefined ? note : deduction.note,
      },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Update member deduction error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// DELETE /api/member-deductions/:id - Delete a member deduction
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify deduction belongs to tenant
    const deduction = await prisma.memberRoundDeduction.findFirst({
      where: {
        id: parseInt(id),
        round: {
          shareGroup: { tenantId },
        },
      },
    });

    if (!deduction) {
      return res.status(404).json({ success: false, message: 'Deduction not found' });
    }

    await prisma.memberRoundDeduction.delete({
      where: { id: parseInt(id) },
    });

    return res.json({
      success: true,
      message: 'Deduction deleted successfully',
    });
  } catch (error) {
    console.error('Delete member deduction error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// GET /api/member-deductions/group/:groupId/summary - Get summary of all member deductions for a group
router.get('/group/:groupId/summary', authMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const tenantId = req.user!.tenantId;

    // Verify group belongs to tenant
    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(groupId),
        tenantId,
      },
      include: {
        members: {
          include: {
            member: true,
            user: true,
            roundDeductions: {
              include: {
                round: true,
              },
            },
          },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Build summary per member
    const memberSummaries = group.members.map((gm) => {
      const totalDeductions = gm.roundDeductions.reduce((sum, d) => sum + d.amount, 0);
      const deductionsByRound = gm.roundDeductions.map((d) => ({
        roundId: d.roundId,
        roundNumber: d.round.roundNumber,
        amount: d.amount,
        note: d.note,
      }));

      return {
        groupMemberId: gm.id,
        nickname: gm.nickname || gm.member?.nickname || gm.user?.firstName || 'Unknown',
        memberCode: gm.member?.memberCode || null,
        isHost: !!gm.userId && !gm.memberId,
        totalDeductions,
        deductionsByRound,
      };
    });

    return res.json({
      success: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        totalRounds: group.rounds.length,
        members: memberSummaries,
      },
    });
  } catch (error) {
    console.error('Get member deductions summary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
