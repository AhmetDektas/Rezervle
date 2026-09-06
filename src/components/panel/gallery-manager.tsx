'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, Star, StarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import {
  addBusinessImageAction,
  deleteBusinessImageAction,
  setCoverImageAction,
} from '@/app/actions/panel';
import { cn } from '@/lib/utils';

export type GalleryImage = { id: string; url: string; caption: string };

export function GalleryManager({
  slug,
  businessId,
  images,
  coverUrl,
}: {
  slug: string;
  businessId: string;
  images: GalleryImage[];
  coverUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<string | null>(null);
  const [broken, setBroken] = React.useState<Set<string>>(new Set());

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await addBusinessImageAction(slug, businessId, url, caption);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUrl('');
    setCaption('');
    toast.success('Görsel eklendi');
    router.refresh();
  }

  async function remove(id: string) {
    setPending(true);
    const result = await deleteBusinessImageAction(slug, id);
    setPending(false);
    setToDelete(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Görsel kaldırıldı');
    router.refresh();
  }

  async function setCover(next: string | null) {
    setPending(true);
    const result = await setCoverImageAction(slug, businessId, next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(next ? 'Kapak görseli güncellendi' : 'Kapak, üretilen görsele döndü');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form method="post" onSubmit={add} className="space-y-3">
        <Field
          label="Görsel adresi"
          htmlFor="g-url"
          error={error ?? undefined}
          hint="https ile başlayan doğrudan görsel bağlantısı. Dosya yükleme ileri sürümde eklenecek."
        >
          <Input
            id="g-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/salon.jpg"
            inputMode="url"
          />
        </Field>
        <Field label="Açıklama (isteğe bağlı)" htmlFor="g-caption">
          <Input
            id="g-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={120}
            placeholder="Bekleme salonu"
          />
        </Field>
        <Button type="submit" size="sm" loading={pending} disabled={url.trim().length < 8}>
          <ImagePlus size={15} aria-hidden />
          Galeriye ekle
        </Button>
      </form>

      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[13.5px] text-ink-3">
          Galeri boş. Görsel eklemezseniz işletme sayfanız markanızın renginden üretilen
          kapakla görünür — hiçbir zaman boş bir kutu çıkmaz.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => {
            const isCover = coverUrl === img.url;
            const failed = broken.has(img.id);
            return (
              <li key={img.id} className="overflow-hidden rounded-xl border border-line bg-sunken">
                <div className="relative aspect-[4/3] bg-sunken">
                  {failed ? (
                    <span className="flex h-full items-center justify-center px-2 text-center text-[11.5px] text-ink-3">
                      Görsel yüklenemedi
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.url}
                      alt={img.caption || 'İşletme görseli'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setBroken((prev) => new Set(prev).add(img.id))}
                    />
                  )}
                  {isCover ? (
                    <span className="absolute left-2 top-2 rounded-full bg-navy/85 px-2 py-0.5 text-[11px] font-medium text-white">
                      Kapak
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-1 p-2">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                    {img.caption || 'Açıklama yok'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCover(isCover ? null : img.url)}
                    disabled={pending || failed}
                    aria-label={isCover ? 'Kapaktan kaldır' : 'Kapak yap'}
                    className={cn(
                      'rounded-lg p-1.5 transition disabled:opacity-40',
                      isCover ? 'text-warn hover:bg-warn-soft' : 'text-ink-3 hover:bg-surface hover:text-navy',
                    )}
                  >
                    {isCover ? <StarOff size={14} aria-hidden /> : <Star size={14} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(img.id)}
                    disabled={pending}
                    aria-label="Görseli kaldır"
                    className="rounded-lg p-1.5 text-ink-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(v) => (v ? undefined : setToDelete(null))}
        title="Görsel kaldırılsın mı?"
        description="Görsel galeriden çıkar. Kapak olarak seçiliyse kapak da sıfırlanır."
        confirmLabel="Kaldır"
        loading={pending}
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
      />
    </div>
  );
}
