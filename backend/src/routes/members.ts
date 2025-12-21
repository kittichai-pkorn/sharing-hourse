import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = Router();

// Generate alphabetical member code: A, B, C, ..., Z, AA, AB, ...
function generateMemberCode(index: number): string {
  let code = '';
  let num = index;

  do {
    code = String.fromCharCode(65 + (num % 26)) + code;
    num = Math.floor(num / 26) - 1;
  } while (num >= 0);

  return code;
}

// Get next available member code for a group
async function getNextMemberCode(shareGroupId: number): Promise<string> {
  const members = await prisma.groupMember.findMany({
    where: { shareGroupId },
    select: { memberCode: true },
    orderBy: { memberCode: 'asc' },
  });

  const existingCodes = new Set(members.map(m => m.memberCode));

  let index = 0;
  while (true) {
    const code = generateMemberCode(index);
    if (!existingCodes.has(code)) {
      return code;
    }
    index++;
  }
}

// Validation schemas
const addMemberSchema = z.object({
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น'),
  address: z.string().optional(),
  phone: z.string().optional(),
  lineId: z.string().optional(),
  userId: z.number().optional(),
});

const updateMemberSchema = z.object({
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น').optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
});

// GET /api/members/group/:groupId - Get all members in a share group
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

    const members = await prisma.groupMember.findMany({
      where: { shareGroupId: parseInt(groupId) },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { memberCode: 'asc' },
    });

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/members/group/:groupId - Add member to share group
router.post('/group/:groupId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { groupId } = req.params;
    const data = addMemberSchema.parse(req.body);

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

    // Check member count
    const memberCount = await prisma.groupMember.count({
      where: { shareGroupId: parseInt(groupId) },
    });

    if (memberCount >= shareGroup.maxMembers) {
      return res.status(400).json({
        success: false,
        error: 'จำนวนสมาชิกเต็มแล้ว',
      });
    }

    // Auto-generate member code
    const memberCode = await getNextMemberCode(parseInt(groupId));

    const member = await prisma.groupMember.create({
      data: {
        shareGroupId: parseInt(groupId),
        memberCode,
        nickname: data.nickname,
        address: data.address || null,
        phone: data.phone || null,
        lineId: data.lineId || null,
        userId: data.userId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: member,
      message: 'เพิ่มสมาชิกเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/members/:id - Update member
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateMemberSchema.parse(req.body);

    // Verify the member belongs to a group in user's tenant
    const member = await prisma.groupMember.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: true,
      },
    });

    if (!member || member.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบสมาชิก',
      });
    }

    const updatedMember = await prisma.groupMember.update({
      where: { id: parseInt(id) },
      data: {
        nickname: data.nickname,
        address: data.address,
        phone: data.phone,
        lineId: data.lineId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: updatedMember,
      message: 'แก้ไขข้อมูลเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Update member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/members/:id - Remove member from group
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the member belongs to a group in user's tenant
    const member = await prisma.groupMember.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: true,
      },
    });

    if (!member || member.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบสมาชิก',
      });
    }

    // Check if group is already open
    if (member.shareGroup.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบสมาชิกหลังวงเปิดแล้ว',
      });
    }

    // Check if member has won any rounds
    const hasWonRounds = await prisma.round.findFirst({
      where: { winnerId: parseInt(id) },
    });

    if (hasWonRounds) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบสมาชิกที่เปียแล้วได้',
      });
    }

    await prisma.groupMember.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบสมาชิกเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
