# Dağıtım ve canlıya çıkış

Bu belge canlıya çıkmadan önce yapılması **zorunlu** olanları ve bugün
itibarıyla **eksik** olanları ayırır. Sıralama önem sırasına göre.

---

## 1. Canlıya çıkışı ENGELLEYEN eksikler

Bunlar kodla kapatılamaz; dışarıdan bir şey gerektirir.

### 1.1 Gerçek ödeme sağlayıcısı yok

`paymentProvider()` bugün **yalnızca sahte sağlayıcıyı** döndürüyor. Sahte
sağlayıcı gerçek para hareketi yapmaz: kart bilgisi almaz, tahsilat etmez,
bloke koymaz.

**Bu haliyle kapora tahsil edilemez.** Kapora açıkken canlıya çıkılırsa
müşteri "ödendi" ekranı görür ama hiçbir para hareket etmez.

Gereken:

1. Lisanslı bir ödeme kuruluşuyla (İyzico / PayTR / Param) **pazaryeri /
   alt üye işyeri** sözleşmesi. Normal üye işyeri sözleşmesi YETMEZ — parayı
   biz tutarsak 6493 sayılı Kanun kapsamına gireriz.
2. Her işletme için alt üye işyeri kaydı (`subMerchantKey`).
3. `src/server/providers.ts` içinde gerçek adaptörün yazılması. Arayüz hazır:
   `charge` / `release` / `refund` / `verifyWebhook`.
4. Sağlayıcı panelinde webhook adresinin tanımlanması:
   `https://<alan-adiniz>/api/odeme/webhook`

**Ödeme hazır değilken çıkmak isterseniz** tek güvenli yol kapora ana
şalterini kapatmak:

```
DEPOSITS_ENABLED="false"
```

Bu durumda rezervasyon normal akar, ödeme işletmede yapılır, komisyon
alınmaz. Ürün çalışır; gelir modeli beklemede kalır. **Bu, yarın çıkmak için
tavsiye edilen yoldur.**

### 1.2 Hukuki metinler taslak

`/sozlesme` ve `/kvkk` sayfaları "hukuki bir metin yerine geçmez" notunu
taşıyor. Gerçek kullanıcı verisi işlenmeden önce bir avukatla
gözden geçirilmeli. VERBİS kaydı da ayrıca değerlendirilmeli.

### 1.3 İşletme doğrulaması elle

`taxNumber` ve `payoutIban` doğrulanmıyor (TODOS T-E2). İlk 10-20 işletmede
admin manuel kontrolü planlandı — bu bilinçli bir karar, ama **kimin
kontrol edeceği** belirlenmiş olmalı.

---

## 2. Çıkmadan önce YAPILMASI gerekenler

### 2.1 Ortam değişkenleri

```bash
DATABASE_URL="postgresql://..."            # yönetilen Postgres
REDIS_URL="redis://..."                    # yönetilen Redis
AUTH_SECRET="<openssl rand -base64 48>"    # MUTLAKA değiştirin
NEXT_PUBLIC_APP_URL="https://<alan-adiniz>"
NODE_ENV="production"
DEPOSITS_ENABLED="false"                   # ödeme hazır değilse
SUBSCRIPTION_IBAN="TR.."                   # abonelik havalesi için
SUBSCRIPTION_TITLE="<ünvan>"
```

`AUTH_SECRET` varsayılan bırakılırsa oturum çerezleri tahmin edilebilir olur.
Uygulama üretimde varsayılan anahtarla **açılmayı reddeder**.

`REDIS_URL` tanımsızsa hız sınırı **sessizce devre dışı kalır**. Üretimde
mutlaka tanımlı olmalı.

`SUBSCRIPTION_IBAN` / `SUBSCRIPTION_TITLE` işletmenin panelinde gösterilir.
Tanımsız bırakılırsa panel "ödeme bilgileri henüz tanımlanmadı" yazar —
uydurma bir hesap göstermek, yanlış hesaba yapılan havale demek olurdu.

### 2.2 İki süreç birden çalışmalı

```bash
npm run build
npm run start     # web
npm run worker    # worker — AYRI süreç
```

Worker çalışmazsa: hatırlatmalar gitmez ve terk edilen 3DS ödemeleri saatleri
kalıcı olarak kilitler. Barındırma platformunda ikinci bir "process" tanımı
gerekiyor.

### 2.3 Veritabanı

```bash
npx prisma migrate deploy
```

**Tohum verisini üretimde ÇALIŞTIRMAYIN.** `prisma/seed.ts` kurgusal
işletmeler, demo hesaplar ve binlerce sahte randevu yazar.

### 2.4 Yönetici hesabı

Tohum çalıştırılmayacağı için ilk yönetici elle oluşturulmalı: bir hesap
açıp veritabanından `role` alanını `ADMIN` yapmak yeterli.

### 2.5 Kontrol listesi

- [ ] `AUTH_SECRET` değiştirildi
- [ ] `NODE_ENV=production`
- [ ] `DEPOSITS_ENABLED` bilinçli olarak ayarlandı
- [ ] `migrate deploy` çalıştı, tohum ÇALIŞMADI
- [ ] Worker süreci ayakta
- [ ] Redis bağlı (hız sınırı aktif — logda uyarı yok)
- [ ] İlk yönetici hesabı hazır
- [ ] En az bir gerçek işletme başvurusu uçtan uca denendi
- [ ] Alan adı + HTTPS

---

## 3. Çıkıştan sonra izlenecekler

| Nerede | Ne |
|---|---|
| `/yonetim` | Onay bekleyen başvurular, ölü mektup alarmı |
| `/yonetim/kuyruk` | Arka plan işleri sağlığı |
| `/yonetim/analitik` | Arz hunisi — onay ile kurulum arasındaki düşüş |
| Sunucu logu | `level:"error"` satırları |

**İlk hafta en kritik sayı:** onaylanan işletmelerden kaçının kurulumu
tamamladığı. Kaydolup hiç çalışmayan işletme, iki taraflı pazaryerinde en
pahalı kayıptır.

---

## 4. Bilinçli olarak kapsam dışı

Bunlar eksiklik değil, ertelenmiş kararlar. Gerekçeleri `TODOS.md`'de:

- Tam kapora uyuşmazlık hakemliği (asgari itiraz kanalı var)
- İşletme aktivasyon sihirbazı (kontrol listesi var)
- Ziyaret/çerez analitiği (rıza yüzeyi genişlemesin diye)
- Belge yükleme ile işletme doğrulama
