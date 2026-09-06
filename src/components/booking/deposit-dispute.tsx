'use client';

import * as React from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { raiseDepositDisputeAction } from '@/app/actions/customer';

/**
 * Asgari kapora itiraz kanalı (E2).
 *
 * Bugün `depositStatus` işletmenin ya da sistemin kararıyla değişiyor ve
 * müşterinin itiraz edebileceği hiçbir yer yok. Şikayetvar'daki halı saha
 * şikayetlerinin büyük kısmı tam olarak bu: kapora yandı, muhatap bulunamıyor.
 *
 * Tam hakemlik akışı (TODOS T-E6) bilinçli olarak ertelendi — ilk vakalar elle
 * çözülüp akış o vakalardan tasarlanacak. Ama "muhatap yok" durumu ilk kapora
 * tahsilatından önce kapanmalıydı; bu bağlantı o kapı.
 */
export function DepositDispute({ reservationId }: { reservationId: string }) {
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [mesaj, setMesaj] = React.useState('');
  const [hata, setHata] = React.useState<string | null>(null);

  async function gonder() {
    setPending(true);
    setHata(null);
    const r = await raiseDepositDisputeAction({ reservationId, message: mesaj });
    setPending(false);
    if (!r.ok) {
      setHata(r.error);
      return;
    }
    setOpen(false);
    setMesaj('');
    toast.success('İtirazınız iletildi', 'En kısa sürede size dönüş yapılacak.');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-600 underline-offset-4 hover:underline"
      >
        <MessageSquareWarning size={13} aria-hidden />
        Kapora hakkında itirazım var
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Kapora itirazı"
          description="Durumu kısaca anlatın; ekibimiz randevu ve ödeme kaydınızla birlikte inceleyip size dönecek."
          size="sm"
        >
          <Field label="Açıklama" htmlFor="itiraz" error={hata ?? undefined} required>
            <Textarea
              id="itiraz"
              value={mesaj}
              onChange={(e) => setMesaj(e.target.value)}
              placeholder="Örnek: Randevuyu 2 gün önce iptal ettim ama kaporam iade edilmedi."
              maxLength={1000}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Vazgeç
              </Button>
            </DialogClose>
            <Button type="button" loading={pending} onClick={gonder}>
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
