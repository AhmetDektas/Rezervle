import { describe, it, expect } from 'vitest';
import { depositActive, depositFor, refundOnCancel, type DepositPolicy } from '@/lib/deposit';

const policy = (over: Partial<DepositPolicy> = {}): DepositPolicy => ({
  platformEnabled: true,
  addon: true,
  enabled: true,
  kind: 'PERCENT',
  value: 20,
  minPrice: 0,
  refundHours: 24,
  ...over,
});

describe('kapora paketi anahtarları', () => {
  it('paket kapalıyken kapora istenmez', () => {
    expect(depositActive(policy({ addon: false }))).toBe(false);
    expect(depositFor(policy({ addon: false }), 1000)).toBe(0);
  });

  it('işletme kendi kapattıysa kapora istenmez', () => {
    expect(depositActive(policy({ enabled: false }))).toBe(false);
    expect(depositFor(policy({ enabled: false }), 1000)).toBe(0);
  });

  it('ikisi de açıkken kapora istenir', () => {
    expect(depositActive(policy())).toBe(true);
    expect(depositFor(policy(), 1000)).toBe(200);
  });
});

describe('kapora tutarı', () => {
  it('yüzde hesabını yuvarlar', () => {
    expect(depositFor(policy({ value: 15 }), 1450)).toBe(218);
  });

  it('sabit tutar seçeneğini uygular', () => {
    expect(depositFor(policy({ kind: 'AMOUNT', value: 250 }), 1000)).toBe(250);
  });

  it('hizmet ücretini aşamaz', () => {
    expect(depositFor(policy({ kind: 'AMOUNT', value: 5000 }), 900)).toBe(900);
  });

  it('ücretsiz hizmette kapora istemez', () => {
    expect(depositFor(policy(), 0)).toBe(0);
  });

  it('alt limitin altındaki randevuda kapora istemez', () => {
    expect(depositFor(policy({ minPrice: 1000 }), 900)).toBe(0);
    expect(depositFor(policy({ minPrice: 1000 }), 1000)).toBe(200);
  });
});

describe('iptalde iade', () => {
  const now = new Date('2026-09-04T10:00:00.000Z');

  it('süre penceresi içindeyse iade eder', () => {
    const startsAt = new Date('2026-09-06T10:00:00.000Z'); // 48 saat sonra
    expect(refundOnCancel({ refundHours: 24 }, startsAt, now)).toBe(true);
  });

  it('pencere kapandıysa iade etmez', () => {
    const startsAt = new Date('2026-09-04T20:00:00.000Z'); // 10 saat sonra
    expect(refundOnCancel({ refundHours: 24 }, startsAt, now)).toBe(false);
  });

  it('tam sınırda iade eder', () => {
    const startsAt = new Date('2026-09-05T10:00:00.000Z'); // tam 24 saat
    expect(refundOnCancel({ refundHours: 24 }, startsAt, now)).toBe(true);
  });
});
