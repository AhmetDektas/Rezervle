import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { createFixture, resetDatabase, type Fixture } from './fixture';
import { createReservation } from '@/server/reservations';

/**
 * Çoklu hizmet her sektörde anlamlı değil.
 *
 * Kuaförde "saç kesimi + sakal düzeltme" birbirinin üstüne eklenen işlemler.
 * Restoranda hizmet masa boyutu, halı sahada kiralama süresi: bunlar aynı
 * şeyin varyantları ve ikisini birden seçmek süreyi/tutarı toplayıp saçma bir
 * kayıt üretirdi. Arayüz o sektörlerde tekli seçim gösteriyor, ama tek
 * savunma arayüz olamaz — doğrudan gönderilen istek de durmalı.
 */

let f: Fixture;

beforeEach(async () => {
  await resetDatabase();
  f = await createFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function book(serviceIds: string[]) {
  return createReservation({
    businessId: f.business.id,
    branchId: f.branch.id,
    serviceIds,
    staffId: f.staffA.id,
    customerId: f.customer.id,
    date: f.date,
    startMin: 600,
    channel: 'PHONE', // rıza kuralına takılmadan sektör kuralını sına
  });
}

describe('sektöre göre çoklu hizmet', () => {
  it('DENTAL: birden fazla hizmet kabul edilir', async () => {
    const r = await book([f.service.id, f.shortService.id]);
    expect(r.endMin - r.startMin).toBe(90);
  });

  it('RESTAURANT: ikinci hizmet reddedilir', async () => {
    await prisma.businessCategory.update({
      where: { id: f.category.id },
      data: { sector: 'RESTAURANT' },
    });
    await expect(book([f.service.id, f.shortService.id])).rejects.toThrow(/yalnızca bir seçenek/i);
  });

  it('RESTAURANT: tek hizmet çalışmaya devam eder', async () => {
    await prisma.businessCategory.update({
      where: { id: f.category.id },
      data: { sector: 'RESTAURANT' },
    });
    const r = await book([f.service.id]);
    expect(r.endMin - r.startMin).toBe(60);
  });

  it('PITCH: ikinci hizmet reddedilir', async () => {
    await prisma.businessCategory.update({
      where: { id: f.category.id },
      data: { sector: 'PITCH' },
    });
    await expect(book([f.service.id, f.shortService.id])).rejects.toThrow(/yalnızca bir seçenek/i);
  });
});
