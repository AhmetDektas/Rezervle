'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronLeft, Users, CalendarDays, Wallet, Info, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { slotsAction, createBookingAction, quoteBookingAction } from '@/app/actions/booking';
import { money, duration, relativeDay, weekdayShort, monthShort } from '@/lib/format';
import { hhmm, today, addDays } from '@/lib/time';
import { BOOKING_HORIZON_DAYS, termsFor } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Slot } from '@/lib/availability';
import { depositFor, depositPolicyText, type DepositPolicy } from '@/lib/deposit';

export type BookingBusiness = {
  id: string;
  slug: string;
  name: string;
  brandHue: number;
  /** Adım başlıkları ve "personel/saha/masa" terminolojisini belirler. */
  sector: string;
  /** Kapora paketi ayarları; kapalıysa hiçbir yerde görünmez. */
  deposit: DepositPolicy;
  branches: { id: string; name: string; district: string; address: string }[];
  services: { id: string; name: string; description: string; durationMin: number; price: number }[];
  staff: {
    id: string;
    displayName: string;
    title: string;
    hue: number;
    branchId: string | null;
    serviceIds: string[];
  }[];
};

const DATE_WINDOW = 14;

export function BookingFlow({
  business,
  loggedIn,
  initialServiceId,
}: {
  business: BookingBusiness;
  loggedIn: boolean;
  initialServiceId?: string | undefined;
}) {
  const router = useRouter();
  const toast = useToast();
  const terms = termsFor(business.sector);
  const steps = React.useMemo(
    () => ['Hizmet', terms.resource, 'Tarih ve saat', 'Onay'],
    [terms.resource],
  );

  const [step, setStep] = React.useState(initialServiceId ? 1 : 0);
  const [serviceId, setServiceId] = React.useState(initialServiceId ?? '');
  const [branchId, setBranchId] = React.useState(business.branches[0]?.id ?? '');
  const [staffId, setStaffId] = React.useState('ANY');
  const [date, setDate] = React.useState(today());
  const [startMin, setStartMin] = React.useState<number | null>(null);
  const [note, setNote] = React.useState('');
  const [promo, setPromo] = React.useState('');
  const [payment, setPayment] = React.useState<'AT_VENUE' | 'ONLINE'>('AT_VENUE');

  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const service = business.services.find((s) => s.id === serviceId) ?? null;
  const branch = business.branches.find((b) => b.id === branchId) ?? null;

  // Kampanya kodunun geçerliliği ve indirimi yalnızca sunucuda bilinir. Kod
  // girildiğinde tutarları sunucuya sorup öyle gösteriyoruz — ödeme ekranında
  // yazan tutar, tahsil edilecek tutarın aynısı olmak zorunda.
  const [quote, setQuote] = React.useState<{
    price: number;
    discount: number;
    finalPrice: number;
    deposit: number;
  } | null>(null);
  const [promoError, setPromoError] = React.useState<string | null>(null);
  const [quoting, setQuoting] = React.useState(false);

  const localPrice = service?.price ?? 0;
  const localDeposit = service ? depositFor(business.deposit, localPrice) : 0;
  const finalPrice = quote?.finalPrice ?? localPrice;
  const discount = quote?.discount ?? 0;
  const depositAmount = quote?.deposit ?? localDeposit;
  const eligibleStaff = business.staff.filter(
    (s) => s.serviceIds.includes(serviceId) && (s.branchId === branchId || s.branchId === null),
  );
  const staff = business.staff.find((s) => s.id === staffId) ?? null;

  const dates = React.useMemo(
    () => Array.from({ length: DATE_WINDOW }, (_, i) => addDays(today(), i)),
    [],
  );

  // Seçim değiştiğinde saatler yeniden istenir; eski seçim geçersizse düşer.
  React.useEffect(() => {
    if (step !== 2 || !serviceId || !branchId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlots(null);
    slotsAction({ branchId, serviceId, staffId, date })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSlots(result.data);
          setStartMin((prev) => (prev !== null && result.data.some((s) => s.startMin === prev) ? prev : null));
        } else {
          setSlots([]);
          setError(result.error);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [step, serviceId, branchId, staffId, date]);

  // Kod veya hizmet değiştiğinde tutarları tazele. Kod boşsa sunucuya gitmeye
  // gerek yok: yerel hesap zaten doğru.
  React.useEffect(() => {
    if (step !== 3 || !serviceId) return;
    const code = promo.trim();
    if (!code) {
      setQuote(null);
      setPromoError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      quoteBookingAction({ businessId: business.id, serviceId, promotionCode: code })
        .then((result) => {
          if (cancelled) return;
          if (result.ok) {
            setQuote(result.data);
            setPromoError(null);
          } else {
            setQuote(null);
            setPromoError(result.error);
          }
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(timer);
    };
  }, [step, serviceId, promo, business.id]);

  function goto(next: number) {
    setError(null);
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    if (!service || !branch || startMin === null) return;
    if (!loggedIn) {
      router.push(`/giris?next=${encodeURIComponent(`/isletme/${business.slug}/randevu?hizmet=${serviceId}`)}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await createBookingAction({
      businessId: business.id,
      branchId,
      serviceId,
      staffId,
      date,
      startMin,
      note: note.trim() || undefined,
      promotionCode: promo.trim() || undefined,
      paymentMethod: payment,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      // Slot kapıldıysa kullanıcıyı saat adımına geri al ve listeyi tazele.
      if (result.code === 'SLOT_TAKEN') {
        setStartMin(null);
        goto(2);
      }
      toast.error(result.error);
      return;
    }
    // 3DS gerekiyorsa randevu HENÜZ kesinleşmedi: "oluşturuldu" demek yalan
    // olurdu. Müşteri bankaya gidiyor, sonucu webhook getiriyor.
    if (result.data.redirectUrl) {
      window.location.href = result.data.redirectUrl;
      return;
    }
    toast.success('Randevunuz oluşturuldu', `Kod: ${result.data.code}`);
    router.push(`/randevularim/${result.data.reservationId}?yeni=1`);
    router.refresh();
  }

  const canNext =
    (step === 0 && Boolean(serviceId)) ||
    (step === 1 && Boolean(branchId) && eligibleStaff.length > 0) ||
    (step === 2 && startMin !== null) ||
    step === 3;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-4 sm:px-6 sm:pb-10">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="iconSm"
          onClick={() => (step === 0 ? router.push(`/isletme/${business.slug}`) : goto(step - 1))}
          aria-label="Geri"
        >
          <ChevronLeft size={18} aria-hidden />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-3">{business.name}</p>
          <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Randevu oluştur</h1>
        </div>
      </div>

      <Stepper steps={steps} step={step} onStep={(i) => (i < step ? goto(i) : undefined)} />

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-5">
        {step === 0 ? (
          <fieldset>
            <legend className="section-title">{terms.servicePrompt}</legend>
            <ul className="mt-3 space-y-2.5">
              {business.services.map((s) => (
                <li key={s.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-4 transition',
                      serviceId === s.id
                        ? 'border-brand-500 ring-2 ring-brand-100'
                        : 'border-line hover:border-brand-300',
                    )}
                  >
                    <input
                      type="radio"
                      name="service"
                      value={s.id}
                      checked={serviceId === s.id}
                      onChange={() => {
                        setServiceId(s.id);
                        setStaffId('ANY');
                        setStartMin(null);
                      }}
                      className="h-[18px] w-[18px] shrink-0 border-line-strong text-brand-500 focus:ring-brand-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-medium text-navy">{s.name}</p>
                      {s.description ? (
                        <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-3">{s.description}</p>
                      ) : null}
                      <p className="tnum mt-1 text-[12.5px] text-ink-3">{duration(s.durationMin)}</p>
                    </div>
                    <span className="tnum shrink-0 text-[15px] font-semibold text-navy">
                      {s.price === 0 ? 'Ücretsiz' : money(s.price)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <div className="space-y-6">
            {business.branches.length > 1 ? (
              <fieldset>
                <legend className="section-title">Hangi şube?</legend>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {business.branches.map((b) => (
                    <li key={b.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer flex-col rounded-2xl border bg-surface p-4 transition',
                          branchId === b.id ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-300',
                        )}
                      >
                        <input
                          type="radio"
                          name="branch"
                          value={b.id}
                          checked={branchId === b.id}
                          onChange={() => {
                            setBranchId(b.id);
                            setStaffId('ANY');
                            setStartMin(null);
                          }}
                          className="sr-only"
                        />
                        <span className="text-[14.5px] font-medium text-navy">{b.name}</span>
                        <span className="mt-0.5 text-[13px] text-ink-3">{b.address}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}

            <fieldset>
              <legend className="section-title">{terms.pickPrompt}</legend>
              {eligibleStaff.length === 0 ? (
                <EmptyState
                  className="mt-3"
                  icon={<Users size={20} />}
                  title={`Bu şubede uygun ${terms.resource.toLocaleLowerCase('tr-TR')} yok`}
                  description="Başka bir şube veya seçenek denemeyi deneyin."
                />
              ) : (
                <ul className="mt-3 space-y-2.5">
                  <li>
                    <StaffOption
                      selected={staffId === 'ANY'}
                      onSelect={() => {
                        setStaffId('ANY');
                        setStartMin(null);
                      }}
                      title="Fark etmez"
                      subtitle={terms.anyHint(eligibleStaff.length)}
                    />
                  </li>
                  {eligibleStaff.map((s) => (
                    <li key={s.id}>
                      <StaffOption
                        selected={staffId === s.id}
                        onSelect={() => {
                          setStaffId(s.id);
                          setStartMin(null);
                        }}
                        title={s.displayName}
                        subtitle={s.title}
                        hue={s.hue}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <h2 className="section-title">Tarih seçin</h2>
            <ul className="rail mt-3" role="listbox" aria-label="Tarih">
              {dates.map((d) => {
                const active = d === date;
                return (
                  <li key={d} className="shrink-0 snap-start">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setDate(d);
                        setStartMin(null);
                      }}
                      className={cn(
                        'flex h-[68px] w-[62px] flex-col items-center justify-center rounded-2xl border text-center transition',
                        active
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-line bg-surface text-ink-2 hover:border-brand-300',
                      )}
                    >
                      <span className={cn('text-[11.5px]', active ? 'text-white/80' : 'text-ink-3')}>
                        {weekdayShort(d)}
                      </span>
                      <span className="tnum text-[19px] font-semibold leading-tight">
                        {Number(d.slice(8, 10))}
                      </span>
                      <span className={cn('text-[10.5px]', active ? 'text-white/80' : 'text-ink-3')}>
                        {relativeDay(d) === 'Bugün' ? 'Bugün' : monthShort(d)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <h2 className="section-title mt-6">Saat seçin</h2>
            <p className="muted mt-0.5">{relativeDay(date)} · {service ? duration(service.durationMin) : ''}</p>

            <div className="mt-3">
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="status" aria-label="Saatler yükleniyor">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 rounded-xl" />
                  ))}
                </div>
              ) : slots && slots.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((s) => {
                    const active = startMin === s.startMin;
                    return (
                      <li key={s.startMin}>
                        <button
                          type="button"
                          onClick={() => setStartMin(s.startMin)}
                          aria-pressed={active}
                          className={cn(
                            'tnum h-11 w-full rounded-xl border text-[14px] font-medium transition',
                            active
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-line bg-surface text-navy hover:border-brand-300 hover:bg-brand-50',
                          )}
                        >
                          {hhmm(s.startMin)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<CalendarDays size={20} />}
                  title="Bu gün için uygun saat yok"
                  description="Başka bir gün veya personel seçmeyi deneyin. Yoğun günlerde saatler hızlı doluyor."
                />
              )}
            </div>
          </div>
        ) : null}

        {step === 3 && service && branch ? (
          <div className="space-y-5">
            <h2 className="section-title">Randevu özeti</h2>
            <dl className="card divide-y divide-line">
              <Row label="Hizmet" value={service.name} />
              <Row label="İşletme" value={`${business.name} · ${branch.name}`} />
              <Row
                label={terms.resource}
                value={
                  staff
                    ? staff.displayName
                    : `Fark etmez (uygun ${terms.resource.toLocaleLowerCase('tr-TR')} atanır)`
                }
              />
              <Row
                label="Tarih ve saat"
                value={`${relativeDay(date)} · ${startMin !== null ? hhmm(startMin) : '—'}`}
              />
              <Row label="Süre" value={duration(service.durationMin)} />
              <Row label="Adres" value={branch.address} />
            </dl>

            {discount > 0 || depositAmount > 0 ? (
              <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={17} className="shrink-0 text-brand-600" aria-hidden />
                  <p className="text-[14.5px] font-semibold text-brand-700">
                    {depositAmount > 0 ? `Kapora: ${money(depositAmount)}` : 'Kampanya uygulandı'}
                  </p>
                </div>
                <dl className="mt-3 space-y-1.5 border-t border-brand-200 pt-3 text-[13.5px]">
                  <div className="flex justify-between">
                    <dt className="text-brand-700">Hizmet ücreti</dt>
                    <dd className="tnum text-brand-700">{money(localPrice)}</dd>
                  </div>
                  {discount > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-brand-700">Kampanya indirimi</dt>
                      <dd className="tnum font-semibold text-brand-700">−{money(discount)}</dd>
                    </div>
                  ) : null}
                  {depositAmount > 0 ? (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-brand-700">Şimdi ödenecek kapora</dt>
                        <dd className="tnum font-semibold text-brand-700">{money(depositAmount)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-brand-700">İşletmede ödenecek</dt>
                        <dd className="tnum font-semibold text-brand-700">
                          {money(Math.max(0, finalPrice - depositAmount))}
                        </dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <dt className="text-brand-700">İşletmede ödenecek</dt>
                      <dd className="tnum font-semibold text-brand-700">{money(finalPrice)}</dd>
                    </div>
                  )}
                </dl>
                {depositAmount > 0 ? (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-brand-700">
                    {depositPolicyText(business.deposit, depositAmount)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <Field label="İşletmeye not (isteğe bağlı)" htmlFor="note">
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Örn. ilk kez geliyorum, otopark gerekiyor."
              />
            </Field>

            <Field
              label="Kampanya kodu"
              htmlFor="promo"
              error={promoError ?? undefined}
              hint={
                promoError
                  ? undefined
                  : quoting
                    ? 'Kod kontrol ediliyor…'
                    : discount > 0
                      ? `Kod geçerli — ${money(discount)} indirim uygulandı.`
                      : 'Varsa kodunuzu girin; tutarlar hemen güncellenir.'
              }
            >
              {/*
                Yer tutucu daha önce "REZZERV100" yazıyordu. Bu gerçek ve aktif
                bir kampanya kodu (₺100, platform geneli) ve hoş geldin
                bildiriminde müşteriye bu kod söyleniyor. Gri yer tutucu metni
                dolu bir alan gibi göründüğü için müşteri kodun uygulandığını
                sanıp tam fiyat ödeyebiliyordu. Yer tutucu artık girdiyle
                karışmayacak bir yönerge.
              */}
              <Input
                id="promo"
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                placeholder="Kodu buraya yazın"
                className="uppercase placeholder:normal-case"
                aria-invalid={Boolean(promoError)}
              />
            </Field>

            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2">
                {depositAmount > 0 ? 'Kalan tutarın ödemesi' : 'Ödeme'}
              </legend>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                <PaymentOption
                  selected={payment === 'AT_VENUE'}
                  onSelect={() => setPayment('AT_VENUE')}
                  title="İşletmede öde"
                  subtitle="Randevu sonunda kasada ödersiniz."
                />
                <PaymentOption
                  selected={payment === 'ONLINE'}
                  onSelect={() => setPayment('ONLINE')}
                  title="Online öde (demo)"
                  subtitle="Test sağlayıcısı kullanılır, kart bilgisi istenmez."
                />
              </div>
            </fieldset>

            {!loggedIn ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-warn-line bg-warn-soft px-3.5 py-3 text-[13.5px] text-warn">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
                <span>
                  Randevuyu tamamlamak için giriş yapmanız gerekiyor. Seçimleriniz korunur.
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Sabit alt bar: seçim özeti ve birincil eylem her zaman görünür. */}
      <div className="fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:static sm:mt-8 sm:rounded-2xl sm:border sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] text-ink-3">
              {service ? service.name : 'Hizmet seçilmedi'}
              {startMin !== null ? ` · ${relativeDay(date)} ${hhmm(startMin)}` : ''}
            </p>
            <p className="tnum text-[16px] font-semibold text-navy">
              {!service ? '—' : finalPrice === 0 ? 'Ücretsiz' : money(finalPrice)}
              {discount > 0 ? (
                <span className="ml-1.5 text-[12px] font-normal text-ink-3 line-through">
                  {money(localPrice)}
                </span>
              ) : null}
              {depositAmount > 0 ? (
                <span className="ml-1.5 text-[12px] font-medium text-brand-600">
                  · {money(depositAmount)} kapora
                </span>
              ) : null}
            </p>
          </div>
          {step < 3 ? (
            <Button onClick={() => goto(step + 1)} disabled={!canNext} size="lg">
              Devam
            </Button>
          ) : (
            <Button
              onClick={submit}
              loading={submitting}
              size="lg"
              disabled={startMin === null || quoting || Boolean(promoError)}
            >
              {!loggedIn
                ? 'Giriş yap ve onayla'
                : depositAmount > 0
                  ? `${money(depositAmount)} öde ve onayla`
                  : 'Randevuyu onayla'}
            </Button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-[12.5px] text-ink-3 sm:mt-6">
        En fazla {BOOKING_HORIZON_DAYS} gün sonrasına randevu alınabilir.{' '}
        <Link href={`/isletme/${business.slug}`} className="underline hover:text-ink-2">
          İşletme sayfasına dön
        </Link>
      </p>
    </div>
  );
}

function Stepper({
  steps,
  step,
  onStep,
}: {
  steps: string[];
  step: number;
  onStep: (i: number) => void;
}) {
  return (
    <ol className="mt-4 flex items-center gap-1.5" aria-label="Adımlar">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onStep(i)}
              disabled={i >= step}
              aria-current={active ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5 text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  'h-1.5 rounded-full transition',
                  done ? 'bg-brand-500' : active ? 'bg-brand-400' : 'bg-line-strong',
                )}
              />
              <span
                className={cn(
                  'truncate text-[11.5px] font-medium',
                  active ? 'text-brand-700' : done ? 'text-ink-2' : 'text-ink-3',
                )}
              >
                {done ? <Check size={11} className="mr-0.5 inline" aria-hidden /> : null}
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StaffOption({
  selected,
  onSelect,
  title,
  subtitle,
  hue,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  hue?: number;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-2xl border bg-surface p-3.5 transition',
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-300',
      )}
    >
      <input
        type="radio"
        name="staff"
        checked={selected}
        onChange={onSelect}
        className="h-[18px] w-[18px] shrink-0 border-line-strong text-brand-500 focus:ring-brand-500"
      />
      {hue !== undefined ? (
        <Avatar name={title} size={40} hue={hue} />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Users size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[14.5px] font-medium text-navy">{title}</p>
        <p className="truncate text-[13px] text-ink-3">{subtitle}</p>
      </div>
    </label>
  );
}

function PaymentOption({
  selected,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface p-3.5 transition',
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-300',
      )}
    >
      <input
        type="radio"
        name="payment"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 h-[18px] w-[18px] shrink-0 border-line-strong text-brand-500 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-navy">
          <Wallet size={15} className="text-ink-3" aria-hidden />
          {title}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-ink-3">{subtitle}</span>
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-[14px] font-medium text-navy">{value}</dd>
    </div>
  );
}
