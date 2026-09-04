'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { slotsAction } from '@/app/actions/booking';
import { panelCreateReservationAction } from '@/app/actions/panel';
import { hhmm, today } from '@/lib/time';
import { money, duration } from '@/lib/format';
import { CHANNELS, CHANNEL_LABEL, termsFor } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Slot } from '@/lib/availability';

export type PanelBookingData = {
  businessId: string;
  slug: string;
  /** Etiketleri sektöre uyarlar: personel / saha / masa. */
  sector: string;
  branches: { id: string; name: string }[];
  services: { id: string; name: string; durationMin: number; price: number }[];
  staff: { id: string; displayName: string; branchId: string | null; serviceIds: string[] }[];
};

/** Panelden telefon/kapı randevusu açma. Aynı uygunluk motorunu kullanır. */
export function NewReservationDialog({
  data,
  defaultDate,
  defaultOpen = false,
}: {
  data: PanelBookingData;
  defaultDate?: string;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const terms = termsFor(data.sector);
  const [open, setOpen] = React.useState(defaultOpen);

  const [branchId, setBranchId] = React.useState(data.branches[0]?.id ?? '');
  const [serviceId, setServiceId] = React.useState(data.services[0]?.id ?? '');
  const [staffId, setStaffId] = React.useState('ANY');
  const [date, setDate] = React.useState(defaultDate ?? today());
  const [startMin, setStartMin] = React.useState<number | null>(null);
  const [channel, setChannel] = React.useState<string>('PHONE');
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [note, setNote] = React.useState('');

  const [slots, setSlots] = React.useState<Slot[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const eligible = data.staff.filter(
    (s) => s.serviceIds.includes(serviceId) && (s.branchId === branchId || s.branchId === null),
  );

  React.useEffect(() => {
    if (!open || !serviceId || !branchId) return;
    let cancelled = false;
    setLoading(true);
    setSlots(null);
    slotsAction({ branchId, serviceId, staffId, date })
      .then((result) => {
        if (cancelled) return;
        setSlots(result.ok ? result.data : []);
        setStartMin(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, branchId, serviceId, staffId, date]);

  async function submit() {
    setPending(true);
    setError(null);
    setFields({});
    const result = await panelCreateReservationAction(data.slug, {
      businessId: data.businessId,
      branchId,
      serviceId,
      staffId,
      date,
      startMin: startMin ?? -1,
      channel,
      customerName: name,
      customerPhone: phone,
      note: note.trim() || undefined,
      paymentMethod: 'AT_VENUE',
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success('Randevu oluşturuldu');
    setOpen(false);
    setName('');
    setPhone('');
    setNote('');
    setStartMin(null);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CalendarPlus size={15} aria-hidden />
        Randevu ekle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Yeni randevu"
          description="Telefonla veya kapıdan gelen talepleri buradan kaydedin."
          size="lg"
        >
          {error ? (
            <div role="alert" className="mb-4 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] text-danger">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Müşteri adı" htmlFor="n-name" error={fields['customerName']} required>
              <Input id="n-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad soyad" required />
            </Field>
            <Field label="Telefon" htmlFor="n-phone" error={fields['customerPhone']} required hint="Aynı numara varsa mevcut müşteriye bağlanır.">
              <Input id="n-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0532 123 45 67" inputMode="tel" required />
            </Field>

            {data.branches.length > 1 ? (
              <Field label="Şube" htmlFor="n-branch">
                <Select id="n-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  {data.branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Hizmet" htmlFor="n-service" error={fields['serviceId']}>
              <Select
                id="n-service"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setStaffId('ANY');
                }}
              >
                {data.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {duration(s.durationMin)} · {money(s.price)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={terms.resource} htmlFor="n-staff">
              <Select id="n-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
                <option value="ANY">Fark etmez ({eligible.length})</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>{s.displayName}</option>
                ))}
              </Select>
            </Field>

            <Field label="Tarih" htmlFor="n-date" error={fields['date']}>
              <Input id="n-date" type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <Field label="Kanal" htmlFor="n-channel">
              <Select id="n-channel" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {CHANNELS.filter((c) => c !== 'ONLINE').map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="mt-4">
            <p className="text-[13px] font-medium text-ink-2">
              Saat {service ? `· ${duration(service.durationMin)}` : ''}
            </p>
            <div className="mt-2">
              {loading ? (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : slots && slots.length > 0 ? (
                <ul className="grid max-h-[180px] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
                  {slots.map((s) => (
                    <li key={s.startMin}>
                      <button
                        type="button"
                        onClick={() => setStartMin(s.startMin)}
                        aria-pressed={startMin === s.startMin}
                        className={cn(
                          'tnum h-10 w-full rounded-lg border text-[13px] font-medium transition',
                          startMin === s.startMin
                            ? 'border-brand-500 bg-brand-500 text-white'
                            : 'border-line bg-surface text-navy hover:border-brand-300',
                        )}
                      >
                        {hhmm(s.startMin)}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13.5px] text-ink-3">
                  Bu gün için uygun saat yok. Seçenek, {terms.resource.toLocaleLowerCase('tr-TR')}{' '}
                  veya tarihi değiştirin.
                </p>
              )}
            </div>
          </div>

          <div className="mt-4">
            <Field label="Not (isteğe bağlı)" htmlFor="n-note">
              <Textarea id="n-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              onClick={submit}
              loading={pending}
              disabled={startMin === null || !name.trim() || !phone.trim()}
            >
              Randevuyu oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
