import { Request, Response, NextFunction } from 'express';
import { verifyUserToken, verifySuperAdminToken, UserTokenPayload, SuperAdminTokenPayload } from '../utils/jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      superAdmin?: SuperAdminTokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'กรุณาเข้าสู่ระบบ',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyUserToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token ไม่ถูกต้องหรือหมดอายุ',
    });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'กรุณาเข้าสู่ระบบ',
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'คุณไม่มีสิทธิ์เข้าถึง',
    });
  }

  next();
}

export function superAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'กรุณาเข้าสู่ระบบ',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifySuperAdminToken(token);
    req.superAdmin = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Token ไม่ถูกต้องหรือหมดอายุ',
    });
  }
}
