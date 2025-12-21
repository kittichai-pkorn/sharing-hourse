import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateSuperAdminToken } from '../utils/jwt.js';
import { superAdminMiddleware } from '../middlewares/auth.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Email ไม่ถูกต้อง'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CANCELLED']),
});

// POST /api/superadmin/login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: data.email },
    });

    if (!superAdmin) {
      return res.status(401).json({
        success: false,
        error: 'Email หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const isValidPassword = await comparePassword(data.password, superAdmin.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Email หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    const token = generateSuperAdminToken({
      userId: superAdmin.id,
      role: 'SUPER_ADMIN',
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('SuperAdmin login error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    });
  }
});

// GET /api/superadmin/me
router.get('/me', superAdminMiddleware, async (req, res) => {
  try {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: req.superAdmin!.userId },
      select: { id: true, email: true },
    });

    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูล',
      });
    }

    res.json({
      success: true,
      data: superAdmin,
    });
  } catch (error) {
    console.error('Get superadmin error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/superadmin/stats
router.get('/stats', superAdminMiddleware, async (req, res) => {
  try {
    const [totalTenants, activeTenants, pendingTenants, totalUsers, totalShareGroups] =
      await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count({ where: { status: 'PENDING' } }),
        prisma.user.count(),
        prisma.shareGroup.count(),
      ]);

    res.json({
      success: true,
      data: {
        tenants: {
          total: totalTenants,
          active: activeTenants,
          pending: pendingTenants,
        },
        users: {
          total: totalUsers,
        },
        shareGroups: {
          total: totalShareGroups,
        },
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// GET /api/superadmin/tenants
router.get('/tenants', superAdminMiddleware, async (req, res) => {
  try {
    const { search, status, page = '1', limit = '10' } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { slug: { contains: search as string } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              shareGroups: true,
            },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({
      success: true,
      data: tenants,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        totalPages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// PUT /api/superadmin/tenants/:id/status
router.put('/tenants/:id/status', superAdminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateStatusSchema.parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: parseInt(id) },
      data: { status: data.status },
    });

    const statusMessages: Record<string, string> = {
      ACTIVE: 'อนุมัติวงเรียบร้อยแล้ว',
      SUSPENDED: 'ระงับวงเรียบร้อยแล้ว',
      CANCELLED: 'ยกเลิกวงเรียบร้อยแล้ว',
    };

    res.json({
      success: true,
      data: tenant,
      message: statusMessages[data.status],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Update tenant status error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

// DELETE /api/superadmin/tenants/:id
router.delete('/tenants/:id', superAdminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.tenant.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: 'ลบวงเรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด',
    });
  }
});

export default router;
