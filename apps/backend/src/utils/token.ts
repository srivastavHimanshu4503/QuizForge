import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
}

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const TOKEN_EXPIRY = '7d';

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (
      !payload.sub ||
      typeof payload.email !== 'string' ||
      typeof payload.displayName !== 'string'
    ) {
      return null;
    }

    const role =
      payload.role === 'teacher' || payload.role === 'admin'
        ? payload.role
        : 'student';

    return {
      sub: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      role,
    };
  } catch {
    return null;
  }
}
