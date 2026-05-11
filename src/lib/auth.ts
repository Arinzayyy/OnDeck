import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import type { StudentJwtPayload } from './types';

const COOKIE_NAME = 'ondeck_student_token';
const ADMIN_COOKIE_NAME = 'ondeck_admin_token';
const TOKEN_TTL_DAYS = 30;

// ─── Secret key ───────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return new TextEncoder().encode(secret);
}

// ─── Student JWT ──────────────────────────────────────────────────────────────

export async function signStudentToken(
  payload: Omit<StudentJwtPayload, 'iat' | 'exp'>
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_DAYS}d`)
    .sign(getSecret());
}

export async function verifyStudentToken(
  token: string
): Promise<StudentJwtPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as StudentJwtPayload;
}

/**
 * Read + verify the student token from the incoming request cookies.
 * Returns null if missing or invalid (don't throw — let callers decide to 401).
 */
export async function getStudentFromRequest(
  req: NextRequest
): Promise<StudentJwtPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyStudentToken(token);
  } catch {
    return null;
  }
}

/**
 * Read + verify the student token from the Next.js cookie store (server components).
 */
export async function getStudentFromCookies(): Promise<StudentJwtPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyStudentToken(token);
  } catch {
    return null;
  }
}

/**
 * Returns the Set-Cookie header value for the student token.
 */
export function makeStudentCookie(token: string): string {
  const maxAge = TOKEN_TTL_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearStudentCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ─── Admin JWT ────────────────────────────────────────────────────────────────
// We use Supabase Auth for admin login, but we also issue our own short-lived
// JWT so server components can verify admin status without a Supabase round-trip.

export async function signAdminToken(email: string, id: string): Promise<string> {
  return new SignJWT({ email, id, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getSecret());
}

export async function getAdminFromRequest(
  req: NextRequest
): Promise<{ email: string; id: string } | null> {
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== 'admin') return null;
    if (!payload.email || !payload.id) return null;
    return { email: payload.email as string, id: payload.id as string };
  } catch {
    return null;
  }
}

export async function getAdminFromCookies(): Promise<{ email: string; id: string } | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== 'admin') return null;
    if (!payload.email || !payload.id) return null;
    return { email: payload.email as string, id: payload.id as string };
  } catch {
    return null;
  }
}

export function makeAdminCookie(token: string): string {
  return `${ADMIN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
