'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { savePromotionAction, togglePromotionAction } from '@/app/actions/panel';
import { today, addDays } from '@/lib/time';

export type PromotionRow = {
  id: string;
  code: string;
  title: string;
  description: string;
  kind: string;
  value: number;
  minAmount: number;
  startsAt: string;
  endsAt: string;
  maxUses: number;
  active: boolean;
};

export function PromotionEditor({
  slug,
  businessId,
  promotion,
  trigger = 'new',
}: {
  slug: string;
  businessId: string;
  promotion?: PromotionRow;
  trigger?: 'new' | 'edit';
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    setError(null);
    const result = await savePromotionAction(slug, businessId, {
      ...(promotion ? { id: promotion.id } : {}),
      code: form.get('code'),
      title: form.get('title'),
      description: form.get('description') ?? '',
      kind: form.get('kind'),
      value: form.get('value'),
      minAmount: form.get('minAmount'),
      startsAt: form.get('startsAt'),
      endsAt: form.get('endsAt'),
      maxUses: form.get('maxUses'),
      active: form.get('active') === 'on',
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      setError(result.error);
      return;
    }
    toast.success(promotion ? 'Kampanya güncellendi' : 'Kampanya oluşturuldu');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger === 'new' ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          Kampanya ekle
        </Button>
      ) : (
        <Button
          size="iconSm"
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-label="Kampanyayı düzenle"
        >
          <Pencil size={15} aria-hidden />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={promotion ? 'Kampanyayı düzenle' : 'Yeni kampanya'}
          description="Kod, müşteri randevu oluştururken girilir."
        >
          {error ? (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Kod"
                htmlFor="p-code"
                error={fields['code']}
                required
                hint="Yalnızca harf ve rakam."
              >
                <Input
                  id="p-code"
                  name="code"
                  defaultValue={promotion?.code ?? ''}
                  required
                  className="uppercase"
                  placeholder="ILKRANDEVU"
                />
              </Field>
              <Field label="Başlık" htmlFor="p-title" error={fields['title']} required>
                <Input
                  id="p-title"
                  name="title"
                  defaultValue={promotion?.title ?? ''}
                  required
                  placeholder="İlk randevuya indirim"
                />
              </Field>
            </div>

            <Field label="Açıklama" htmlFor="p-desc" error={fields['description']}>
              <Textarea
                id="p-desc"
                name="description"
                defaultValue={promotion?.description ?? ''}
                maxLength={200}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tür" htmlFor="p-kind">
                <Select id="p-kind" name="kind" defaultValue={promotion?.kind ?? 'PERCENT'}>
                  <option value="PERCENT">Yüzde indirim</option>
                  <option value="AMOUNT">Tutar indirimi</option>
                </Select>
              </Field>
              <Field label="Değer" htmlFor="p-value" error={fields['value']} required>
                <Input
                  id="p-value"
                  name="value"
                  type="number"
                  min={1}
                  defaultValue={promotion?.value ?? 10}
                  required
                />
              </Field>
              <Field label="Alt limit (TL)" htmlFor="p-min" error={fields['minAmount']}>
                <Input
                  id="p-min"
                  name="minAmount"
                  type="number"
                  min={0}
                  step={50}
                  defaultValue={promotion?.minAmount ?? 0}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Başlangıç" htmlFor="p-start" error={fields['startsAt']} required>
                <Input
                  id="p-start"
                  name="startsAt"
                  type="date"
                  defaultValue={promotion?.startsAt ?? today()}
                  required
                />
              </Field>
              <Field label="Bitiş" htmlFor="p-end" error={fields['endsAt']} required>
                <Input
                  id="p-end"
                  name="endsAt"
                  type="date"
                  defaultValue={promotion?.endsAt ?? addDays(today(), 30)}
                  required
                />
              </Field>
              <Field label="Kullanım limiti" htmlFor="p-max" hint="0 = sınırsız">
                <Input
                  id="p-max"
                  name="maxUses"
                  type="number"
                  min={0}
                  defaultValue={promotion?.maxUses ?? 0}
                />
              </Field>
            </div>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5">
              <input
                type="checkbox"
                name="active"
                defaultChecked={promotion?.active ?? true}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Kampanya aktif</span>
            </label>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={pending}>
                {promotion ? 'Kaydet' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PromotionToggle({
  slug,
  id,
  active,
}: {
  slug: string;
  id: string;
  active: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    const result = await togglePromotionAction(slug, id, !active);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(active ? 'Kampanya durduruldu' : 'Kampanya yayında');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Kampanyayı durdur' : 'Kampanyayı yayınla'}
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
