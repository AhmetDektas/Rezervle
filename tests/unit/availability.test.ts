import { describe, it, expect } from 'vitest';
import { computeSlots, isStaffFree, utilization, type StaffAvailability } from '@/lib/availability';

const staff = (over: Partial<StaffAvailability> = {}): StaffAvailability => ({
  staffId: 'p1',
  hours: { startMin: 540, endMin: 1080 }, // 09:00–18:00
  breaks: [],
  timeOff: [],
  booked: [],
  ...over,
});

const base = {
  branchHours: { startMin: 540, endMin: 1080 },
  service: { durationMin: 60, bufferMin: 0 },
  stepMin: 60,
  minLeadMin: 0,
  nowMin: null,
};

describe('computeSlots', () => {
  it('şube açık ve personel boşken tüm saatleri üretir', () => {
    const slots = computeSlots({ ...base, staff: [staff()] });
    expect(slots).toHaveLength(9); // 09:00'dan 17:00'a
    expect(slots[0]?.startMin).toBe(540);
    expect(slots.at(-1)?.startMin).toBe(1020);
  });

  it('hizmet kapanıştan sonra bitiyorsa slot üretmez', () => {
    const slots = computeSlots({
      ...base,
      service: { durationMin: 120, bufferMin: 0 },
      staff: [staff()],
    });
    expect(slots.at(-1)?.startMin).toBe(960); // 16:00 → 18:00
  });

  it('şube kapalıysa hiçbir slot üretmez', () => {
    expect(computeSlots({ ...base, branchHours: null, staff: [staff()] })).toEqual([]);
  });

  it('personel o gün çalışmıyorsa slot üretmez', () => {
    expect(computeSlots({ ...base, staff: [staff({ hours: null })] })).toEqual([]);
  });

  it('mevcut randevuyla çakışan saatleri eler', () => {
    const slots = computeSlots({
      ...base,
      staff: [staff({ booked: [{ startMin: 600, endMin: 660 }] })], // 10:00–11:00
    });
    expect(slots.map((s) => s.startMin)).not.toContain(600);
    expect(slots.map((s) => s.startMin)).toContain(660);
  });

  it('tampon süresi bir sonraki slotu da kapatır', () => {
    const slots = computeSlots({
      ...base,
      stepMin: 30,
      service: { durationMin: 60, bufferMin: 30 },
      staff: [staff({ booked: [{ startMin: 600, endMin: 690 }] })], // 10:00 + 30 dk tampon
    });
    // 09:30 başlarsa 10:30'a kadar (tampon dahil 11:00) sürer → çakışır
    expect(slots.map((s) => s.startMin)).not.toContain(570);
    expect(slots.map((s) => s.startMin)).not.toContain(600);
    expect(slots.map((s) => s.startMin)).toContain(690);
  });

  it('molayı hesaba katar', () => {
    const slots = computeSlots({
      ...base,
      staff: [staff({ breaks: [{ startMin: 780, endMin: 840 }] })], // 13:00–14:00
    });
    expect(slots.map((s) => s.startMin)).not.toContain(780);
    // 12:00–13:00 molaya yalnızca dokunur, çakışmaz: geçerli kalmalı.
    expect(slots.map((s) => s.startMin)).toContain(720);
  });

  it('izinli aralığı kapatır', () => {
    const slots = computeSlots({
      ...base,
      staff: [staff({ timeOff: [{ startMin: 0, endMin: 1440 }] })],
    });
    expect(slots).toEqual([]);
  });

  it('geçmiş saatleri ve hazırlık süresini eler', () => {
    // Saat 10:00 ve 1 saat hazırlık payı → en erken 11:00.
    const slots = computeSlots({ ...base, staff: [staff()], nowMin: 600, minLeadMin: 60 });
    expect(slots[0]?.startMin).toBe(660);
    // Gün bitmişse hiç slot kalmaz.
    const late = computeSlots({ ...base, staff: [staff()], nowMin: 1200, minLeadMin: 60 });
    expect(late).toEqual([]);
  });

  it('ANY seçiminde uygun personelleri birlikte döndürür', () => {
    const slots = computeSlots({
      ...base,
      staff: [
        staff({ staffId: 'a', booked: [{ startMin: 540, endMin: 600 }] }),
        staff({ staffId: 'b' }),
      ],
    });
    expect(slots[0]?.startMin).toBe(540);
    expect(slots[0]?.staffIds).toEqual(['b']);
    expect(slots[1]?.staffIds).toEqual(['a', 'b']);
  });

  it('personel saatleri şube saatlerinden dar olduğunda kesişimi kullanır', () => {
    const slots = computeSlots({
      ...base,
      staff: [staff({ hours: { startMin: 600, endMin: 720 } })], // 10:00–12:00
    });
    expect(slots.map((s) => s.startMin)).toEqual([600, 660]);
  });
});

describe('isStaffFree', () => {
  it('çalışma penceresi dışındaki başlangıcı reddeder', () => {
    expect(isStaffFree(staff(), 480, 60, 0, { startMin: 540, endMin: 1080 })).toBe(false);
  });
  it('pencere içindeki boş saati kabul eder', () => {
    expect(isStaffFree(staff(), 600, 60, 0, { startMin: 540, endMin: 1080 })).toBe(true);
  });
});

describe('utilization', () => {
  it('dolu ve kapasite dakikalarını toplar', () => {
    const result = utilization([
      staff({ booked: [{ startMin: 600, endMin: 660 }] }),
      staff({ staffId: 'p2', hours: null }),
    ]);
    expect(result.capacityMin).toBe(540);
    expect(result.bookedMin).toBe(60);
  });
});

describe('gece yarısına kadar açık kaynaklar (halı saha)', () => {
  const pitch = {
    branchHours: { startMin: 540, endMin: 1440 }, // 09:00–24:00
    service: { durationMin: 60, bufferMin: 15 },
    stepMin: 60,
    minLeadMin: 0,
    nowMin: null,
  };

  it('son slotu 23:00 olarak üretir', () => {
    const slots = computeSlots({
      ...pitch,
      staff: [staff({ hours: { startMin: 540, endMin: 1440 }, breaks: [] })],
    });
    expect(slots.at(-1)?.startMin).toBe(1380); // 23:00 → 24:00
    expect(slots.at(-1)?.endMin).toBe(1440);
  });

  it('iki saatlik kiralamada son slot 22:00 olur', () => {
    const slots = computeSlots({
      ...pitch,
      service: { durationMin: 120, bufferMin: 20 },
      staff: [staff({ hours: { startMin: 540, endMin: 1440 }, breaks: [] })],
    });
    expect(slots.at(-1)?.startMin).toBe(1320); // 22:00 → 24:00
  });

  it('akşam dolu olan sahayı listelemez', () => {
    const slots = computeSlots({
      ...pitch,
      staff: [
        staff({
          hours: { startMin: 540, endMin: 1440 },
          breaks: [],
          booked: [{ startMin: 1200, endMin: 1275 }], // 20:00–21:15 (tampon dahil)
        }),
      ],
    });
    expect(slots.map((s) => s.startMin)).not.toContain(1200);
    expect(slots.map((s) => s.startMin)).not.toContain(1260); // 21:00 tampona denk gelir
    expect(slots.map((s) => s.startMin)).toContain(1320);
  });
});
