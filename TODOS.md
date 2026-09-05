# TODOS

Ertelenen işler. Her kalem `/plan-ceo-review` (2026-09-04) sırasında bilinçli
olarak ertelendi; gerekçesi ve ne zaman açılması gerektiği yazılı.

CEO planı: `~/.gstack/projects/Rezervle/ceo-plans/2026-09-04-marketplace-halkasi.md`

---

## P1 — İlk kapora tahsilatından önce açılmalı

### T-E6 · Kapora iade uyuşmazlığı akışı

**Ne:** Müşterinin "zamanında iptal ettim" itirazını, işletmenin cevabını ve
admin hakemliğini taşıyan akış.

**Neden:** Bugün `depositStatus` işletmenin ya da sistemin kararıyla değişiyor;
müşterinin itiraz edebileceği bir yer yok. Şikayetvar'daki halı saha
şikayetlerinin büyük kısmı tam olarak bu: kapora yandı, muhatap bulunamıyor.

**Şu anki durum:** İade kuralları kodda doğru uygulanıyor (24 saat penceresi,
otomatik iade). Eksik olan itiraz mekanizması, kural değil.

**Nereden başlanır:** Admin panelinde randevu ve ödeme geçmişi zaten görünüyor;
ilk vakaları elle çözüp akışı o vakalardan tasarlayın.

**Efor:** M (human ~1 hafta / CC ~1-2 oturum) · **Öncelik:** P1
**Bağımlı:** Gerçek ödeme (3. parça) canlıya çıkmadan önce.

---

## P2 — Ölçek büyüyünce

### T-E2 · İşletme doğrulaması (vergi no / IBAN sahipliği)

**Ne:** Vergi levhası/kimlik belgesi yükleme, IBAN ünvan eşleşmesi, admin onay
ekranında belge görünümü.

**Neden:** `taxNumber` ve `payoutIban` bugün doğrulanmayan opsiyonel metin
alanları. İşletme kaydı açıldıktan sonra sahte bir işletme kaydedip kapora
toplamak teorik olarak mümkün.

**Şu anki durum:** İlk 10-20 işletmede admin manuel kontrolü yeterli ve daha
güvenilir kabul edildi. Dosya depolama altyapısı henüz yok.

**Nereden başlanır:** Lisanslı ödeme kuruluşu alt üye işyeri için zaten bu
belgeleri isteyecek — o listeyle hizalayın, iş iki kez yapılmasın.

**Efor:** M (human ~4-5 gün / CC ~1 oturum) · **Öncelik:** P2
**Bağımlı:** Dosya depolama kararı; PSP seçimi.

### T-E4 · İşletme aktivasyon sihirbazı

**Ne:** Onay sonrası adım adım kurulum: hizmetler, çalışma saatleri,
personel/saha, ilk rezervasyon testi.

**Neden:** Onaylanan işletme panele girdiğinde boş ekranla karşılaşıyor —
onaylanmış ama rezervasyon alamayan bir işletme. "Kayıttan ilk rezerve
edilebilir saate geçen süre" bu ürünün asıl aktivasyon metriği.

**Şu anki durum:** S11-2 kararıyla hafif hali kapsama girdi (onay sonrası
"şunlar eksik" kontrol listesi). Tam sihirbaz ertelendi.

**Nereden başlanır:** İlk işletmeleri elle kurarken nerede takıldıklarını not
edin; sihirbazı o notlardan tasarlayın, tahminden değil.

**Efor:** M (human ~1 hafta / CC ~1-2 oturum) · **Öncelik:** P2
**Bağımlı:** S8-2 arz hunisi ölçümünden gelen veri.

---

## P3 — Ürün kararı bekliyor

### T-01 · Komisyon oranını veriyle gözden geçir

**Ne:** `Business.commissionRate` varsayılanı (%30) ilk 5 işletme
görüşmesinden sonra tekrar değerlendirilecek.

**Neden:** Oran ekonomik olarak doğru (rezervasyon değerinin ~%6'sı) ama
"%30" ifadesi ilk konuşmada zor. S5 kararıyla ekonomi korundu, anlatım
düzeltildi. Gerçek tepki henüz bilinmiyor.

**Şu anki durum:** Oran işletme bazında ayarlanabiliyor; indirim vermek
mümkün, yükseltmek pratikte imkansız.

**Efor:** S · **Öncelik:** P3

### T-02 · Tek dikeye daralma (halı saha) seçeneği

**Ne:** Vitrini halı sahaya daraltıp o dikeyde derinleşme.

**Neden:** Pazar araması, halı saha şikayetlerinin (kapora alınıp saha
başkasına verilmesi) tam olarak Rezzerv'in çözdüğü problem olduğunu ve
güzellik SaaS oyuncularının (AtlasPlan 10.000+ salon) o dikeyde olmadığını
gösterdi.

**Şu anki durum:** Beş sektör korunması bilinçli olarak seçildi. Bu kalem,
arz tarafı verisi geldikten sonra tekrar bakılacak bir alternatif olarak
duruyor.

**Efor:** M · **Öncelik:** P3
