---
status: ACTIVE
---
# CEO Planı: Marketplace halkasını kapatmak
/plan-ceo-review · 2026-09-04
Branch: main | Mod: SELECTIVE EXPANSION | Repo: AhmetDektas/Rezervle

## Sistem denetimi bulguları

Üç yapısal boşluk, hepsi kodla doğrulandı:

1. **Arz tarafının kapısı yok.** `src/app/actions/auth.ts:56` her kayıtta
   `role: 'CUSTOMER'` sabitliyor. `Business` yaratan tek kod yolu
   `prisma/seed.ts:197`. 32 sayfa içinde işletme kaydı rotası yok.
   Onay durum makinesi (`PENDING|APPROVED|REJECTED|SUSPENDED` + `statusHistory`)
   ve admin kuyruğu var; eksik olan sadece başvurunun kendisi.
2. **Para akmıyor, kimse haberdar olmuyor.** `providers.ts` konsol e-posta,
   konsol SMS ve sahte ödeme döndürüyor. Komisyon mimarisi doğru ve test
   edilmiş ama çalıştırılamaz durumda.
3. **Sıfır analitik.** Yayına alınsa kimsenin rezervasyon yapıp yapmadığı
   görülemez.

İyi haber: adaptör dikişi temiz. `paymentProvider()` yalnızca
`reservations.ts:315` ve `:529`'dan çağrılıyor. 3 ve 4 numaralı parçalar
refactor değil, adaptör yazma işi.

## Pazar bağlamı

Güzellik dikeyi kalabalık: AtlasPlan (10.000+ salon), SalonRandevu,
OnlineGüzellik. Hepsi salona yazılım satan SaaS, tüketici pazaryeri değil.

Halı saha dikeyinde Şikayetvar kayıtları Rezzerv'in çözdüğü problemin
aynısını tarif ediyor: kapora alınıp sahanın başkasına verilmesi, bir saat
için gönderilen kaporaya başka saat için onay gelmesi, 14 güne kadar süren
iadeler. `slotKey` tekil kısıtı, üç katmanlı çakışma engeli ve lisanslı
ödeme kuruluşunda tutulan kapora bu şikayetlerin doğrudan cevabı.

## Yön kararı

**A — halkayı kapat, beş sektör kalsın.** (Öneri B/tek dikey wedge idi;
kullanıcı beş sektörü korumayı seçti.)

Temel kapsam beş parça:

| # | Parça | Neden |
|---|---|---|
| 1 | İşletme kaydı (`OWNER` + `Business(PENDING)`) | Arz kapısı yok |
| 2 | Başvuru → admin onay akışı | Kuyruk var, başvuru yok |
| 3 | Gerçek ödeme adaptörü | Komisyon çalışmıyor |
| 4 | Gerçek e-posta/SMS adaptörü | Bildirimler konsola yazıyor |
| 5 | Temel analitik | Ölçüm yok |

**Sekans notu:** 1+2 tek başına anlamlı bir sürüm. `İşletmede öde` zaten
çalıştığı için ödeme sağlayıcısı olmadan da açılabilir: işletmeler katılır,
rezervasyon akar, kasada ödenir, Rezzerv henüz komisyon almaz ama gerçek
kullanım verisi toplanır. Kapora ve komisyon 3+4 ile gelir.

## Kapsam kararları

| # | Öneri | Efor | Karar | Gerekçe |
|---|---|---|---|---|
| E1 | KVKK aydınlatma + açık rıza akışı | M (~3-4 gün) | **ACCEPTED** | Gerçek kişisel veri işlenecek; diş/veteriner randevu geçmişi hassas. Sonradan eklemek geriye dönük rıza toplamak demek. |
| E2 | İşletme doğrulaması (vergi no / IBAN) | M (~4-5 gün) | DEFERRED | İlk 10-20 işletmede admin manuel kontrolü yeterli ve daha güvenilir. Dosya depolama kararı da ertelendi. |
| E3 | 24 saat önce hatırlatma otomasyonu | S-M (~2-3 gün) | **ACCEPTED** | SMS kanalı 4. parçada zaten açılıyor; işletmeye anlatılacak somut fayda bu. |
| E4 | İşletme aktivasyon sihirbazı | M (~1 hafta) | DEFERRED | Gerçek sürtünmeyi görmeden sihirbaz tasarlamak yanlış adımları otomatikleştirir. Önce elle kur, sonra otomatikleştir. |
| E5 | Komisyon modeli | S (anlatım) | **ACCEPTED (A)** | Ekonomi değişmiyor. Aşağıya bakınız. |
| E6 | Kapora iade uyuşmazlığı akışı | M (~1 hafta) | DEFERRED | İlk uyuşmazlıklar admin tarafından elle çözülür, akış o vakalardan tasarlanır. İlk kapora tahsilatından önce açılmalı. |

## E5 — komisyon kararının gerekçesi

Tartışma sırasında üç şey doğrulandı:

- **Freemium zaten kurulu.** `reservations.ts:314` komisyonu yalnızca
  `depositAmount` üzerinden hesaplıyor. Kapora yoksa `Payment` yok, komisyon
  yok. Kapora iki anahtara bağlı: `depositActive = addon && enabled`.
  Listelenme, rezervasyon ve işletmede ödeme bedava.
- **Oran işletme bazında.** `Business.commissionRate` (`schema.prisma:121`).
- **%30 aslında ~%6.** Gülveren: ₺1.400 rezervasyon, ₺300 kapora, ₺90
  komisyon = %6,4 GMV. Estetika: ₺8.500 / ₺1.700 / ₺510 = %6,0 GMV.

Karar: **oran %30 kalır, değişen tek şey anlatım.** Panelde ve satış dilinde
rezervasyon değerine oran (~%6) ve "₺300 kaporanın ₺210'u size geçer"
çerçevesi öne çıkar. Sıfır kod riski, geri dönülemez karar yok; oran veri
geldikten sonra işletme bazında ayarlanır. Yükseltmek indirmekten çok daha
zor olduğu için yüksekten başlayıp indirim vermek doğru yön.

Reddedilen alternatif: "sadece gelmeyende kes" (no-show sigortası). Kulağa
adil geliyor ama platformu ürünün başarısızlığından kazanan konuma sokuyor
ve E3 hatırlatma yatırımıyla doğrudan çelişiyor.

## Kapsamda OLMAYANLAR

- İşletme doğrulama otomasyonu (E2) — admin manuel onaylar
- Aktivasyon sihirbazı (E4) — ilk işletmeler elle kurulur
- İade uyuşmazlığı hakemliği (E6) — ilk vakalar elle çözülür
- Tek dikeye daralma (halı saha wedge) — beş sektör korunuyor

---

# 11 Bölümlük Derin İnceleme — Kararlar

25 karar noktası, tamamı kullanıcı onayıyla. Kod referanslarıyla doğrulandı.

| # | Konu | Karar |
|---|---|---|
| S1-1 | SQLite → Postgres | İlk işletme kaydından ÖNCE göç |
| S1-2 | Zamanlanmış iş altyapısı | **BullMQ + Redis** (öneri A idi, kullanıcı B seçti) |
| S1-3 | PaymentProvider arayüzü | Şimdi asenkron 3DS + webhook'a göre yeniden tasarla |
| S2-1 | GAP-1 bildirim hatası | Yan etkiye izole et + hatayı kuyruğa düşür |
| S2-2 | GAP-3 3DS terki | `paymentDeadline` + süresi geçeni serbest bırakan iş |
| S2-3 | GAP-4/6 idempotens | Her iki yüzeye de işlenmiş-olay kaydı |
| S2-4 | GAP-2 loglama | `run()` bağlam alsın, yapılandırılmış logla |
| S3-1 | Hız sınırı | Redis tabanlı: giriş, kayıt, işletme başvurusu |
| S3-2 | Log/PII | Sözleşme: kimlik evet, içerik hayır |
| S3-3 | Catch-all | Yetki hatasını ayır, kalanı yükselt |
| S4-1 | Slug tekilliği | Semt eki, çakışırsa sayı |
| S5-1 | REZZERV100 sabiti | Bildirimi Promotion tablosundan üret |
| S5-2 | İki kayıt yolu | Ortak `createAccount()` yardımcısı |
| S6-1 | Sahte PSP | Tam akışı taklit etsin (3DS, terk, webhook, imza) |
| S6-2 | Zaman bağımlılığı | Saat dişini her yerde kullan |
| S7-1 | Bağlantı havuzu | Göçle birlikte havuzlayıcı kur |
| S8-1 | Kuyruk görünürlüğü | Ölü mektup + eşik alarmı + yönetim sayacı |
| S8-2 | Analitik | İki taraflı huni: arz + talep |
| S9-1 | Worker topolojisi | Aynı barındırmada ikinci süreç |
| S9-2 | Ödeme bayrağı | Platform çapında kapora ana şalteri |
| S10-1 | Dokümantasyon | TODOS.md + docs/mimari.md kapsama alındı |
| S11-1 | 3DS dönüş ekranı | Açık bekleme durumu + otomatik güncelleme |
| S11-2 | Kayıt formu | Kayıtta minimum + onay sonrası rehberli tamamlama |

## Geri döndürülebilirlik

| Karar | Puan (1=tek yönlü) |
|---|---|
| İşletme kaydını açmak | **1/5** |
| KVKK rıza kaydı | 2/5 |
| Postgres göçü | 2/5 |
| Redis + worker | 3/5 |
| Ödeme arayüzü | 4/5 |

Planın tek gerçek tek-yönlü kapısı **işletme kaydını açmak**. Sıralama buna göre:
teknik parçalar önce, kapı en son.

## Dream state deltası

12 aylık ideal: Ankara'da beş sektörde, işletmenin kendi kendine katıldığı,
kaporası lisanslı kuruluşta tutulan, hatırlatmasıyla gelmeme oranını düşüren
bir pazaryeri.

Bu plan oraya götürüyor ama **bir adım eksik bırakıyor**: E2 (doğrulama),
E4 (aktivasyon sihirbazı) ve E6 (uyuşmazlık) ertelendi. Üçü de "ölçek
büyüyünce" kalemleri; ilk 10-20 işletmede elle yönetilebilir. TODOS.md'de
ne zaman açılacakları yazılı.

## Zaten var olanlar (yeniden kullanılıyor)

- `Business.status` durum makinesi + `statusHistory` + admin onay kuyruğu
- `providers.ts` adaptör dişi (`paymentProvider`, `emailProvider`, `smsProvider`)
- `Business.commissionRate` işletme bazında oran
- `depositActive = addon && enabled` iki anahtarlı freemium
- `src/lib/time.ts` enjekte edilebilir saat
- `run()` / `DomainError` / `ActionResult` hata sözleşmesi
- Form butonlarında `loading` deseni (çift gönderim koruması)

## Uygulama görevleri

22 görev, `~/.gstack/projects/Rezervle/tasks-ceo-review-*.jsonl` dosyasında.
P1: 14 · P2: 8 · P3: 0
