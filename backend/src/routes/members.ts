import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = Router();

// Generate member code: A001, A002, ..., A999, B001, ...
function generateMemberCode(index: number): string {
  const letterIndex = Math.floor(index / 999);
  const numberPart = (index % 999) + 1;
  const letter = String.fromCharCode(65 + (letterIndex % 26));
  return `${letter}${numberPart.toString().padStart(3, '0')}`;
}

// Get next available member code for tenant (always increments, no reuse)
async function getNextMemberCode(tenantId: number): Promise<string> {
  const lastMember = await prisma.member.findFirst({
    where: { tenantId },
    orderBy: { id: 'desc' },
    select: { memberCode: true },
  });

  if (!lastMember) {
    return 'A001';
  }

  // Parse the last member code (e.g., "A001" -> letter "A", number 1)
  const match = lastMember.memberCode.match(/^([A-Z])(\d{3})$/);
  if (!match) {
    return 'A001';
  }

  const letter = match[1];
  const number = parseInt(match[2], 10);

  // If number is 999, move to next letter
  if (number >= 999) {
    const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
    return `${nextLetter}001`;
  }

  // Otherwise, just increment the number
  return `${letter}${(number + 1).toString().padStart(3, '0')}`;
}

// Validation schemas
const createMemberSchema = z.object({
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น'),
  address: z.string().optional(),
  phone: z.string().optional(),
  lineId: z.string().optional(),
});

const updateMemberSchema = z.object({
  nickname: z.string().min(1, 'กรุณากรอกชื่อเล่น').optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  lineId: z.string().optional().nullable(),
});

const addToGroupSchema = z.object({
  memberId: z.number({ required_error: 'กรุณาเลือกลูกแชร์' }),
  nickname: z.string().optional(),
});

// ==================== Member (ลูกแชร์ในระบบ) ====================

// GET /api/members - Get all members in tenant
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { excludeGroupId } = req.query;

    let members = await prisma.member.findMany({
      where: { tenantId: req.user!.tenantId },
      orderBy: { memberCode: 'asc' },
    });

    // Exclude members already in a group if specified
    if (excludeGroupId) {
      const groupMembers = await prisma.groupMember.findMany({
        where: { shareGroupId: parseInt(excludeGroupId as string) },
        select: { memberId: true },
      });
      const excludeIds = new Set(groupMembers.map(gm => gm.memberId));
      members = members.filter(m => !excludeIds.has(m.id));
    }

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

// GET /api/members/:id - Get single member
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        groupMembers: {
          include: {
            shareGroup: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    res.json({
      success: true,
      data: member,
    });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/members - Create new member
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = createMemberSchema.parse(req.body);

    // Auto-generate member code
    const memberCode = await getNextMemberCode(req.user!.tenantId);

    const member = await prisma.member.create({
      data: {
        tenantId: req.user!.tenantId,
        memberCode,
        nickname: data.nickname,
        address: data.address || null,
        phone: data.phone || null,
        lineId: data.lineId || null,
      },
    });

    res.status(201).json({
      success: true,
      data: member,
      message: 'เพิ่มลูกแชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Create member error:', error);
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

    // Verify member belongs to tenant
    const member = await prisma.member.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    const updatedMember = await prisma.member.update({
      where: { id: parseInt(id) },
      data: {
        nickname: data.nickname,
        address: data.address,
        phone: data.phone,
        lineId: data.lineId,
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

// DELETE /api/members/:id - Delete member from system
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify member belongs to tenant
    const member = await prisma.member.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
      include: {
        groupMembers: true,
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    // Check if member is in any groups
    if (member.groupMembers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบลูกแชร์ที่อยู่ในวงแชร์ได้',
      });
    }

    await prisma.member.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบลูกแชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// ==================== GroupMember (ลูกแชร์ในวง) ====================

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

    const groupMembers = await prisma.groupMember.findMany({
      where: { shareGroupId: parseInt(groupId) },
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
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      success: true,
      data: groupMembers,
    });
  } catch (error) {
    console.error('Get group members error:', error);
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
    const data = addToGroupSchema.parse(req.body);

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

    // Check if group is still in draft
    if (shareGroup.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถเพิ่มลูกแชร์หลังวงเปิดแล้ว',
      });
    }

    // Check member count
    const memberCount = await prisma.groupMember.count({
      where: { shareGroupId: parseInt(groupId) },
    });

    if (memberCount >= shareGroup.maxMembers) {
      return res.status(400).json({
        success: false,
        error: 'ลูกแชร์ครบแล้ว',
      });
    }

    // Verify member exists and belongs to tenant
    const member = await prisma.member.findFirst({
      where: {
        id: data.memberId,
        tenantId: req.user!.tenantId,
      },
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    // Check if member already in group
    const existingGroupMember = await prisma.groupMember.findFirst({
      where: {
        shareGroupId: parseInt(groupId),
        memberId: data.memberId,
      },
    });

    if (existingGroupMember) {
      return res.status(400).json({
        success: false,
        error: 'ลูกแชร์นี้อยู่ในวงแล้ว',
      });
    }

    const groupMember = await prisma.groupMember.create({
      data: {
        shareGroupId: parseInt(groupId),
        memberId: data.memberId,
        nickname: data.nickname || null,
      },
      include: {
        member: true,
      },
    });

    res.status(201).json({
      success: true,
      data: groupMember,
      message: 'เพิ่มลูกแชร์เข้าวงเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Add to group error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/members/group-member/:id - Remove member from group
router.delete('/group-member/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify the member belongs to a group in user's tenant
    const groupMember = await prisma.groupMember.findFirst({
      where: { id: parseInt(id) },
      include: {
        shareGroup: true,
      },
    });

    if (!groupMember || groupMember.shareGroup.tenantId !== req.user!.tenantId) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบลูกแชร์',
      });
    }

    // Check if group is already open
    if (groupMember.shareGroup.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบลูกแชร์หลังวงเปิดแล้ว',
      });
    }

    // Check if member has won any rounds
    const hasWonRounds = await prisma.round.findFirst({
      where: { winnerId: parseInt(id) },
    });

    if (hasWonRounds) {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบลูกแชร์ที่เปียแล้วได้',
      });
    }

    await prisma.groupMember.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบลูกแชร์ออกจากวงเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete group member error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
