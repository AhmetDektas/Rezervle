'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, CalendarOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  saveStaffAction,
  toggleStaffAction,
  saveTimeOffAction,
  deleteTimeOffAction,
} from '@/app/actions/panel';

export type StaffRow = {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  branchId: string | null;
  active: boolean;
  serviceIds: string[];
};

export function StaffEditor({
  slug,
  businessId,
  branches,
  services,
  staff,
  trigger = 'new',
  resource = 'Personel',
}: {
  slug: string;
  businessId: string;
  branches: { id: string; name: string }[];
  services: { id: string; name: string }[];
  staff?: StaffRow;
  trigger?: 'new' | 'edit';
  /** "Personel" / "Saha" / "Masa" — sektöre göre başlık ve etiketler. */
  resource?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [serviceIds, setServiceIds] = React.useState<string[]>(
    staff?.serviceIds ?? services.map((s) => s.id),
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFields({});
    const result = await saveStaffAction(slug, businessId, {
      ...(staff ? { id: staff.id } : {}),
      displayName: form.get('displayName'),
      title: form.get('title') ?? '',
      bio: form.get('bio') ?? '',
      branchId: form.get('branchId') ?? '',
      active: form.get('active') === 'on',
      serviceIds,
    });
    setPending(false);
    if (!result.ok) {
      setFields(result.fields ?? {});
      toast.error(result.error);
      return;
    }
    toast.success(`${resource} ${staff ? 'güncellendi' : 'eklendi'}`);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {trigger === 'new' ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          {resource} ekle
        </Button>
      ) : (
        <Button size="iconSm" variant="ghost" onClick={() => setOpen(true)} aria-label={`${resource} düzenle`}>
          <Pencil size={15} aria-hidden />
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={staff ? `${resource} düzenle` : `Yeni ${resource.toLocaleLowerCase('tr-TR')}`}
          description={`Yeni ${resource.toLocaleLowerCase('tr-TR')} varsayılan şube saatleriyle başlar; saatleri sonra düzenleyebilirsiniz.`}
        >
          <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label={`${resource} adı`} htmlFor="st-name" error={fields['displayName']} required>
              <Input id="st-name" name="displayName" defaultValue={staff?.displayName ?? ''} required />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Unvan / açıklama" htmlFor="st-title" error={fields['title']}>
                <Input id="st-title" name="title" defaultValue={staff?.title ?? ''} placeholder="Diş Hekimi" />
              </Field>
              <Field label="Şube" htmlFor="st-branch">
                <Select id="st-branch" name="branchId" defaultValue={staff?.branchId ?? ''}>
                  <option value="">Tüm şubeler</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Kısa tanıtım" htmlFor="st-bio" error={fields['bio']}>
              <Textarea id="st-bio" name="bio" defaultValue={staff?.bio ?? ''} maxLength={400} />
            </Field>

            <fieldset>
              <legend className="text-[13px] font-medium text-ink-2">Sunulan seçenekler</legend>
              <div className="mt-2 space-y-1.5">
                {services.length === 0 ? (
                  <p className="text-[13px] text-ink-3">Önce hizmet tanımlamalısınız.</p>
                ) : (
                  services.map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5"
                    >
                      <input
                        type="checkbox"
                        checked={serviceIds.includes(s.id)}
                        onChange={(e) =>
                          setServiceIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )
                        }
                        className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
                      />
                      <span className="text-[14px] text-navy">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </fieldset>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5">
              <input
                type="checkbox"
                name="active"
                defaultChecked={staff?.active ?? true}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Aktif (randevu alabilir)</span>
            </label>

            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button type="submit" loading={pending}>
                {staff ? 'Kaydet' : `${resource} ekle`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StaffToggle({
  slug,
  staffId,
  active,
}: {
  slug: string;
  staffId: string;
  active: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    const result = await toggleStaffAction(slug, staffId, !active);
    setPending(false);
    if (!result.ok) {
      toast.error('İşlem yapılamadı', result.error);
      return;
    }
    toast.success(active ? 'Pasife alındı' : 'Aktifleştirildi');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={active}
      aria-label={active ? 'Pasife al' : 'Aktifleştir'}
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

export function TimeOffEditor({
  slug,
  staffId,
  staffName,
}: {
  slug: string;
  staffId: string;
  staffName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const start = String(form.get('start') ?? '');
    const end = String(form.get('end') ?? '');
    setPending(true);
    setError(null);
    const result = await saveTimeOffAction(slug, {
      staffId,
      startsAt: `${start}T00:00:00`,
      endsAt: `${end}T23:59:00`,
      reason: String(form.get('reason') ?? ''),
      type: String(form.get('type') ?? 'LEAVE'),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success('İzin kaydedildi');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <CalendarOff size={15} aria-hidden />
        İzin
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`${staffName} — izin ekle`}
          description="İzinli aralıkta randevu verilemez."
          size="sm"
        >
          {error ? (
            <div role="alert" className="mb-3 rounded-xl border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          ) : null}
          <form method="post" onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Başlangıç" htmlFor="to-start" required>
                <Input id="to-start" name="start" type="date" required />
              </Field>
              <Field label="Bitiş" htmlFor="to-end" required>
                <Input id="to-end" name="end" type="date" required />
              </Field>
            </div>
            <Field label="Tür" htmlFor="to-type">
              <Select id="to-type" name="type" defaultValue="LEAVE">
                <option value="LEAVE">Yıllık izin</option>
                <option value="BLOCK">Blok (eğitim, toplantı)</option>
                <option value="HOLIDAY">Resmî tatil</option>
              </Select>
            </Field>
            <Field label="Açıklama" htmlFor="to-reason">
              <Input id="to-reason" name="reason" maxLength={200} placeholder="Yıllık izin" />
            </Field>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button type="submit" loading={pending}>Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteTimeOff({ slug, id }: { slug: string; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function remove() {
    setPending(true);
    const result = await deleteTimeOffAction(slug, id);
    setPending(false);
    setOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('İzin kaldırıldı');
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-1.5 text-ink-3 transition hover:bg-danger-soft hover:text-danger"
        aria-label="İzni kaldır"
      >
        <Trash2 size={14} aria-hidden />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="İzin kaldırılsın mı?"
        description="Bu aralık yeniden randevuya açılır."
        confirmLabel="Kaldır"
        loading={pending}
        onConfirm={remove}
      />
    </>
  );
}
