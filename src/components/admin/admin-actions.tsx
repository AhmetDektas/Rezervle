'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, PauseCircle, PlayCircle, Star, Plus, Pencil, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  setBusinessStatusAction,
  toggleFeaturedAction,
  setUserActiveAction,
  setUserRoleAction,
  moderateReviewAction,
  saveCategoryAction,
  toggleDepositAddonAction,
} from '@/app/actions/admin';
import { ROLES, ROLE_LABEL, SECTORS, SECTOR_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function BusinessStatusActions({
  businessId,
  status,
  featured,
  depositAddon,
}: {
  businessId: string;
  status: string;
  featured: boolean;
  /** Kapora paketi bu işletme için açık mı? */
  depositAddon: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  async function apply(next: string, why?: string) {
    setPending(next);
    const result = await setBusinessStatusAction(businessId, next, why);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRejectOpen(false);
    setSuspendOpen(false);
    setReason('');
    toast.success('İşletme durumu güncellendi');
    router.refresh();
  }

  async function toggleAddon() {
    setPending('addon');
    const result = await toggleDepositAddonAction(businessId, !depositAddon);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(depositAddon ? 'Kapora paketi kapatıldı' : 'Kapora paketi etkinleştirildi');
    router.refresh();
  }

  async function toggleFeatured() {
    setPending('featured');
    const result = await toggleFeaturedAction(businessId, !featured);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(featured ? 'Öne çıkarma kaldırıldı' : 'Ana sayfada öne çıkarıldı');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status !== 'APPROVED' ? (
        <Button size="sm" loading={pending === 'APPROVED'} onClick={() => apply('APPROVED')}>
          <Check size={15} aria-hidden />
          Onayla
        </Button>
      ) : null}

      {status === 'PENDING' ? (
        <Button size="sm" variant="ghost" onClick={() => setRejectOpen(true)}>
          <X size={15} aria-hidden />
          Reddet
        </Button>
      ) : null}

      {status === 'APPROVED' ? (
        <>
          <Button
            size="sm"
            variant={featured ? 'soft' : 'secondary'}
            loading={pending === 'featured'}
            onClick={toggleFeatured}
          >
            <Star size={15} className={featured ? 'fill-brand-600' : ''} aria-hidden />
            {featured ? 'Öne çıkarıldı' : 'Öne çıkar'}
          </Button>
          <Button
            size="sm"
            variant={depositAddon ? 'soft' : 'secondary'}
            loading={pending === 'addon'}
            onClick={toggleAddon}
            title="Kapora paketi: işletme açtığında müşteriden kapora istenir"
          >
            <Wallet size={15} aria-hidden />
            {depositAddon ? 'Kapora paketi açık' : 'Kapora paketi ver'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSuspendOpen(true)}>
            <PauseCircle size={15} aria-hidden />
            Askıya al
          </Button>
        </>
      ) : null}

      {status === 'SUSPENDED' || status === 'REJECTED' ? (
        <Button size="sm" variant="secondary" loading={pending === 'APPROVED'} onClick={() => apply('APPROVED')}>
          <PlayCircle size={15} aria-hidden />
          Yeniden yayınla
        </Button>
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent
          title="Başvuruyu reddet"
          description="Gerekçe işletme sahibine bildirim olarak iletilir."
          size="sm"
        >
          <Field label="Gerekçe" htmlFor="reject-reason" required>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Örn. işletme belgeleri doğrulanamadı."
              maxLength={300}
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setRejectOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={pending === 'REJECTED'}
              disabled={reason.trim().length < 3}
              onClick={() => apply('REJECTED', reason)}
            >
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="İşletme askıya alınsın mı?"
        description="Askıdayken işletme aramalarda görünmez ve yeni randevu alamaz. Mevcut randevular korunur."
        confirmLabel="Askıya al"
        loading={pending === 'SUSPENDED'}
        onConfirm={() => apply('SUSPENDED', 'Yönetici tarafından askıya alındı')}
      />
    </div>
  );
}

export function UserRowActions({
  userId,
  role,
  active,
  self,
}: {
  userId: string;
  role: string;
  active: boolean;
  self: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function changeRole(next: string) {
    setPending(true);
    const result = await setUserRoleAction(userId, next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Rol güncellendi');
    router.refresh();
  }

  async function toggleActive() {
    setPending(true);
    const result = await setUserActiveAction(userId, !active);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(active ? 'Hesap kapatıldı' : 'Hesap açıldı');
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select
        aria-label="Rol"
        value={role}
        disabled={self || pending}
        onChange={(e) => changeRole(e.target.value)}
        className="h-9 w-[150px] text-[13px]"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
      <Button
        size="sm"
        variant={active ? 'ghost' : 'secondary'}
        onClick={toggleActive}
        disabled={self || pending}
      >
        {active ? 'Kapat' : 'Aç'}
      </Button>
    </div>
  );
}

export function ReviewModeration({ reviewId, status }: { reviewId: string; status: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);

  async function apply(next: 'PUBLISHED' | 'HIDDEN') {
    setPending(true);
    const result = await moderateReviewAction(reviewId, next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(next === 'HIDDEN' ? 'Değerlendirme gizlendi' : 'Değerlendirme yayınlandı');
    router.refresh();
  }

  return (
    <div className="flex gap-1.5">
      {status !== 'PUBLISHED' ? (
        <Button size="sm" variant="secondary" loading={pending} onClick={() => apply('PUBLISHED')}>
          <Check size={15} aria-hidden />
          Yayınla
        </Button>
      ) : null}
      {status !== 'HIDDEN' ? (
        <Button size="sm" variant="dangerGhost" loading={pending} onClick={() => apply('HIDDEN')}>
          <X size={15} aria-hidden />
          Gizle
        </Button>
      ) : null}
    </div>
  );
}

export function CategoryEditor({
  category,
}: {
  category?: { id: string; name: string; sector: string; blurb: string; active: boolean };
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await saveCategoryAction({
      ...(category ? { id: category.id } : {}),
      name: String(form.get('name') ?? ''),
      sector: String(form.get('sector') ?? 'BEAUTY'),
      blurb: String(form.get('blurb') ?? ''),
      active: form.get('active') === 'on',
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(category ? 'Kategori güncellendi' : 'Kategori eklendi');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {category ? (
        <Button size="iconSm" variant="ghost" onClick={() => setOpen(true)} aria-label="Kategoriyi düzenle">
          <Pencil size={15} aria-hidden />
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          Kategori ekle
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={category ? 'Kategoriyi düzenle' : 'Yeni kategori'}
          description="Kategoriler ana sayfadaki keşif bölümünde listelenir."
          size="sm"
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
            <Field label="Ad" htmlFor="c-name" required>
              <Input id="c-name" name="name" defaultValue={category?.name ?? ''} required />
            </Field>
            <Field label="Sektör" htmlFor="c-sector" hint="Sektör, oluşturulduktan sonra değiştirilemez.">
              <Select id="c-sector" name="sector" defaultValue={category?.sector ?? 'BEAUTY'} disabled={Boolean(category)}>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Kısa açıklama" htmlFor="c-blurb">
              <Input id="c-blurb" name="blurb" defaultValue={category?.blurb ?? ''} maxLength={160} />
            </Field>
            <label className={cn('flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5')}>
              <input
                type="checkbox"
                name="active"
                defaultChecked={category?.active ?? true}
                className="h-[18px] w-[18px] rounded border-line-strong text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[14px] text-navy">Kategori aktif</span>
            </label>
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={pending}>
                {category ? 'Kaydet' : 'Ekle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
