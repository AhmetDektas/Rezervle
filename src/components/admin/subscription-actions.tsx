'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { markSubscriptionPaidAction, voidSubscriptionInvoiceAction } from '@/app/actions/admin';
import { money } from '@/lib/format';

/**
 * Fatura satırının eylemleri.
 *
 * "Ödendi" tek tıkla değil, dekont sorularak işaretleniyor. Tahsilat havale
 * ile yapıldığı için ödemenin tek kanıtı o not: sonradan "bu fatura neden
 * kapandı" sorusunun cevabı başka hiçbir yerde yok.
 */
export function InvoiceActions({
  invoiceId,
  amount,
  businessName,
}: {
  invoiceId: string;
  amount: number;
  businessName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [odemeAcik, setOdemeAcik] = React.useState(false);
  const [iptalAcik, setIptalAcik] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [dekont, setDekont] = React.useState('');
  const [gerekce, setGerekce] = React.useState('');
  const [hata, setHata] = React.useState<string | null>(null);

  async function odendi(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setHata(null);
    const sonuc = await markSubscriptionPaidAction(invoiceId, dekont);
    setPending(false);
    if (!sonuc.ok) {
      setHata(sonuc.error);
      return;
    }
    setOdemeAcik(false);
    setDekont('');
    toast.success('Ödeme kaydedildi');
    router.refresh();
  }

  async function iptal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setHata(null);
    const sonuc = await voidSubscriptionInvoiceAction(invoiceId, gerekce);
    setPending(false);
    if (!sonuc.ok) {
      setHata(sonuc.error);
      return;
    }
    setIptalAcik(false);
    setGerekce('');
    toast.success('Fatura iptal edildi');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" onClick={() => setOdemeAcik(true)}>
        <Check size={15} aria-hidden />
        Ödendi
      </Button>
      <Button size="sm" variant="dangerGhost" onClick={() => setIptalAcik(true)}>
        <Ban size={15} aria-hidden />
        İptal
      </Button>

      <Dialog open={odemeAcik} onOpenChange={setOdemeAcik}>
        <DialogContent
          title="Ödemeyi kaydet"
          description={`${businessName} · ${money(amount)}`}
          size="sm"
        >
          <form method="post" onSubmit={odendi} className="space-y-4" noValidate>
            <Field
              label="Dekont / açıklama"
              htmlFor="dekont"
              hint="Havale referansı ya da kısa not. Bu faturanın neden kapandığını sonradan açıklayan tek kayıt."
            >
              <Input
                id="dekont"
                value={dekont}
                onChange={(e) => setDekont(e.target.value)}
                placeholder="Örn. 12.03 havale, ref 8842"
              />
            </Field>
            {hata ? (
              <p role="alert" className="text-[13px] text-danger">
                {hata}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setOdemeAcik(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={pending}>
                Ödendi olarak işaretle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={iptalAcik} onOpenChange={setIptalAcik}>
        <DialogContent
          title="Faturayı iptal et"
          description="Fatura borç sayılmaz ve işletmenin durumu yeniden hesaplanır. Ödenmiş fatura bu yolla iptal edilemez."
          size="sm"
        >
          <form method="post" onSubmit={iptal} className="space-y-4" noValidate>
            <Field label="Gerekçe" htmlFor="gerekce" required>
              <Input
                id="gerekce"
                value={gerekce}
                onChange={(e) => setGerekce(e.target.value)}
                placeholder="Örn. yanlış pakette kesildi"
                required
              />
            </Field>
            {hata ? (
              <p role="alert" className="text-[13px] text-danger">
                {hata}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setIptalAcik(false)}>
                Vazgeç
              </Button>
              <Button type="submit" variant="danger" loading={pending}>
                Faturayı iptal et
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
