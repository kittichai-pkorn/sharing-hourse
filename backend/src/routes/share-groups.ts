import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = Router();

// Validation schemas
const deductionTemplateSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อรายการ'),
  amount: z.number().min(0, 'จำนวนเงินต้องไม่ติดลบ'),
});

const createGroupSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อวง'),
  type: z.enum(['STEP_INTEREST', 'BID_INTEREST', 'FIXED_INTEREST', 'BID_PRINCIPAL', 'BID_PRINCIPAL_FIRST']),
  maxMembers: z.number().min(2, 'ต้องมีสมาชิกอย่างน้อย 2 คน'),
  principalAmount: z.number().min(1, 'กรุณากรอกเงินต้น'),
  interestRate: z.number().optional().nullable(),
  managementFee: z.number().optional().nullable(),
  cycleType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  cycleDays: z.number().optional(),
  startDate: z.string(),
  deductionTemplates: z.array(deductionTemplateSchema).optional(),
});

// GET /api/share-groups - List all share groups for tenant
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, type } = req.query;

    // Build where clause
    const where: any = { tenantId: req.user!.tenantId };

    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    if (type && typeof type === 'string' && type !== 'all') {
      where.type = type;
    }

    const groups = await prisma.shareGroup.findMany({
      where,
      include: {
        host: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rounds: {
          select: {
            id: true,
            roundNumber: true,
            status: true,
          },
          orderBy: { roundNumber: 'asc' },
        },
        _count: {
          select: { members: true, rounds: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Add progress info to each group
    const groupsWithProgress = groups.map(group => {
      const totalRounds = group.maxMembers;
      const completedRounds = group.rounds.filter(r => r.status === 'COMPLETED').length;
      const currentRound = group.rounds.find(r => r.status !== 'COMPLETED' && r.status !== 'SKIPPED');

      return {
        ...group,
        progress: {
          current: currentRound?.roundNumber || completedRounds,
          total: totalRounds,
          completed: completedRounds,
          percentage: totalRounds > 0 ? Math.round((completedRounds / totalRounds) * 100) : 0,
        },
      };
    });

    res.json({
      success: true,
      data: groupsWithProgress,
    });
  } catch (error) {
    console.error('Get share groups error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/share-groups/:id - Get single share group with details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
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
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            rounds: {
              select: {
                id: true,
                roundNumber: true,
              },
            },
          },
          orderBy: { memberCode: 'asc' },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
        deductionTemplates: {
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Add hasWon flag to each member
    const membersWithStatus = group.members.map(member => ({
      ...member,
      hasWon: member.rounds.length > 0,
      wonRoundNumber: member.rounds[0]?.roundNumber || null,
    }));

    // Calculate summary
    const wonCount = membersWithStatus.filter(m => m.hasWon).length;
    const notWonCount = membersWithStatus.filter(m => !m.hasWon).length;

    res.json({
      success: true,
      data: {
        ...group,
        members: membersWithStatus,
        summary: {
          wonCount,
          notWonCount,
          totalMembers: group.members.length,
          maxMembers: group.maxMembers,
        },
      },
    });
  } catch (error) {
    console.error('Get share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/share-groups - Create new share group
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = createGroupSchema.parse(req.body);

    // Use transaction to create group, deduction templates, and rounds together
    const group = await prisma.$transaction(async (tx) => {
      // Create the share group
      const newGroup = await tx.shareGroup.create({
        data: {
          tenantId: req.user!.tenantId,
          hostId: req.user!.userId,
          name: data.name,
          type: data.type,
          maxMembers: data.maxMembers,
          principalAmount: data.principalAmount,
          interestRate: data.interestRate || null,
          managementFee: data.managementFee || null,
          cycleType: data.cycleType || 'MONTHLY',
          cycleDays: data.cycleDays || 0,
          startDate: new Date(data.startDate),
          status: 'DRAFT',
        },
      });

      // Create deduction templates if provided
      if (data.deductionTemplates && data.deductionTemplates.length > 0) {
        await tx.groupDeductionTemplate.createMany({
          data: data.deductionTemplates.map(d => ({
            shareGroupId: newGroup.id,
            name: d.name,
            amount: d.amount,
          })),
        });
      }

      // Generate rounds automatically
      const rounds = [];
      let currentDate = new Date(data.startDate);
      const cycleType = data.cycleType || 'MONTHLY';
      const cycleDays = data.cycleDays || 0;

      for (let i = 1; i <= data.maxMembers; i++) {
        rounds.push({
          shareGroupId: newGroup.id,
          roundNumber: i,
          dueDate: new Date(currentDate),
          status: 'PENDING' as const,
        });

        // Calculate next due date based on cycle type
        if (cycleType === 'DAILY') {
          currentDate.setDate(currentDate.getDate() + (cycleDays || 1));
        } else if (cycleType === 'WEEKLY') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          // MONTHLY
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }

      await tx.round.createMany({
        data: rounds,
      });

      // Return group with relations
      return tx.shareGroup.findUnique({
        where: { id: newGroup.id },
        include: {
          host: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          deductionTemplates: true,
          rounds: {
            orderBy: { roundNumber: 'asc' },
          },
        },
      });
    });

    res.status(201).json({
      success: true,
      data: group,
      message: 'สร้างวงแชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Create share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/share-groups/:id - Update share group
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = createGroupSchema.partial().parse(req.body);

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    if (group.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถแก้ไขวงที่เปิดแล้ว',
      });
    }

    // Use transaction to update group and deduction templates
    const updatedGroup = await prisma.$transaction(async (tx) => {
      // Update the share group
      await tx.shareGroup.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          type: data.type,
          maxMembers: data.maxMembers,
          principalAmount: data.principalAmount,
          interestRate: data.interestRate,
          managementFee: data.managementFee,
          cycleType: data.cycleType,
          cycleDays: data.cycleDays,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
        },
      });

      // Update deduction templates if provided
      if (data.deductionTemplates !== undefined) {
        // Delete existing templates
        await tx.groupDeductionTemplate.deleteMany({
          where: { shareGroupId: parseInt(id) },
        });

        // Create new templates
        if (data.deductionTemplates.length > 0) {
          await tx.groupDeductionTemplate.createMany({
            data: data.deductionTemplates.map(d => ({
              shareGroupId: parseInt(id),
              name: d.name,
              amount: d.amount,
            })),
          });
        }
      }

      // Return updated group with relations
      return tx.shareGroup.findUnique({
        where: { id: parseInt(id) },
        include: {
          deductionTemplates: true,
        },
      });
    });

    res.json({
      success: true,
      data: updatedGroup,
      message: 'แก้ไขวงแชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Update share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/share-groups/:id - Delete share group
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    if (group.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบวงที่เปิดแล้ว',
      });
    }

    await prisma.shareGroup.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบวงแชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
