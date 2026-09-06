import { describe, it, expect } from 'vitest';
import { bookingTotals, orderServices, serviceLabel } from '@/lib/services';

const muayene = { id: 'a', durationMin: 60, bufferMin: 15, price: 1000 };
const kisa = { id: 'b', durationMin: 30, bufferMin: 0, price: 500 };

describe('bookingTotals', () => {
  it('süreleri ve tutarları toplar', () => {
    expect(bookingTotals([muayene, kisa])).toEqual({ durationMin: 90, bufferMin: 0, price: 1500 });
  });

  it('tamponu YALNIZCA son hizmetten alır', () => {
    // Tampon hizmetin süresi değil, arkasından gelen toparlanma payı. Aynı
    // müşteri sırt sırta iki hizmet alıyorsa aradaki toparlanma yaşanmaz.
    // Toplasaydık her ek hizmet, satılabilir saatleri sebepsiz yere yerdi.
    expect(bookingTotals([kisa, muayene]).bufferMin).toBe(15);
    expect(bookingTotals([muayene, kisa]).bufferMin).toBe(0);
  });

  it('tek hizmette eski davranışın aynısını verir', () => {
    expect(bookingTotals([muayene])).toEqual({ durationMin: 60, bufferMin: 15, price: 1000 });
  });

  it('boş listede sıfırlanır', () => {
    expect(bookingTotals([])).toEqual({ durationMin: 0, bufferMin: 0, price: 0 });
  });
});

describe('orderServices', () => {
  it('kayıtları istenen sırayla döndürür', () => {
    // Sıra önemli: hangi hizmetin tamponunun uygulanacağını o belirliyor.
    expect(orderServices(['b', 'a'], [muayene, kisa])?.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('kayıp kimlik varsa null döner', () => {
    // Eksik listeyle hesaplanan süre gerçek randevudan kısa olurdu; sessizce
    // devam etmek üst üste binen randevu demek.
    expect(orderServices(['a', 'yok'], [muayene, kisa])).toBeNull();
  });
});

describe('serviceLabel', () => {
  it('tek hizmette adı olduğu gibi verir', () => {
    expect(serviceLabel('Muayene', 1)).toBe('Muayene');
  });

  it('çoklu hizmette kalanı sayar', () => {
    expect(serviceLabel('Muayene', 3)).toBe('Muayene +2 hizmet');
  });
});
