import { describe, it, expect } from 'vitest';
import {
  ayEkle,
  donemUret,
  kesilecekDonem,
  denemeUyarisiGerekli,
  ODEME_VADESI_GUN,
} from '@/lib/subscription';

const U = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('ayEkle', () => {
  it('normal ay ekler', () => {
    expect(ayEkle(U('2026-03-15')).toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('ay sonu taşmasını düzeltir', () => {
    // JavaScript'in kendi davranışı 31 Ocak + 1 ay = 3 Mart. Düzeltilmezse
    // işletme şubatı bedava kullanırdı ve dönemler kalıcı olarak kayardı.
    expect(ayEkle(U('2026-01-31')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(ayEkle(U('2026-08-31')).toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });

  it('artık yılı bilir', () => {
    expect(ayEkle(U('2028-01-31')).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('yıl sınırını geçer', () => {
    expect(ayEkle(U('2026-12-10')).toISOString()).toBe('2027-01-10T00:00:00.000Z');
  });

  it('saat bilgisini korur', () => {
    const t = new Date('2026-03-15T13:45:00.000Z');
    expect(ayEkle(t).toISOString()).toBe('2026-04-15T13:45:00.000Z');
  });
});

describe('donemUret', () => {
  it('bir aylık dönem ve vade üretir', () => {
    const d = donemUret(U('2026-03-15'));
    expect(d.periodEnd.toISOString()).toBe('2026-04-15T00:00:00.000Z');
    expect(d.dueAt.toISOString()).toBe('2026-03-22T00:00:00.000Z');
    expect((d.dueAt.getTime() - d.periodStart.getTime()) / 86_400_000).toBe(ODEME_VADESI_GUN);
  });
});

describe('kesilecekDonem', () => {
  const taban = { planStatus: 'TRIAL', planPrice: 2000, trialEndsAt: U('2026-03-01'), currentPeriodEnd: null };

  it('deneme sürerken fatura kesilmez', () => {
    expect(kesilecekDonem(taban, U('2026-02-20'))).toBeNull();
  });

  it('deneme bitince ilk dönem denemenin bittiği andan başlar', () => {
    // "Bugünden" başlasaydı geç fark edilen her deneme, işletmeye birkaç gün
    // bedava kullanım verirdi.
    const d = kesilecekDonem(taban, U('2026-03-05'));
    expect(d?.periodStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(d?.periodEnd.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('ödenmiş dönem sürerken fatura kesilmez', () => {
    const b = { ...taban, planStatus: 'ACTIVE', currentPeriodEnd: U('2026-05-01') };
    expect(kesilecekDonem(b, U('2026-04-20'))).toBeNull();
  });

  it('ödenmiş dönem bitince sonraki dönem oradan devam eder', () => {
    const b = { ...taban, planStatus: 'ACTIVE', currentPeriodEnd: U('2026-05-01') };
    const d = kesilecekDonem(b, U('2026-05-09'));
    expect(d?.periodStart.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(d?.periodEnd.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('paket seçilmemişse fatura kesilmez', () => {
    // İşletmenin seçmediği bir tutarı borç yazmak, tersinden düzeltmesi
    // pahalı bir hata olurdu.
    expect(kesilecekDonem({ ...taban, planPrice: 0 }, U('2026-03-05'))).toBeNull();
  });

  it('iptal edilmişse fatura kesilmez', () => {
    expect(kesilecekDonem({ ...taban, planStatus: 'CANCELLED' }, U('2026-03-05'))).toBeNull();
  });

  it('hiç deneme tarihi yoksa fatura kesilmez', () => {
    expect(kesilecekDonem({ ...taban, trialEndsAt: null }, U('2026-03-05'))).toBeNull();
  });
});

describe('denemeUyarisiGerekli', () => {
  const taban = { planStatus: 'TRIAL', trialEndsAt: U('2026-03-01'), trialWarnedAt: null };

  it('son 7 günde uyarır', () => {
    expect(denemeUyarisiGerekli(taban, U('2026-02-26'))).toBe(true);
  });

  it('erken uyarmaz', () => {
    expect(denemeUyarisiGerekli(taban, U('2026-02-01'))).toBe(false);
  });

  it('bir kez uyarır', () => {
    // Damga olmasaydı günlük iş her gün aynı mesajı gönderirdi.
    expect(denemeUyarisiGerekli({ ...taban, trialWarnedAt: U('2026-02-26') }, U('2026-02-27'))).toBe(false);
  });

  it('deneme bittiyse uyarmaz', () => {
    expect(denemeUyarisiGerekli(taban, U('2026-03-02'))).toBe(false);
  });

  it('deneme dışındaki durumlarda uyarmaz', () => {
    expect(denemeUyarisiGerekli({ ...taban, planStatus: 'ACTIVE' }, U('2026-02-26'))).toBe(false);
  });
});
