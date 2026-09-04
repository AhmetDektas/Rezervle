import { describe, it, expect } from 'vitest';
import {
  splitPayment,
  settlementFor,
  payoutFor,
  platformEarnsFor,
} from '@/lib/commission';

describe('tahsilatın bölünmesi', () => {
  it('%30 komisyonu doğru ayırır', () => {
    const s = splitPayment(300, 30);
    expect(s.commission).toBe(90);
    expect(s.net).toBe(210);
    expect(s.commission + s.net).toBe(s.total);
  });

  it('kuruş farkını işletme lehine bırakır', () => {
    const s = splitPayment(101, 30); // 30,3 → 30
    expect(s.commission).toBe(30);
    expect(s.net).toBe(71);
    expect(s.commission + s.net).toBe(101);
  });

  it('her tutarda toplam korunur', () => {
    for (const total of [1, 7, 99, 100, 233, 1450, 8500]) {
      for (const rate of [0, 10, 30, 50, 100]) {
        const s = splitPayment(total, rate);
        expect(s.commission + s.net).toBe(total);
        expect(s.commission).toBeGreaterThanOrEqual(0);
        expect(s.net).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('sıfır tahsilatta sıfır komisyon', () => {
    expect(splitPayment(0, 30)).toEqual({ total: 0, commission: 0, net: 0, rate: 30 });
  });

  it('oranı 0-100 aralığına sıkıştırır', () => {
    expect(splitPayment(100, 150).commission).toBe(100);
    expect(splitPayment(100, -5).commission).toBe(0);
  });
});

describe('randevu sonucuna göre hak ediş', () => {
  it('zamanında iptalde iade edilir', () => {
    expect(settlementFor('CANCELLED_IN_WINDOW')).toBe('REFUNDED');
  });

  it('gelmedi, geç iptal ve tamamlandıda hak ediş yazılır', () => {
    expect(settlementFor('NO_SHOW')).toBe('RELEASED');
    expect(settlementFor('CANCELLED_LATE')).toBe('RELEASED');
    expect(settlementFor('COMPLETED')).toBe('RELEASED');
  });
});

describe('taraflara düşen tutarlar', () => {
  const split = splitPayment(300, 30);

  it('iadede kimse kazanmaz', () => {
    expect(payoutFor(split, 'REFUNDED')).toBe(0);
    expect(platformEarnsFor(split, 'REFUNDED')).toBe(0);
  });

  it('bloke iken henüz kimseye geçmez', () => {
    expect(payoutFor(split, 'HELD')).toBe(0);
    expect(platformEarnsFor(split, 'HELD')).toBe(0);
  });

  it('hak ediş yazıldığında pay dağılır', () => {
    expect(payoutFor(split, 'RELEASED')).toBe(210);
    expect(platformEarnsFor(split, 'RELEASED')).toBe(90);
  });
});
