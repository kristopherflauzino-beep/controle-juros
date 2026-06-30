import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserById, findUserByEmail } from './store';

const LOCAL_SECRET = 'juros-control-web-local-dev-secret-change-me';

function secret() {
  return process.env.JWT_SECRET || LOCAL_SECRET;
}

export async function hashPassword(password) {
  return bcrypt.hash(String(password || ''), 10);
}

export async function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(String(password), hash);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: '7d' });
}

export async function authenticate(email, password) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

export async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret());
    return await findUserById(payload.sub);
  } catch {
    return null;
  }
}
