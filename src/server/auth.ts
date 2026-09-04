import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { Role } from '@/lib/constants';
import { readSessionCookie } from './session';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  avatarSeed: string;
};

/** Aynı istekte tekrar tekrar sorgu atmamak için React cache. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await readSessionCookie();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, name: true, role: true, phone: true, avatarSeed: true, active: true },
  });
  if (!user || !user.active) return null;
  const { active: _active, ...rest } = user;
  return { ...rest, role: rest.role as Role };
});

/** Sayfalarda kullanılır: oturum yoksa girişe yönlendirir. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    redirect(nextPath ? `/giris?next=${encodeURIComponent(nextPath)}` : '/giris');
  }
  return user;
}

export async function requireRole(roles: Role[], nextPath?: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.role)) redirect('/yetkisiz');
  return user;
}

/** Server action'larda kullanılır: yönlendirme yerine hata fırlatır. */
export class AuthError extends Error {
  constructor(message = 'Bu işlem için giriş yapmalısınız.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Bu kaydı görme veya değiştirme yetkiniz yok.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function requireUserAction(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError();
  return user;
}

export async function requireRoleAction(roles: Role[]): Promise<SessionUser> {
  const user = await requireUserAction();
  if (!roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

/**
 * İşletme erişim kontrolü — panelin tek kapısı.
 * ADMIN her işletmeye, OWNER kendi işletmelerine, STAFF yalnızca bağlı olduğu
 * işletmeye erişir. Butonu gizlemek yetki değildir; her sunucu işlemi buradan geçer.
 */
export async function assertBusinessAccess(
  user: SessionUser,
  businessId: string,
): Promise<void> {
  if (user.role === 'ADMIN') return;
  if (user.role === 'OWNER') {
    const owned = await prisma.business.findFirst({
      where: { id: businessId, ownerId: user.id },
      select: { id: true },
    });
    if (owned) return;
  }
  if (user.role === 'STAFF') {
    const staff = await prisma.staffMember.findFirst({
      where: { businessId, userId: user.id, active: true },
      select: { id: true },
    });
    if (staff) return;
  }
  throw new ForbiddenError();
}

/** Kullanıcının yönetebildiği işletmeler (panel seçici için). */
export async function accessibleBusinesses(user: SessionUser) {
  if (user.role === 'ADMIN') {
    return prisma.business.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, status: true },
    });
  }
  if (user.role === 'OWNER') {
    return prisma.business.findMany({
      where: { ownerId: user.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, status: true },
    });
  }
  const staff = await prisma.staffMember.findMany({
    where: { userId: user.id, active: true },
    select: { business: { select: { id: true, name: true, slug: true, status: true } } },
  });
  return staff.map((s) => s.business);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Sayfa/layout içinde kullanılır: yetki yoksa hata yerine yönlendirme. */
export async function requireBusinessAccess(user: SessionUser, businessId: string): Promise<void> {
  try {
    await assertBusinessAccess(user, businessId);
  } catch {
    redirect('/yetkisiz');
  }
}
