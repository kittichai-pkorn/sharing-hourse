import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const SUPERADMIN_JWT_SECRET = process.env.SUPERADMIN_JWT_SECRET || 'superadmin-secret';

export interface UserTokenPayload {
  userId: number;
  tenantId: number;
  role: 'ADMIN' | 'USER';
}

export interface SuperAdminTokenPayload {
  userId: number;
  role: 'SUPER_ADMIN';
}

export function generateUserToken(payload: UserTokenPayload, rememberMe = false): string {
  const expiresIn = rememberMe ? '7d' : '24h';
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function generateSuperAdminToken(payload: SuperAdminTokenPayload): string {
  return jwt.sign(payload, SUPERADMIN_JWT_SECRET, { expiresIn: '24h' });
}

export function verifyUserToken(token: string): UserTokenPayload {
  return jwt.verify(token, JWT_SECRET) as UserTokenPayload;
}

export function verifySuperAdminToken(token: string): SuperAdminTokenPayload {
  return jwt.verify(token, SUPERADMIN_JWT_SECRET) as SuperAdminTokenPayload;
}
