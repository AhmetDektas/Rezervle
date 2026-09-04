import { describe, it, expect } from 'vitest';
import {
  zonedToUtc, utcToDateStr, utcToMinutes, weekdayOf, addDays, diffDays,
  startOfWeek, hhmm, minutesOf, overlaps,
} from '@/lib/time';

describe('saat dilimi dönüşümleri', () => {
  it('yerel gün + dakikayı UTC anına çevirir (Türkiye UTC+3)', () => {
    const utc = zonedToUtc('2026-03-14', 14 * 60);
    expect(utc.toISOString()).toBe('2026-03-14T11:00:00.000Z');
  });

  it('gidiş-dönüş dönüşümü aynı değeri verir', () => {
    for (const date of ['2026-01-15', '2026-06-21', '2026-10-30', '2026-12-31']) {
      for (const minutes of [0, 30, 540, 1439]) {
        const utc = zonedToUtc(date, minutes);
        expect(utcToDateStr(utc)).toBe(date);
        expect(utcToMinutes(utc)).toBe(minutes);
      }
    }
  });

  it('gece yarısını doğru işler', () => {
    const utc = zonedToUtc('2026-05-01', 0);
    expect(utcToDateStr(utc)).toBe('2026-05-01');
    expect(utcToMinutes(utc)).toBe(0);
  });
});

describe('takvim yardımcıları', () => {
  it('haftanın gününü bulur', () => {
    expect(weekdayOf('2026-09-04')).toBe(5); // Cuma
    expect(weekdayOf('2026-09-06')).toBe(0); // Pazar
  });

  it('gün ekler ve ay sınırını aşar', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // artık yıl
  });

  it('gün farkını hesaplar', () => {
    expect(diffDays('2026-09-10', '2026-09-04')).toBe(6);
    expect(diffDays('2026-09-01', '2026-09-04')).toBe(-3);
  });

  it('haftayı pazartesiden başlatır', () => {
    expect(startOfWeek('2026-09-04')).toBe('2026-08-31'); // Cuma → Pazartesi
    expect(startOfWeek('2026-09-06')).toBe('2026-08-31'); // Pazar → önceki Pazartesi
  });
});

describe('biçimlendirme ve çakışma', () => {
  it('dakikayı saate çevirir ve geri alır', () => {
    expect(hhmm(0)).toBe('00:00');
    expect(hhmm(545)).toBe('09:05');
    expect(minutesOf('09:05')).toBe(545);
  });

  it('çakışmayı uç değerler dahil doğru hesaplar', () => {
    expect(overlaps(0, 60, 60, 120)).toBe(false); // uçlar dokunuyor
    expect(overlaps(0, 61, 60, 120)).toBe(true);
    expect(overlaps(30, 90, 0, 120)).toBe(true); // içine alıyor
  });
});
