'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { saveBranchAction } from '@/app/actions/panel';
import { ANKARA_DISTRICTS, CITIES } from '@/lib/constants';

export type BranchRow = {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  phone: string | null;
  active: boolean;
};

export function BranchEditor({
  slug,
  businessId,
  branch,
  trigger = 'new',
}: {
  slug: string;
  businessId: string;
  branch?: BranchRow;
  trigger?: 'new' | 'edit';
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    const result = await saveBranchAction(slug, businessId, {
      ...(branch ? { id: branch.id } : {}),
      name: form.get('name'),
      city: form.get('city'),
      district: form.get('district'),
      address: form.get('address'),
      phone: form.get('phone') ?? '',
      active: form.get('active') === 'on',
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success(branch ? 'Şube güncellendi' : 'Şube eklendi');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger === 'new' ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          Şube ekle
        </Button>
      ) : (
        <Button size="iconSm" variant="ghost" onClick={() => setOpen(true)} aria-label="Şubeyi düzenle">
          <Pencil size={15} aria-hidden />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={branch ? 'Şubeyi düzenle' : 'Yeni şube'}
          description="Yeni şube varsayılan çalışma saatleriyle açılır."
        >
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Şube adı" htmlFor="b-name" error={fields['name']} required>
              <Input id="b-name" name="name" defaultValue={branch?.name ?? ''} required placeholder="Çankaya Merkez" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Şehir" htmlFor="b-city" error={fields['city']} required>
                <Select id="b-city" name="city" defaultValue={branch?.city ?? 'Ankara'}>
                  {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Semt" htmlFor="b-district" error={fields['district']} required>
                <Select id="b-district" name="district" defaultValue={branch?.district ?? 'Çankaya'}>
                  {ANKARA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Adres" htmlFor="b-address" error={fields['address']} required>
              <Input id="b-address" name="address" defaultValue={branch?.address ?? ''} required />
            </Field>

            <Field label="Telefon" htmlFor="b-phone" error={fields['phone']}>
              <Input id="b-phone" name="phone" defaultValue={branch?.phone ?? ''} placeholder="0312 123 45 67" />
            </Field>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5">
              <input
                type="checkbox"
                name="active"
                defaultChecked={branch?.active ?? true}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Şube aktif</span>
            </label>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button type="submit" loading={pending}>{branch ? 'Kaydet' : 'Şubeyi ekle'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
