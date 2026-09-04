'use server';

import { prisma } from '@/lib/db';
import { loginSchema, registerSchema, fieldErrors } from '@/lib/validation';
import { hashPassword, verifyPassword } from '@/server/auth';
import { setSessionCookie, clearSessionCookie } from '@/server/session';
import { DomainError, run, type ActionResult } from '@/server/errors';
import type { Role } from '@/lib/constants';
import { notifyUser } from '@/server/notifications';

export type AuthResult = ActionResult<{ role: Role }> & { fields?: Record<string, string> };

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Lütfen bilgilerinizi kontrol edin.', fields: fieldErrors(parsed.error) };
  }

  const result = await run(async () => {
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Kullanıcı yok ile parola yanlış aynı mesajı döndürür: hesap sayımı yapılamasın.
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      throw new DomainError('E-posta veya parola hatalı.', 'BAD_CREDENTIALS');
    }
    if (!user.active) throw new DomainError('Hesabınız devre dışı. Destek ile iletişime geçin.', 'INACTIVE');
    await setSessionCookie({ uid: user.id, role: user.role as Role, name: user.name });
    return { role: user.role as Role };
  });
  return result;
}

export async function registerAction(formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || '',
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Lütfen formu kontrol edin.', fields: fieldErrors(parsed.error) };
  }

  return run(async () => {
    const exists = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (exists) throw new DomainError('Bu e-posta ile kayıtlı bir hesap zaten var.', 'EMAIL_TAKEN');

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        passwordHash: await hashPassword(parsed.data.password),
        role: 'CUSTOMER',
        avatarSeed: String(Math.floor(Math.random() * 24)),
        customerProfile: { create: {} },
      },
    });
    await notifyUser({
      userId: user.id,
      kind: 'INFO',
      title: 'Rezzerv’e hoş geldiniz',
      body: 'İlk randevunuzda REZZERV100 kodu ile 100 TL indirim kazanın.',
      href: '/kesfet',
    });
    await setSessionCookie({ uid: user.id, role: 'CUSTOMER', name: user.name });
    return { role: 'CUSTOMER' as Role };
  });
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
}

/** Yalnızca geliştirme modunda: tohum hesaplarıyla tek tıkla giriş. */
export async function demoLoginAction(email: string): Promise<AuthResult> {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'Demo giriş yalnızca geliştirme ortamında kullanılabilir.' };
  }
  const fd = new FormData();
  fd.set('email', email);
  fd.set('password', 'Rezzerv123');
  return loginAction(fd);
}
