import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import {
  assertBusinessAccess,
  accessibleBusinesses,
  hashPassword,
  verifyPassword,
  ForbiddenError,
  type SessionUser,
} from '@/server/auth';
import { signSession, verifySession } from '@/server/session';

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function session(over: Partial<SessionUser>): SessionUser {
  return {
    id: 'x',
    email: 'x@test.local',
    name: 'Test',
    role: 'CUSTOMER',
    phone: null,
    avatarSeed: '0',
    ...over,
  };
}

describe('işletme erişim kontrolü', () => {
  it('sahibi kendi işletmesine erişebilir', async () => {
    const user = session({ id: f.owner.id, role: 'OWNER' });
    await expect(assertBusinessAccess(user, f.business.id)).resolves.toBeUndefined();
  });

  it('başka bir sahip erişemez', async () => {
    const foreign = await createFixture();
    const user = session({ id: foreign.owner.id, role: 'OWNER' });
    await expect(assertBusinessAccess(user, f.business.id)).rejects.toThrow(ForbiddenError);
  });

  it('yönetici her işletmeye erişebilir', async () => {
    const user = session({ id: 'admin', role: 'ADMIN' });
    await expect(assertBusinessAccess(user, f.business.id)).resolves.toBeUndefined();
  });

  it('müşteri hiçbir işletmeye erişemez', async () => {
    const user = session({ id: f.customer.id, role: 'CUSTOMER' });
    await expect(assertBusinessAccess(user, f.business.id)).rejects.toThrow(ForbiddenError);
  });

  it('bağlı personel kendi işletmesine erişebilir', async () => {
    const staffUser = await prisma.user.create({
      data: { email: `p-${Date.now()}@test.local`, passwordHash: 'x', name: 'Personel', role: 'STAFF' },
    });
    await prisma.staffMember.update({
      where: { id: f.staffA.id },
      data: { userId: staffUser.id },
    });
    const user = session({ id: staffUser.id, role: 'STAFF' });
    await expect(assertBusinessAccess(user, f.business.id)).resolves.toBeUndefined();
  });

  it('pasife alınmış personel erişemez', async () => {
    const staffUser = await prisma.user.create({
      data: { email: `p2-${Date.now()}@test.local`, passwordHash: 'x', name: 'Personel', role: 'STAFF' },
    });
    await prisma.staffMember.update({
      where: { id: f.staffA.id },
      data: { userId: staffUser.id, active: false },
    });
    const user = session({ id: staffUser.id, role: 'STAFF' });
    await expect(assertBusinessAccess(user, f.business.id)).rejects.toThrow(ForbiddenError);
  });
});

describe('erişilebilir işletme listesi', () => {
  it('sahibe yalnızca kendi işletmelerini verir', async () => {
    await createFixture(); // başka bir işletme
    const list = await accessibleBusinesses(session({ id: f.owner.id, role: 'OWNER' }));
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(f.business.id);
  });

  it('yöneticiye tümünü verir', async () => {
    await createFixture();
    const list = await accessibleBusinesses(session({ id: 'admin', role: 'ADMIN' }));
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('bağlı olmayan personele boş liste verir', async () => {
    const list = await accessibleBusinesses(session({ id: 'yok', role: 'STAFF' }));
    expect(list).toEqual([]);
  });
});

describe('parola ve oturum', () => {
  it('parolayı geri döndürülemez şekilde saklar', async () => {
    const hash = await hashPassword('Rezzerv123');
    expect(hash).not.toContain('Rezzerv123');
    expect(hash.length).toBeGreaterThan(50);
    expect(await verifyPassword('Rezzerv123', hash)).toBe(true);
    expect(await verifyPassword('yanlis123', hash)).toBe(false);
  });

  it('oturum jetonunu imzalar ve doğrular', async () => {
    const token = await signSession({ uid: 'u1', role: 'OWNER', name: 'Test' });
    const payload = await verifySession(token);
    expect(payload).toEqual({ uid: 'u1', role: 'OWNER', name: 'Test' });
  });

  it('kurcalanmış jetonu reddeder', async () => {
    const token = await signSession({ uid: 'u1', role: 'CUSTOMER', name: 'Test' });
    const parts = token.split('.');
    const forged = `${parts[0]}.${Buffer.from(JSON.stringify({ uid: 'u1', role: 'ADMIN', name: 'Test' })).toString('base64url')}.${parts[2]}`;
    expect(await verifySession(forged)).toBeNull();
  });
});
