import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@/lib/constants';

const COOKIE = 'rezzerv_session';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 gün

export type SessionPayload = { uid: string; role: Role; name: string };

function secret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      'AUTH_SECRET tanımlı değil veya 32 karakterden kısa. .env dosyanızı .env.example ile karşılaştırın.',
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('rezzerv')
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'rezzerv' });
    const uid = payload['uid'];
    const role = payload['role'];
    const name = payload['name'];
    if (typeof uid !== 'string' || typeof role !== 'string' || typeof name !== 'string') return null;
    return { uid, role: role as Role, name };
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export const SESSION_COOKIE = COOKIE;
