import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { authMiddleware, adminMiddleware } from '../middlewares/auth.js';

const router = Router();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(6, 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'),
});

const addMemberSchema = z.object({
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  phone: z.string().min(10, 'เบอร์โทรไม่ถูกต้อง'),
  email: z.string().email('Email ไม่ถูกต้อง').optional().or(z.literal('')),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

// GET /api/users/me - Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลผู้ใช้',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/users/me - Update current user profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
      },
    });

    res.json({
      success: true,
      data: user,
      message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/users/me/password - Change password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลผู้ใช้',
      });
    }

    const isValidPassword = await comparePassword(data.currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
      });
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/users - Get all members in tenant (Admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.user!.tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// POST /api/users - Add new member (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const data = addMemberSchema.parse(req.body);

    // Check if phone already exists in this tenant
    const existingPhone = await prisma.user.findFirst({
      where: {
        tenantId: req.user!.tenantId,
        phone: data.phone,
      },
    });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'เบอร์โทรนี้มีอยู่ในระบบแล้ว',
      });
    }

    // Check if email already exists (if provided)
    if (data.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.email },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email นี้ถูกใช้งานแล้ว',
        });
      }
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        tenantId: req.user!.tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email || null,
        password: hashedPassword,
        role: 'USER',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        role: true,
      },
    });

    res.status(201).json({
      success: true,
      data: user,
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

// DELETE /api/users/:id - Remove member (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists and belongs to same tenant
    const user = await prisma.user.findFirst({
      where: {
        id: parseInt(id),
        tenantId: req.user!.tenantId,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบสมาชิก',
      });
    }

    // Cannot delete admin
    if (user.role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        error: 'ไม่สามารถลบท้าวแชร์ได้',
      });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบสมาชิกเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
