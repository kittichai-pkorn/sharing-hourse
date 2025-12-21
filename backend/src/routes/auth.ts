import { Router } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateUserToken } from '../utils/jwt.js';
import { generateUniqueSlug } from '../utils/slug.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  tenantName: z.string().min(1, 'กรุณากรอกชื่อวง'),
  tenantSlug: z.string().optional(),
  adminFirstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  adminLastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  adminPhone: z.string().min(10, 'เบอร์โทรไม่ถูกต้อง'),
  adminEmail: z.string().email('Email ไม่ถูกต้อง').optional().or(z.literal('')),
  adminPassword: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
});

const loginSchema = z.object({
  tenantSlug: z.string().min(1, 'กรุณากรอกรหัสวง'),
  identifier: z.string().min(1, 'กรุณากรอกเบอร์โทรหรือ Email'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  rememberMe: z.boolean().optional(),
});

// POST /api/auth/register - Register new tenant
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

    // Generate unique slug
    const slug = data.tenantSlug || await generateUniqueSlug(data.tenantName);

    // Check if slug already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (existingTenant) {
      return res.status(400).json({
        success: false,
        error: 'รหัสวงนี้มีอยู่แล้ว',
      });
    }

    // Check if phone already exists in any tenant
    const existingPhone = await prisma.user.findFirst({
      where: { phone: data.adminPhone },
    });

    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'เบอร์โทรนี้ถูกใช้งานแล้ว',
      });
    }

    // Check if email already exists (if provided)
    if (data.adminEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: data.adminEmail },
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email นี้ถูกใช้งานแล้ว',
        });
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.adminPassword);

    // Create tenant and admin user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName,
          slug,
          status: 'PENDING',
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          phone: data.adminPhone,
          email: data.adminEmail || null,
          password: hashedPassword,
          role: 'ADMIN',
        },
      });

      return { tenant, user };
    });

    res.status(201).json({
      success: true,
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          status: result.tenant.status,
        },
        user: {
          id: result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          email: result.user.email,
          role: result.user.role,
        },
      },
      message: 'ลงทะเบียนสำเร็จ รอการอนุมัติจาก Admin',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
      });
    }

    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    });
  }
});

// POST /api/auth/login - Multi-tenant login
router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    // Find tenant by slug
    const tenant = await prisma.tenant.findUnique({
      where: { slug: data.tenantSlug },
    });

    if (!tenant) {
      return res.status(401).json({
        success: false,
        error: 'ไม่พบรหัสวงนี้ในระบบ',
      });
    }

    // Check tenant status
    if (tenant.status === 'PENDING') {
      return res.status(401).json({
        success: false,
        error: 'วงยังไม่ได้รับการอนุมัติ',
      });
    }

    if (tenant.status === 'SUSPENDED') {
      return res.status(401).json({
        success: false,
        error: 'วงถูกระงับการใช้งาน',
      });
    }

    if (tenant.status === 'CANCELLED') {
      return res.status(401).json({
        success: false,
        error: 'วงถูกยกเลิกแล้ว',
      });
    }

    // Find user by phone or email within tenant
    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { phone: data.identifier },
          { email: data.identifier },
        ],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'เบอร์โทร/Email หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // Only ADMIN can login (ลูกแชร์ไม่สามารถ login ได้)
    if (user.role === 'USER') {
      return res.status(403).json({
        success: false,
        error: 'ลูกแชร์ไม่สามารถเข้าสู่ระบบได้',
      });
    }

    // Verify password
    const isValidPassword = await comparePassword(data.password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'เบอร์โทร/Email หรือรหัสผ่านไม่ถูกต้อง',
      });
    }

    // Generate token
    const token = generateUserToken(
      {
        userId: user.id,
        tenantId: tenant.id,
        role: user.role,
      },
      data.rememberMe
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
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

    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    });
  }
});

export default router;
