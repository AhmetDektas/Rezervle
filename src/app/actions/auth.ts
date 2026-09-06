'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { loginSchema, registerSchema, businessRegisterSchema, fieldErrors } from '@/lib/validation';
import { verifyPassword } from '@/server/auth';
import { setSessionCookie, clearSessionCookie } from '@/server/session';
import { requireUserAction } from '@/server/auth';
import { DomainError, run, type ActionResult } from '@/server/errors';
import type { Role } from '@/lib/constants';
import { notifyUser } from '@/server/notifications';
import { activePlatformPromotion, welcomeBody } from '@/server/promotions';
import { submitBusinessApplication } from '@/server/business-application';
import { createAccount } from '@/server/accounts';
import { PLANS } from '@/lib/plans';
import {
  RATE_LIMITS,
  clientIdentifier,
  enforceRateLimit,
  assertNotRateLimited,
  recordRateLimitFailure,
  clearRateLimit,
} from '@/server/rate-limit';

export type AuthResult = ActionResult<{ role: Role }> & { fields?: Record<string, string> };

export async function loginAction(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: 'Lütfen bilgilerinizi kontrol edin.', fields: fieldErrors(parsed.error) };
  }

  const kimlik = await clientIdentifier();

  const result = await run(async () => {
    // Kapı sayacı ARTIRMIYOR, yalnızca okuyor. Artırsaydı reddedilen her
    // istek sayacı bir kez daha büyütür ve pencere hiç boşalmazdı; kilitlenen
    // kullanıcı denedikçe kilidi uzatırdı.
    await assertNotRateLimited(RATE_LIMITS.giris, kimlik);

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    // Kullanıcı yok ile parola yanlış aynı mesajı döndürür: hesap sayımı yapılamasın.
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      throw new DomainError('E-posta veya parola hatalı.', 'BAD_CREDENTIALS');
    }
    if (!user.active) throw new DomainError('Hesabınız devre dışı. Destek ile iletişime geçin.', 'INACTIVE');
    // Parolasını bilen kullanıcı önceki hatalı denemeler yüzünden kilitlenmemeli.
    await clearRateLimit(RATE_LIMITS.giris, kimlik);
    await setSessionCookie({ uid: user.id, role: user.role as Role, name: user.name });
    return { role: user.role as Role };
  }, { action: 'loginAction' });

  // Yalnızca BAŞARISIZ deneme sayılıyor: kaba kuvvet tekrarlı başarısızlıktır.
  // Başarılı girişi saymak, gün boyu çalışan gerçek kullanıcıyı cezalandırırdı.
  if (!result.ok && result.code !== 'RATE_LIMITED') {
    await recordRateLimitFailure(RATE_LIMITS.giris, kimlik);
  }
  return result;
}

export async function registerAction(formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || '',
    password: formData.get('password'),
    kvkk: formData.get('kvkk') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, error: 'Lütfen formu kontrol edin.', fields: fieldErrors(parsed.error) };
  }

  return run(async () => {
    await enforceRateLimit(RATE_LIMITS.kayit, await clientIdentifier());
    // Hesap kurulumu createAccount'ta: e-posta tekilliği, parola özeti, rol,
    // müşteri profili ve KVKK rıza kaydı iki kayıt yolunda da aynı yerden
    // geçsin diye. Burada kopyalandığı sürece rıza yalnızca işletme
    // başvurusunda yazılıyordu ve müşteri yolu sessizce dışarıda kalıyordu.
    const user = await createAccount({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      password: parsed.data.password,
      role: 'CUSTOMER',
    });
    // Karşılama metni kampanya tablosundan üretilir: kod, tutar ve alt limit
    // tek kaynaktan gelir. Kampanya kapatılırsa bildirim de ondan bahsetmez.
    const promo = await activePlatformPromotion();
    await notifyUser({
      userId: user.id,
      kind: 'INFO',
      title: 'Rezzerv’e hoş geldiniz',
      body: welcomeBody(promo),
      href: '/kesfet',
    });
    await setSessionCookie({ uid: user.id, role: 'CUSTOMER', name: user.name });
    return { role: 'CUSTOMER' as Role };
  }, { action: 'registerAction' });
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

/**
 * İşletme başvurusu.
 *
 * Rezzerv'in arz tarafına açılan tek kapı. Hesap PENDING durumunda oluşur:
 * işletme panele girip kurulumunu tamamlayabilir ama platform onaylayana
 * kadar müşteri tarafında görünmez ve rezervasyon alamaz.
 */
export async function registerBusinessAction(formData: FormData): Promise<AuthResult> {
  // Eksik alan null yerine boş dize olarak geçiyor: seçilmemiş bir <select>
  // (placeholder seçeneği disabled olduğu için) hiç gönderilmiyor ve Zod
  // kullanıcıya "Expected string, received null" gösteriyordu. Boş dizede
  // şemanın kendi Türkçe mesajı ("Kategori seçin.") çalışır.
  const text = (key: string): string => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : '';
  };
  const parsed = businessRegisterSchema.safeParse({
    ownerName: text('ownerName'),
    email: text('email'),
    phone: text('phone'),
    password: text('password'),
    businessName: text('businessName'),
    categorySlug: text('categorySlug'),
    district: text('district'),
    address: text('address'),
    kvkk: formData.get('kvkk') === 'on',
  });
  if (!parsed.success) {
    return { ok: false, error: 'Lütfen formu kontrol edin.', fields: fieldErrors(parsed.error) };
  }

  return run(async (ctx) => {
    await enforceRateLimit(RATE_LIMITS.isletmeBasvurusu, await clientIdentifier());
    const result = await submitBusinessApplication({
      ownerName: parsed.data.ownerName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password: parsed.data.password,
      businessName: parsed.data.businessName,
      categorySlug: parsed.data.categorySlug,
      district: parsed.data.district,
      address: parsed.data.address,
    });
    ctx.userId = result.userId;
    ctx.meta = { businessId: result.businessId, slug: result.slug, kategori: parsed.data.categorySlug };

    await setSessionCookie({ uid: result.userId, role: 'OWNER', name: parsed.data.ownerName });
    return { role: 'OWNER' as Role };
  }, { action: 'registerBusinessAction' });
}

/**
 * Paket seçimi.
 *
 * Kaydın ikinci adımı: işletme ödeyeceği paketi belirliyor. Ücret kayıtta
 * donduruluyor (`planPrice`) — liste fiyatı sonradan değişse bile mevcut
 * abonenin ödemesi değişmiyor.
 *
 * Şu an para tahsil EDİLMİYOR: deneme süresi başvuruyla başlıyor ve gerçek
 * ödeme sağlayıcısı bağlanana kadar tahsilat yok. Sağlayıcı geldiğinde bu
 * eylem ödeme başlatacak yer.
 */
export async function choosePlanAction(planKey: string): Promise<ActionResult<undefined>> {
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    ctx.userId = user.id;

    const plan = PLANS.find((p) => p.key === planKey);
    if (!plan) throw new DomainError('Geçersiz paket.', 'PLAN_INVALID');

    // Yalnızca kendi işletmesi: paket başkasının hesabına yazılamaz.
    const business = await prisma.business.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, trialEndsAt: true },
    });
    if (!business) throw new DomainError('İşletme bulunamadı.', 'NOT_FOUND');
    ctx.meta = { businessId: business.id, plan: plan.key };

    await prisma.business.update({
      where: { id: business.id },
      data: {
        planKey: plan.key,
        planPrice: plan.price,
        // Kapora eklentisi pakete dahilse açılıyor; değilse yönetici elle
        // açabilir (satış sonrası yükseltme).
        ...(plan.deposit ? { depositAddon: true } : {}),
      },
    });
    return undefined;
  }, { action: 'choosePlanAction' });

  if (result.ok) revalidatePath('/panel');
  return result;
}
