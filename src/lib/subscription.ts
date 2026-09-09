/**
 * Abonelik döngüsünün saf çekirdeği.
 *
 * Veritabanı bilmez: dönem matematiği ve durum kararları burada, tek yerde.
 * Zamanlanmış iş, yönetim ekranı ve panel aynı hesabı kullanmak zorunda —
 * "faturası var mı" sorusu iki yerde farklı cevaplanırsa işletme panelde
 * "ödendi" görürken yönetimde borçlu görünürdü.
 */

export const INVOICE_STATUSES = ['DUE', 'PAID', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  DUE: 'Ödenmedi',
  PAID: 'Ödendi',
  VOID: 'İptal edildi',
};

/**
 * Fatura kesildikten sonra ödeme için tanınan süre.
 *
 * Tahsilat havale/EFT ile yapılıyor ve muhasebesi olan bir işletmede ödeme
 * aynı gün çıkmıyor. Vade, panelde gösterilen tarih; hizmet bu süreye bağlı
 * DEĞİL — gecikme panelde uyarı üretir, kapatma yapmaz (bkz. plans.ts
 * `planActive`).
 */
export const ODEME_VADESI_GUN = 7;

/**
 * Bir sonraki dönemin bitişi.
 *
 * Takvim ayı ekleniyor, 30 gün değil: işletme "her ayın 15'i" bekliyor,
 * "her 30 günde bir" değil. Ayın 31'inde başlayan abonelik şubatta ayın
 * son gününe düşer (JavaScript'in taşırma davranışı düzeltiliyor); aksi
 * halde 31 Ocak → 3 Mart olurdu ve işletme bir ayı bedava kullanırdı.
 */
export function ayEkle(tarih: Date, ay = 1): Date {
  const gun = tarih.getUTCDate();
  const sonuc = new Date(tarih.getTime());
  sonuc.setUTCDate(1);
  sonuc.setUTCMonth(sonuc.getUTCMonth() + ay);
  const ayinSonGunu = new Date(
    Date.UTC(sonuc.getUTCFullYear(), sonuc.getUTCMonth() + 1, 0),
  ).getUTCDate();
  sonuc.setUTCDate(Math.min(gun, ayinSonGunu));
  return sonuc;
}

export function gunEkle(tarih: Date, gun: number): Date {
  return new Date(tarih.getTime() + gun * 24 * 60 * 60 * 1000);
}

export type Donem = { periodStart: Date; periodEnd: Date; dueAt: Date };

/** Verilen başlangıçtan bir aylık dönem üretir. */
export function donemUret(baslangic: Date): Donem {
  return {
    periodStart: baslangic,
    periodEnd: ayEkle(baslangic, 1),
    dueAt: gunEkle(baslangic, ODEME_VADESI_GUN),
  };
}

export type AbonelikDurumu = {
  planStatus: string;
  planPrice: number;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
};

/**
 * Şu an kesilmesi gereken dönem var mı?
 *
 * Kural tek cümle: **ödenmiş dönem bittiyse yeni dönem kesilir.**
 *
 * - Deneme sürüyorsa (`trialEndsAt` gelecekte) fatura yok.
 * - Deneme bittiyse ilk dönem denemenin bittiği andan başlar. Denemenin
 *   son gününü ücretsiz saymak için `trialEndsAt` dönemin BAŞLANGICI.
 * - Ödeme yapıldıysa `currentPeriodEnd` doluyor; bir sonraki dönem oradan
 *   başlıyor, "bugünden" değil. Aksi halde geç ödeyen işletme her seferinde
 *   birkaç gün bedava kullanırdı ve dönemler kayardı.
 * - Paket seçilmemişse (planPrice 0) fatura kesilmiyor: işletmenin seçmediği
 *   bir tutarı borç yazmak, tersinden düzeltmesi pahalı bir hata.
 * - İptal edilmişse fatura kesilmiyor.
 */
export function kesilecekDonem(b: AbonelikDurumu, simdi: Date): Donem | null {
  if (b.planStatus === 'CANCELLED') return null;
  if (b.planPrice <= 0) return null;

  const baslangic = b.currentPeriodEnd ?? b.trialEndsAt;
  if (!baslangic) return null;
  if (baslangic.getTime() > simdi.getTime()) return null;

  return donemUret(baslangic);
}

/**
 * Denemenin bitişi için uyarı zamanı geldi mi?
 *
 * Ankette katılımcıların yarısı kendini "teknoloji seviyesi düşük" diye
 * tanımladı; deneme bitiminin sürpriz olmaması gerekiyor. Uyarı bir kez
 * gidiyor (`trialWarnedAt` damgası), yoksa günlük iş her gün aynı mesajı
 * gönderirdi.
 */
export const DENEME_UYARI_GUN = 7;

export function denemeUyarisiGerekli(
  b: { planStatus: string; trialEndsAt: Date | null; trialWarnedAt: Date | null },
  simdi: Date,
): boolean {
  if (b.planStatus !== 'TRIAL') return false;
  if (!b.trialEndsAt || b.trialWarnedAt) return false;
  const kalanMs = b.trialEndsAt.getTime() - simdi.getTime();
  if (kalanMs <= 0) return false;
  return kalanMs <= DENEME_UYARI_GUN * 24 * 60 * 60 * 1000;
}

/**
 * Deneme bitiş uyarısının gövdesi.
 *
 * Metin burada, bildirim gönderen yerde değil: aynı cümle hem panelde hem
 * e-postada geçiyor ve iki yerde ayrı yazılırsa biri güncellenip diğeri
 * unutuluyor.
 */
export function trialUyariMetni(
  trialEndsAt: Date,
  planPrice: number,
  simdi: Date = new Date(),
): string {
  const kalan = Math.max(0, Math.ceil((trialEndsAt.getTime() - simdi.getTime()) / 86_400_000));
  const tarih = trialEndsAt.toLocaleDateString('tr-TR');
  if (planPrice <= 0) {
    // Paket seçilmemişse tutar yazamayız; yazsak seçmediği bir ücreti
    // taahhüt etmiş gibi olurdu.
    return `Denemeniz ${kalan} gün sonra (${tarih}) bitiyor. Kesintisiz devam için paket seçin.`;
  }
  return `Denemeniz ${kalan} gün sonra (${tarih}) bitiyor. Ardından aylık ${planPrice} TL faturalanır.`;
}
