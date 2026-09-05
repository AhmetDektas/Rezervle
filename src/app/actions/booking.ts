'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { run, DomainError, type ActionResult } from '@/server/errors';
import { requireUserAction, assertBusinessAccess, currentUser } from '@/server/auth';
import { getDayAvailability, ONLINE_LEAD_MIN, STAFF_LEAD_MIN } from '@/server/schedule';
import {
  createReservation,
  rescheduleReservation,
  setReservationStatus,
  customerCanModify,
  quoteBooking,
  type BookingQuote,
} from '@/server/reservations';
import { bookingSchema, rescheduleSchema, fieldErrors } from '@/lib/validation';
import type { Slot } from '@/lib/availability';
import { SLOT_STEP_MIN } from '@/lib/constants';

/** Takvimde bir günün açık saatleri. Herkese açık: fiyat/kişi bilgisi içermez. */
export async function slotsAction(input: {
  branchId: string;
  serviceId: string;
  staffId: string;
  date: string;
  excludeReservationId?: string;
}): Promise<ActionResult<Slot[]>> {
  return run(async () => {
    const user = await currentUser();
    const byStaff = user !== null && user.role !== 'CUSTOMER';
    return getDayAvailability({
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: input.date,
      staffId: input.staffId === 'ANY' ? null : input.staffId,
      excludeReservationId: input.excludeReservationId,
      leadMin: byStaff ? STAFF_LEAD_MIN : ONLINE_LEAD_MIN,
      stepMin: SLOT_STEP_MIN,
    });
  }, { action: 'slotsAction' });
}

/**
 * Onay ekranındaki tutarların ön hesabı. Kampanya kodu geçersizse hata
 * mesajı döner; müşteri ödemeye basmadan önce görür.
 */
export async function quoteBookingAction(input: {
  businessId: string;
  serviceId: string;
  promotionCode?: string;
}): Promise<ActionResult<BookingQuote>> {
  return run(() => quoteBooking(input), { action: 'quoteBookingAction' });
}

export type BookingSuccess = { reservationId: string; code: string };

/** Müşteri tarafından randevu oluşturma. */
export async function createBookingAction(
  input: unknown,
): Promise<ActionResult<BookingSuccess> & { fields?: Record<string, string> }> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Formda eksik bilgi var.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    // Para yolundaki en kritik eylem: hata olursa hangi müşteri, hangi
    // işletme ve hangi ödeme yöntemi olduğu logdan okunabilmeli.
    ctx.userId = user.id;
    ctx.meta = {
      businessId: parsed.data.businessId,
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      startMin: parsed.data.startMin,
      paymentMethod: parsed.data.paymentMethod,
    };
    const reservation = await createReservation({
      businessId: parsed.data.businessId,
      branchId: parsed.data.branchId,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      customerId: user.id,
      date: parsed.data.date,
      startMin: parsed.data.startMin,
      channel: 'ONLINE',
      note: parsed.data.note,
      promotionCode: parsed.data.promotionCode || undefined,
      paymentMethod: parsed.data.paymentMethod,
      actorId: user.id,
    });
    return { reservationId: reservation.id, code: reservation.code };
  }, { action: 'createBookingAction' });
  if (result.ok) {
    revalidatePath('/randevularim');
    revalidatePath('/');
  }
  return result;
}

/** Müşteri kendi randevusunu iptal eder. */
export async function cancelBookingAction(
  reservationId: string,
  reason?: string,
): Promise<ActionResult<undefined>> {
  const result = await run(async (ctx) => {
    const user = await requireUserAction();
    ctx.userId = user.id;
    ctx.meta = { reservationId };
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, customerId: true, businessId: true, date: true, startMin: true, status: true },
    });
    if (!reservation) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');

    const isOwnerOfRecord = reservation.customerId === user.id;
    if (!isOwnerOfRecord) await assertBusinessAccess(user, reservation.businessId);
    if (isOwnerOfRecord && user.role === 'CUSTOMER' && !customerCanModify(reservation)) {
      throw new DomainError(
        'Randevuya 2 saatten az kaldığı için çevrimiçi iptal edilemez. Lütfen işletmeyi arayın.',
        'CUTOFF',
      );
    }
    await setReservationStatus({
      id: reservationId,
      to: 'CANCELLED',
      actorId: user.id,
      note: reason ?? (isOwnerOfRecord ? 'Müşteri iptal etti' : 'İşletme iptal etti'),
    });
    return undefined;
  }, { action: 'cancelBookingAction' });
  if (result.ok) {
    revalidatePath('/randevularim');
    revalidatePath(`/randevularim/${reservationId}`);
  }
  return result;
}

/** Erteleme: müşteri kendi randevusunu, işletme her randevuyu taşıyabilir. */
export async function rescheduleBookingAction(
  input: unknown,
): Promise<ActionResult<undefined> & { fields?: Record<string, string> }> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Tarih veya saat geçersiz.', fields: fieldErrors(parsed.error) };
  }
  const result = await run(async () => {
    const user = await requireUserAction();
    const reservation = await prisma.reservation.findUnique({
      where: { id: parsed.data.reservationId },
      select: { id: true, customerId: true, businessId: true, date: true, startMin: true, status: true },
    });
    if (!reservation) throw new DomainError('Randevu bulunamadı.', 'NOT_FOUND');

    const isCustomer = user.role === 'CUSTOMER';
    if (isCustomer) {
      if (reservation.customerId !== user.id) throw new DomainError('Bu randevuyu değiştiremezsiniz.', 'FORBIDDEN');
      if (!customerCanModify(reservation)) {
        throw new DomainError(
          'Randevuya 2 saatten az kaldığı için çevrimiçi erteleme yapılamaz. Lütfen işletmeyi arayın.',
          'CUTOFF',
        );
      }
    } else {
      await assertBusinessAccess(user, reservation.businessId);
    }

    await rescheduleReservation({
      id: parsed.data.reservationId,
      date: parsed.data.date,
      startMin: parsed.data.startMin,
      staffId: parsed.data.staffId,
      actorId: user.id,
      byStaff: !isCustomer,
    });
    return undefined;
  }, { action: 'rescheduleBookingAction' });
  if (result.ok) {
    revalidatePath('/randevularim');
    revalidatePath(`/randevularim/${(input as { reservationId?: string }).reservationId ?? ''}`);
  }
  return result;
}
