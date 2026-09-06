'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, EyeOff, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import {
  saveMenuItemAction,
  toggleMenuItemAction,
  deleteMenuItemAction,
} from '@/app/actions/panel';

export type MenuRow = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  sortOrder: number;
  active: boolean;
};

/**
 * Menü kalemi ekleme/düzenleme.
 *
 * Bölüm adı serbest metin ama mevcut bölümler `datalist` ile öneriliyor:
 * sabit liste her mutfağa uymaz, öneri olmadan da aynı bölüm "Tatlı" ve
 * "Tatlılar" diye ikiye bölünür ve menü müşteride dağınık görünür.
 */
export function MenuEditor({
  businessId,
  bolumler,
  item,
  trigger,
}: {
  businessId: string;
  bolumler: string[];
  item?: MenuRow;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setFields({});
    setError(null);
    const fd = new FormData(e.currentTarget);
    const r = await saveMenuItemAction({
      ...(item ? { id: item.id } : {}),
      businessId,
      category: fd.get('category'),
      name: fd.get('name'),
      description: fd.get('description'),
      price: fd.get('price'),
      sortOrder: fd.get('sortOrder'),
    });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      setFields(r.fields ?? {});
      return;
    }
    setOpen(false);
    toast.success(item ? 'Menü kalemi güncellendi' : 'Menü kalemi eklendi');
    router.refresh();
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button type="button" size="sm">
            <Plus size={15} aria-hidden />
            Kalem ekle
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={item ? 'Menü kalemini düzenle' : 'Menüye kalem ekle'} size="sm">
          <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
            {error ? <p className="text-[13px] text-danger">{error}</p> : null}

            <Field label="Bölüm" htmlFor="m-cat" error={fields['category']} required
              hint="Örn. Başlangıçlar, Ana yemekler, Tatlılar">
              <Input
                id="m-cat"
                name="category"
                list="menu-bolumleri"
                defaultValue={item?.category ?? ''}
                required
              />
              <datalist id="menu-bolumleri">
                {bolumler.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>

            <Field label="Ürün adı" htmlFor="m-name" error={fields['name']} required>
              <Input id="m-name" name="name" defaultValue={item?.name ?? ''} required />
            </Field>

            <Field label="Açıklama" htmlFor="m-desc" error={fields['description']}
              hint="İsteğe bağlı. İçindekiler, porsiyon bilgisi.">
              <Textarea id="m-desc" name="description" defaultValue={item?.description ?? ''} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fiyat (TL)" htmlFor="m-price" error={fields['price']} required>
                <Input
                  id="m-price"
                  name="price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={item?.price ?? ''}
                  required
                />
              </Field>
              <Field label="Sıra" htmlFor="m-sort" error={fields['sortOrder']}
                hint="Küçük olan üstte.">
                <Input
                  id="m-sort"
                  name="sortOrder"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={item?.sortOrder ?? 0}
                />
              </Field>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" type="button">
                  Vazgeç
                </Button>
              </DialogClose>
              <Button type="submit" loading={pending}>
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Yayından kaldırma ve silme. */
export function MenuRowActions({
  businessId,
  item,
  bolumler,
}: {
  businessId: string;
  item: MenuRow;
  bolumler: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [silOpen, setSilOpen] = React.useState(false);

  async function toggle() {
    setPending(true);
    const r = await toggleMenuItemAction(businessId, item.id, !item.active);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success(item.active ? 'Menüden kaldırıldı' : 'Menüye geri alındı');
    router.refresh();
  }

  async function sil() {
    setPending(true);
    const r = await deleteMenuItemAction(businessId, item.id);
    setPending(false);
    setSilOpen(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success('Menü kalemi silindi');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <MenuEditor
        businessId={businessId}
        bolumler={bolumler}
        item={item}
        trigger={
          <Button type="button" variant="ghost" size="iconSm" aria-label="Düzenle">
            <Pencil size={15} aria-hidden />
          </Button>
        }
      />
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        disabled={pending}
        onClick={toggle}
        aria-label={item.active ? 'Menüden kaldır' : 'Menüye geri al'}
      >
        {item.active ? <EyeOff size={15} aria-hidden /> : <Eye size={15} aria-hidden />}
      </Button>
      <Button
        type="button"
        variant="dangerGhost"
        size="iconSm"
        disabled={pending}
        onClick={() => setSilOpen(true)}
        aria-label="Sil"
      >
        <Trash2 size={15} aria-hidden />
      </Button>

      <ConfirmDialog
        open={silOpen}
        onOpenChange={setSilOpen}
        title="Menü kalemi silinsin mi?"
        description="Bu işlem geri alınamaz. Kalemi geçici olarak gizlemek isterseniz “Menüden kaldır” seçeneğini kullanın."
        confirmLabel="Sil"
        loading={pending}
        onConfirm={sil}
      />
    </div>
  );
}
