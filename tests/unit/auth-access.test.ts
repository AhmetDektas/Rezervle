import { describe, it, expect, vi, beforeEach } from 'vitest';

// redirect() gerçek Next.js çalışma zamanında NEXT_REDIRECT digest'li bir hata
// fırlatır. Burada aynı sözleşmeyi taklit ediyoruz.
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;push;${to}` });
  },
}));

const findFirst = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({
  prisma: { business: { findFirst }, staffMember: { findFirst } },
}));

const { requireBusinessAccess } = await import('@/server/auth');

const owner = {
  id: 'user_1',
  email: 'sahip@ornek.com',
  name: 'Sahip',
  role: 'OWNER' as const,
  phone: null,
  avatarSeed: '1',
};

beforeEach(() => {
  findFirst.mockReset();
});

describe('requireBusinessAccess hata ayrımı', () => {
  it('yetki yoksa /yetkisiz sayfasına yönlendirir', async () => {
    findFirst.mockResolvedValue(null); // işletme bu sahibe ait değil

    await expect(requireBusinessAccess(owner, 'baskasinin_isletmesi')).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;push;/yetkisiz',
    });
  });

  it('altyapı arızası yetkisiz olarak gizlenmez, yükselir', async () => {
    // Postgres bağlantı havuzu tükenmesi gibi gerçek bir arıza.
    findFirst.mockRejectedValue(new Error('Too many connections'));

    await expect(requireBusinessAccess(owner, 'isletme_1')).rejects.toThrow('Too many connections');
  });

  it('erişim varsa sessizce geçer', async () => {
    findFirst.mockResolvedValue({ id: 'isletme_1' });

    await expect(requireBusinessAccess(owner, 'isletme_1')).resolves.toBeUndefined();
  });
});
