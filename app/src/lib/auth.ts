import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { admin } from './config';

export function isAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');

  if (!admin.password) return false;
  if (token.length !== admin.password.length) return false;

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(admin.password)
  );
}
