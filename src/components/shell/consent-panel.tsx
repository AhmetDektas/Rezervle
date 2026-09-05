'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm';
import { setConsentAction } from '@/app/actions/customer';

/**
 * Açık rıza kartı.
 *
 * KVKK m.7 rızanın geri alınabilmesini zorunlu kılıyor ve aydınlatma metni bunu
 * "profil sayfanızdan" diye söz veriyor. Geri alma kaydı kapatmakla kalmıyor:
 * diş, veteriner ve estetik randevusu rıza yokken sunucuda reddediliyor —
 * yoksa buton bir şey değiştirmeyen bir kutu olurdu.
 */
export function ConsentPanel({
  granted,
  grantedAt,
  version,
}: {
  granted: boolean;
  grantedAt: string | null;
  version: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = React.useState(false);
  const [revokeOpen, setRevokeOpen] = React.useState(false);

  async function apply(next: boolean) {
    setPending(true);
    const result = await setConsentAction(next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRevokeOpen(false);
    toast.success(next ? 'Açık rıza verildi' : 'Açık rıza geri alındı');
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span
          className={
            granted
              ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success'
              : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn'
          }
        >
          {granted ? <ShieldCheck size={18} aria-hidden /> : <ShieldOff size={18} aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-navy">
            {granted ? 'Açık rıza verildi' : 'Açık rıza geri alındı'}
          </p>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-2">
            {granted
              ? 'Diş kliniği, veteriner ve estetik randevularınız bu rızaya dayanarak işleniyor. Diğer kategoriler rıza gerektirmez.'
              : 'Diş kliniği, veteriner ve estetik kategorilerinde uygulama üzerinden randevu oluşturamazsınız; işletmeyi arayarak alabilirsiniz. Diğer kategoriler etkilenmez.'}
          </p>
          {grantedAt ? (
            <p className="mt-1 text-[12.5px] text-ink-3">
              {granted ? 'Verildiği tarih' : 'Son kayıt'}: {grantedAt}
              {version ? ` · sürüm ${version}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={granted ? 'secondary' : 'primary'}
          size="sm"
          loading={pending}
          onClick={() => (granted ? setRevokeOpen(true) : apply(true))}
        >
          {granted ? 'Açık rızamı geri al' : 'Açık rıza ver'}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/kvkk">Aydınlatma metni</Link>
        </Button>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Açık rızanız geri alınsın mı?"
        description="Diş kliniği, veteriner ve estetik kategorilerinde uygulama üzerinden yeni randevu oluşturamazsınız; işletmeyi arayarak alabilirsiniz. Mevcut randevularınız etkilenmez ve rızayı dilediğiniz zaman yeniden verebilirsiniz."
        confirmLabel="Geri al"
        loading={pending}
        onConfirm={() => apply(false)}
      />
    </div>
  );
}
