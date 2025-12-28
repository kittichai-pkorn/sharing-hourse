import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';
import { notifyGroupOpened } from '../services/notificationService.js';

const router = Router();


// Validation schemas
const deductionTemplateSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อรายการ'),
  amount: z.number().min(0, 'จำนวนเงินต้องไม่ติดลบ'),
});

const roundScheduleSchema = z.object({
  roundNumber: z.number(),
  dueDate: z.string(),
});

const createGroupSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อวง'),
  type: z.enum(['STEP_INTEREST', 'BID_INTEREST', 'FIXED_INTEREST', 'BID_PRINCIPAL', 'BID_PRINCIPAL_FIRST']),
  maxMembers: z.number().min(2, 'ต้องมีสมาชิกอย่างน้อย 2 คน'),
  principalAmount: z.number().min(1, 'กรุณากรอกเงินต้น'),
  paymentPerRound: z.number().optional().nullable(), // ส่งต่องวด (for FIXED_INTEREST, BID_INTEREST)
  interestRate: z.number().optional().nullable(),
  managementFee: z.number().optional().nullable(),
  cycleType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  cycleDays: z.number().optional(),
  startDate: z.string(),
  deductionTemplates: z.array(deductionTemplateSchema).optional(),
  rounds: z.array(roundScheduleSchema).optional(), // Custom round dates
  tailDeductionRounds: z.number().optional().nullable(), // จำนวนงวดท้ายที่จะหัก
});

// GET /api/share-groups - List all share groups for tenant
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, status, type, role, excludeId } = req.query;

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

    // Filter by role (host = only groups where user is host)
    if (role === 'host') {
      where.hostId = req.user!.userId;
    }

    // Exclude specific group (for import from other groups)
    if (excludeId && typeof excludeId === 'string') {
      where.id = { not: parseInt(excludeId) };
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
            member: true,
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
          orderBy: { joinedAt: 'asc' },
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
          paymentPerRound: data.paymentPerRound || null,
          interestRate: data.interestRate || null,
          managementFee: data.managementFee || null,
          cycleType: data.cycleType || 'MONTHLY',
          cycleDays: data.cycleDays || 0,
          startDate: new Date(data.startDate),
          status: 'DRAFT',
          tailDeductionRounds: data.tailDeductionRounds || null,
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

      // Create host as first member (ท้าวแชร์)
      const hostMember = await tx.groupMember.create({
        data: {
          shareGroupId: newGroup.id,
          userId: req.user!.userId,
          nickname: 'ท้าวแชร์',
        },
      });

      // Generate rounds - use custom dates if provided, otherwise calculate
      const customRounds = data.rounds || [];
      const getCustomDate = (roundNum: number) => {
        const custom = customRounds.find(r => r.roundNumber === roundNum);
        return custom ? new Date(custom.dueDate) : null;
      };

      let currentDate = new Date(data.startDate);
      const cycleType = data.cycleType || 'MONTHLY';
      const cycleDays = data.cycleDays || 0;

      // Create first round assigned to host (งวดแรก = ท้าวแชร์ได้เงินเสมอ)
      await tx.round.create({
        data: {
          shareGroupId: newGroup.id,
          roundNumber: 1,
          dueDate: getCustomDate(1) || new Date(currentDate),
          status: 'PENDING',
          winnerId: hostMember.id,
        },
      });

      // Calculate next due date for remaining rounds
      if (cycleType === 'DAILY') {
        currentDate.setDate(currentDate.getDate() + (cycleDays || 1));
      } else if (cycleType === 'WEEKLY') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else {
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // Create remaining rounds (round 2 onwards)
      const remainingRounds = [];
      for (let i = 2; i <= data.maxMembers; i++) {
        remainingRounds.push({
          shareGroupId: newGroup.id,
          roundNumber: i,
          dueDate: getCustomDate(i) || new Date(currentDate),
          status: 'PENDING' as const,
        });

        // Calculate next due date based on cycle type
        if (cycleType === 'DAILY') {
          currentDate.setDate(currentDate.getDate() + (cycleDays || 1));
        } else if (cycleType === 'WEEKLY') {
          currentDate.setDate(currentDate.getDate() + 7);
        } else {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      }

      if (remainingRounds.length > 0) {
        await tx.round.createMany({
          data: remainingRounds,
        });
      }

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
          paymentPerRound: data.paymentPerRound,
          interestRate: data.interestRate,
          managementFee: data.managementFee,
          cycleType: data.cycleType,
          cycleDays: data.cycleDays,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          tailDeductionRounds: data.tailDeductionRounds,
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

// ==================== Group Status Management ====================

// POST /api/share-groups/:id/open - Open a share group
router.post('/:id/open', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        members: true,
        rounds: true,
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
        error: 'ไม่สามารถเปิดวงที่ไม่ใช่สถานะร่าง',
      });
    }

    // Check if members are complete
    if (group.members.length < group.maxMembers) {
      return res.status(400).json({
        success: false,
        error: `สมาชิกไม่ครบ (${group.members.length}/${group.maxMembers} คน)`,
      });
    }

    // Check if rounds exist
    if (group.rounds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ยังไม่มีตารางงวด กรุณาสร้างตารางงวดก่อน',
      });
    }

    // Update status to OPEN
    const updatedGroup = await prisma.shareGroup.update({
      where: { id: parseInt(id) },
      data: { status: 'OPEN' },
      include: {
        members: {
          include: {
            member: true,
          },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    // Create notification for group opened
    try {
      await notifyGroupOpened({
        id: group.id,
        name: group.name,
        tenantId: group.tenantId,
        hostId: group.hostId,
      });
    } catch (notifyError) {
      console.error('Notification error:', notifyError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: updatedGroup,
      message: 'เปิดวงเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Open share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/share-groups/:id/cancel - Cancel a share group
router.post('/:id/cancel', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

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
        error: 'ไม่สามารถยกเลิกวงที่เปิดแล้วได้',
      });
    }

    // Update status to CANCELLED
    const updatedGroup = await prisma.shareGroup.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
        // Note: If you want to store reason, add cancelReason field to schema
      },
    });

    res.json({
      success: true,
      data: updatedGroup,
      message: 'ยกเลิกวงเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Cancel share group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// ==================== Deduction Templates ====================

// GET /api/share-groups/:id/deductions - List deduction templates
router.get('/:id/deductions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
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

    const total = group.deductionTemplates.reduce((sum, d) => sum + d.amount, 0);

    res.json({
      success: true,
      data: {
        templates: group.deductionTemplates,
        total,
      },
    });
  } catch (error) {
    console.error('Get deduction templates error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/share-groups/:id/deduction-templates - Get deductions from rounds for import
router.get('/:id/deduction-templates', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        rounds: {
          include: {
            deductions: true,
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Collect unique deductions from all rounds (by note)
    const deductionMap = new Map<string, number>();

    for (const round of group.rounds) {
      for (const deduction of round.deductions) {
        if (deduction.note) {
          // Filter out system deductions (ค่าดูแลวง, ดอกเบี้ย, INTEREST, HOST_FEE)
          if (
            deduction.type !== 'INTEREST' &&
            deduction.type !== 'HOST_FEE' &&
            deduction.note !== 'ค่าดูแลวง' &&
            !deduction.note.includes('ดอกเบี้ย')
          ) {
            // Use the latest amount for each unique note
            deductionMap.set(deduction.note, deduction.amount);
          }
        }
      }
    }

    // Convert map to array
    const templates = Array.from(deductionMap.entries()).map(([name, amount], index) => ({
      id: index + 1,
      name,
      amount,
    }));

    res.json({
      success: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        managementFee: group.managementFee,
        interestRate: group.interestRate,
        templates,
      },
    });
  } catch (error) {
    console.error('Get deduction templates for import error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/share-groups/:id/deductions - Add deduction template
router.post('/:id/deductions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = deductionTemplateSchema.parse(req.body);

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
        error: 'ไม่สามารถแก้ไขรายการหักรับหลังเปิดวงแล้ว',
      });
    }

    const template = await prisma.groupDeductionTemplate.create({
      data: {
        shareGroupId: parseInt(id),
        name: data.name,
        amount: data.amount,
      },
    });

    res.status(201).json({
      success: true,
      data: template,
      message: 'เพิ่มรายการหักรับเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Add deduction template error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/share-groups/:id/deductions/:deductionId - Update deduction template
router.put('/:id/deductions/:deductionId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id, deductionId } = req.params;
    const data = deductionTemplateSchema.parse(req.body);

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
        error: 'ไม่สามารถแก้ไขรายการหักรับหลังเปิดวงแล้ว',
      });
    }

    // Verify template belongs to this group
    const template = await prisma.groupDeductionTemplate.findFirst({
      where: {
        id: parseInt(deductionId),
        shareGroupId: parseInt(id),
      },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบรายการหักรับ',
      });
    }

    const updatedTemplate = await prisma.groupDeductionTemplate.update({
      where: { id: parseInt(deductionId) },
      data: {
        name: data.name,
        amount: data.amount,
      },
    });

    res.json({
      success: true,
      data: updatedTemplate,
      message: 'แก้ไขรายการหักรับเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Update deduction template error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/share-groups/:id/deductions/:deductionId - Delete deduction template
router.delete('/:id/deductions/:deductionId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id, deductionId } = req.params;

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
        error: 'ไม่สามารถลบรายการหักรับหลังเปิดวงแล้ว',
      });
    }

    // Verify template belongs to this group
    const template = await prisma.groupDeductionTemplate.findFirst({
      where: {
        id: parseInt(deductionId),
        shareGroupId: parseInt(id),
      },
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบรายการหักรับ',
      });
    }

    await prisma.groupDeductionTemplate.delete({
      where: { id: parseInt(deductionId) },
    });

    res.json({
      success: true,
      message: 'ลบรายการหักรับเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete deduction template error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// ==================== Reports ====================

// GET /api/share-groups/:id/summary - Get group financial summary
router.get('/:id/summary', authMiddleware, async (req, res) => {
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
            member: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        rounds: {
          include: {
            winner: {
              include: {
                member: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            deductions: true,
          },
          orderBy: { roundNumber: 'asc' },
        },
        deductionTemplates: true,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Calculate summary
    const poolPerRound = group.principalAmount * group.maxMembers;
    const totalPool = poolPerRound * group.maxMembers;
    const completedRounds = group.rounds.filter(r => r.status === 'COMPLETED');

    let totalInterest = 0;
    let totalDeductions = 0;
    let totalPayout = 0;

    const roundsSummary = group.rounds.map(round => {
      const roundInterest = round.winningBid || 0;
      const roundDeductions = round.deductions.reduce((sum, d) => sum + d.amount, 0);
      const roundPayout = round.payoutAmount || 0;

      if (round.status === 'COMPLETED') {
        totalInterest += roundInterest;
        totalDeductions += roundDeductions;
        totalPayout += roundPayout;
      }

      // Get winner name
      let winnerName = '-';
      if (round.winner) {
        if (round.winner.user) {
          winnerName = `${round.winner.user.firstName} ${round.winner.user.lastName}`;
        } else if (round.winner.member) {
          winnerName = round.winner.member.nickname;
        } else if (round.winner.nickname) {
          winnerName = round.winner.nickname;
        }
      }

      return {
        roundNumber: round.roundNumber,
        dueDate: round.dueDate,
        status: round.status,
        winnerName,
        winnerId: round.winnerId,
        interest: roundInterest,
        deductions: roundDeductions,
        payout: roundPayout,
      };
    });

    // Get type label
    const typeLabels: Record<string, string> = {
      STEP_INTEREST: 'ขั้นบันได',
      BID_INTEREST: 'บิทดอกตาม',
      FIXED_INTEREST: 'ดอกตาม',
      BID_PRINCIPAL: 'บิทลดต้น (หักดอกท้าย)',
      BID_PRINCIPAL_FIRST: 'บิทลดต้น (หักดอกหน้า)',
    };

    res.json({
      success: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          type: group.type,
          typeLabel: typeLabels[group.type] || group.type,
          status: group.status,
          maxMembers: group.maxMembers,
          principalAmount: group.principalAmount,
          cycleType: group.cycleType,
          startDate: group.startDate,
          host: group.host,
        },
        financial: {
          principalPerRound: group.principalAmount,
          poolPerRound,
          totalPool,
          completedRounds: completedRounds.length,
          totalRounds: group.maxMembers,
          totalInterest,
          totalDeductions,
          totalPayout,
        },
        rounds: roundsSummary,
        deductionTemplates: group.deductionTemplates,
      },
    });
  } catch (error) {
    console.error('Get group summary error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/share-groups/:id/members/history - Get member participation history
router.get('/:id/members/history', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        members: {
          include: {
            member: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            rounds: {
              include: {
                deductions: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Calculate member history
    const membersHistory = group.members.map((member, index) => {
      const wonRound = member.rounds[0]; // Each member can only win once
      const isHost = member.userId === group.hostId;

      // Get member name
      let name = member.nickname || '';
      if (member.user) {
        name = `${member.user.firstName} ${member.user.lastName}`;
      } else if (member.member) {
        name = member.member.nickname;
      }

      // Calculate interest and payout
      const interest = wonRound?.winningBid || 0;
      const payout = wonRound?.payoutAmount || 0;

      return {
        order: index + 1,
        id: member.id,
        name,
        nickname: member.nickname,
        isHost,
        hasWon: !!wonRound,
        roundNumber: wonRound?.roundNumber || null,
        dueDate: wonRound?.dueDate || null,
        interest,
        payout,
      };
    });

    // Calculate statistics (only for members who have won)
    const wonMembers = membersHistory.filter(m => m.hasWon);
    const interestValues = wonMembers.map(m => m.interest);

    const stats = {
      totalMembers: group.members.length,
      wonCount: wonMembers.length,
      pendingCount: group.members.length - wonMembers.length,
      minInterest: interestValues.length > 0 ? Math.min(...interestValues) : 0,
      maxInterest: interestValues.length > 0 ? Math.max(...interestValues) : 0,
      avgInterest: interestValues.length > 0
        ? interestValues.reduce((a, b) => a + b, 0) / interestValues.length
        : 0,
      minInterestMember: null as string | null,
      maxInterestMember: null as string | null,
    };

    // Find min/max interest members
    if (wonMembers.length > 0) {
      const minMember = wonMembers.find(m => m.interest === stats.minInterest);
      const maxMember = wonMembers.find(m => m.interest === stats.maxInterest);
      stats.minInterestMember = minMember?.name || null;
      stats.maxInterestMember = maxMember?.name || null;
    }

    res.json({
      success: true,
      data: {
        members: membersHistory,
        stats,
      },
    });
  } catch (error) {
    console.error('Get member history error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/share-groups/:id/payment-schedule - Get payment schedule for all members
router.get('/:id/payment-schedule', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await prisma.shareGroup.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        members: {
          include: {
            member: true,
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
          orderBy: { joinedAt: 'asc' },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
        },
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบวงแชร์',
      });
    }

    // Build rounds info
    const rounds = group.rounds.map(round => {
      // Find winner info
      const winner = group.members.find(m => m.rounds.some(r => r.roundNumber === round.roundNumber));
      let winnerName: string | null = null;

      if (winner) {
        if (winner.user) {
          winnerName = `${winner.user.firstName} ${winner.user.lastName}`;
        } else if (winner.member) {
          winnerName = winner.member.nickname;
        } else {
          winnerName = winner.nickname;
        }
      }

      return {
        roundNumber: round.roundNumber,
        dueDate: round.dueDate,
        winnerId: round.winnerId,
        winnerName,
        status: round.status,
      };
    });

    // Build payment schedule for each member
    const members = group.members.map((member, index) => {
      // Get member name
      let name = member.nickname || '';
      let memberCode: string | null = null;

      if (member.user) {
        name = `${member.user.firstName} ${member.user.lastName}`;
      } else if (member.member) {
        name = member.member.nickname;
        memberCode = member.member.memberCode;
      }

      const isHost = member.userId === group.hostId;
      const wonRound = member.rounds[0]; // Each member can only win once

      // Calculate payments for each round
      const payments = group.rounds.map(round => {
        const isWonRound = wonRound?.roundNumber === round.roundNumber;
        const isCompleted = round.status === 'COMPLETED';

        let status: 'PENDING' | 'PAID' | 'WON';
        let amount: number;

        if (isWonRound) {
          status = 'WON';
          amount = 0; // ไม่ต้องชำระ เพราะได้รับเงินแทน
        } else if (isCompleted) {
          status = 'PAID';
          amount = group.principalAmount;
        } else {
          status = 'PENDING';
          amount = group.principalAmount;
        }

        return {
          roundNumber: round.roundNumber,
          dueDate: round.dueDate,
          amount,
          status,
        };
      });

      // Calculate totals
      const totalPayment = payments
        .filter(p => p.status !== 'WON')
        .reduce((sum, p) => sum + p.amount, 0);
      const totalPaid = payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, p) => sum + p.amount, 0);

      return {
        id: member.id,
        order: index + 1,
        memberCode,
        nickname: member.nickname,
        name,
        isHost,
        wonRound: wonRound?.roundNumber || null,
        payments,
        totalPayment,
        totalPaid,
      };
    });

    res.json({
      success: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        principalAmount: group.principalAmount,
        totalRounds: group.maxMembers,
        rounds,
        members,
      },
    });
  } catch (error) {
    console.error('Get payment schedule error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
