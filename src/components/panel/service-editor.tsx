'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { saveServiceAction, toggleServiceAction } from '@/app/actions/panel';

export type ServiceRow = {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  price: number;
  active: boolean;
  staffIds: string[];
};

export type StaffOption = { id: string; displayName: string };

export function ServiceEditor({
  slug,
  businessId,
  staff,
  service,
  trigger = 'new',
}: {
  slug: string;
  businessId: string;
  staff: StaffOption[];
  service?: ServiceRow;
  trigger?: 'new' | 'edit';
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [staffIds, setStaffIds] = React.useState<string[]>(service?.staffIds ?? staff.map((s) => s.id));

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    const result = await saveServiceAction(slug, businessId, {
      ...(service ? { id: service.id } : {}),
      name: form.get('name'),
      description: form.get('description') ?? '',
      durationMin: form.get('durationMin'),
      bufferMin: form.get('bufferMin'),
      price: form.get('price'),
      active: form.get('active') === 'on',
      staffIds,
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success(service ? 'Hizmet güncellendi' : 'Hizmet eklendi');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger === 'new' ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          Hizmet ekle
        </Button>
      ) : (
        <Button size="iconSm" variant="ghost" onClick={() => setOpen(true)} aria-label="Hizmeti düzenle">
          <Pencil size={15} aria-hidden />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={service ? 'Hizmeti düzenle' : 'Yeni hizmet'}
          description="Süre ve tampon, takvimdeki blok uzunluğunu belirler."
        >
          <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Hizmet adı" htmlFor="s-name" error={fields['name']} required>
              <Input id="s-name" name="name" defaultValue={service?.name ?? ''} required />
            </Field>

            <Field label="Açıklama" htmlFor="s-desc" error={fields['description']}>
              <Textarea id="s-desc" name="description" defaultValue={service?.description ?? ''} maxLength={400} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Süre (dk)" htmlFor="s-dur" error={fields['durationMin']} required>
                <Input id="s-dur" name="durationMin" type="number" min={5} max={600} step={5} defaultValue={service?.durationMin ?? 30} required />
              </Field>
              <Field label="Tampon (dk)" htmlFor="s-buf" error={fields['bufferMin']} hint="Hazırlık payı">
                <Input id="s-buf" name="bufferMin" type="number" min={0} max={120} step={5} defaultValue={service?.bufferMin ?? 10} />
              </Field>
              <Field label="Fiyat (TL)" htmlFor="s-price" error={fields['price']} required>
                <Input id="s-price" name="price" type="number" min={0} step={50} defaultValue={service?.price ?? 0} required />
              </Field>
            </div>

            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2">Bu hizmeti verebilen personel</legend>
              <p className="mt-0.5 text-[12.5px] text-ink-3">
                Seçilmeyen personel bu hizmet için randevu alamaz.
              </p>
              <div className="mt-2 space-y-1.5">
                {staff.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Önce personel eklemelisiniz.</p>
                ) : (
                  staff.map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5"
                    >
                      <input
                        type="checkbox"
                        checked={staffIds.includes(s.id)}
                        onChange={(e) =>
                          setStaffIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )
                        }
                        className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-[14px] text-navy">{s.displayName}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5">
              <input
                type="checkbox"
                name="active"
                defaultChecked={service?.active ?? true}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Hizmet aktif (müşteriler randevu alabilir)</span>
            </label>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={pending}>
                {service ? 'Kaydet' : 'Hizmeti ekle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Listeden hızlı aç/kapat. */
export function ServiceToggle({
  slug,
  serviceId,
  active,
}: {
  slug: string;
  serviceId: string;
  active: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    const result = await toggleServiceAction(slug, serviceId, !active);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(active ? 'Hizmet pasife alındı' : 'Hizmet aktifleştirildi');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Hizmeti pasife al' : 'Hizmeti aktifleştir'}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        active ? 'bg-brand-500' : 'bg-line-strong'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          active ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
