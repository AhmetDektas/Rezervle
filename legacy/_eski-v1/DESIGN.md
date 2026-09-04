# Rezervle — Tasarım Sistemi

Bu belge koddan çıkarıldı, koddan önce gelmiyor. Tek doğruluk kaynağı
`assets/css/base.css` içindeki token'lar; burası o token'ların **ne anlama geldiğini**
ve **ne zaman kullanılacağını** yazar. Yeni bir renk, yarıçap ya da yazı tipi eklemeden
önce burayı okuyun.

---

## 1. Ürün iki yüzeydir, tek marka

| Yüzey | İşi | Tipografi | Yoğunluk |
|---|---|---|---|
| **Tanıtım sayfası** (`#/`) | İkna eder | Display + serif okuma metni | Geniş, editöryel |
| **İşletme paneli** (`#/panel/…`) | Çalışır | Inter | Yoğun, veri odaklı |
| **Müşteri uygulaması** (panel içi önizleme) | Rezervasyon aldırır | Inter | Mobil, kart tabanlı |

Renk paleti, yarıçap ölçeği ve bileşen sözlüğü **üçünde de aynıdır**. Ayrışan tek şey
okuma metninin yazı tipidir; gerekçesi §3'te.

---

## 2. Renk

Renk anlam taşır, süs değildir. Marka rengi tek, anlam renkleri dört tanedir.

### Zemin ve metin

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `--bg` | `#f5f6f9` | `#0c0f16` | Sayfa zemini |
| `--surface` | `#ffffff` | `#141924` | Kart, panel, modal |
| `--surface-2` | `#f9fafc` | `#191f2c` | İkincil yüzey, tablo başlığı |
| `--surface-3` | `#eef1f6` | `#212939` | Girinti, iskelet, pasif çip |
| `--line` | `#e3e7ee` | `#28303f` | Ayırıcı çizgi |
| `--line-strong` | `#cfd6e2` | `#3a445a` | Girdi kenarlığı |
| `--ink` | `#111726` | `#e9edf5` | Birincil metin |
| `--ink-2` | `#4b5566` | `#a9b3c4` | İkincil metin, gövde |
| `--ink-3` | `#68717f` | `#8b95a6` | İpucu, etiket, tablo başlığı |

### Marka ve anlam

| Token | Açık | Koyu | Anlamı |
|---|---|---|---|
| `--brand` | `#004e92` | `#00aeef` | Birincil eylem, aktif durum, seçim, **metin** |
| `--brand-ink` | `#003a6e` | `#4fc3f7` | Marka üzerinde metin, hover |
| `--brand-soft` | `#e7f1fa` | `#10273a` | Aktif menü, bilgi kutusu zemini |
| `--brand-accent` | `#00aeef` | `#00aeef` | **Yalnızca dolgu ve gradyan** — metin olarak asla |
| `--money` | `#0a7d56` | `#3ecf9a` | **Ciro, kazanç, olumlu değişim** |
| `--danger` | `#c93a3a` | `#f07171` | **Kayıp, no-show, yıkıcı eylem** |
| `--warn` | `#9c6109` | `#e0a44a` | Bekleyen, dikkat, kota uyarısı |
| `--violet` | `#6d4ac7` | `#a68bef` | **Kapora ve paket** (para ama ciro değil) |
| `--cyan` | `#0e8ba1` | `#4fc3d9` | Kanal, ikincil veri kırılımı |

**Marka:** Logo `#00AEEF → #004E92` gradyanlı geometrik R'dir; `RZ.util.logoMark(boyut)`
tek kaynaktır. Açık temada birincil `#004E92` (beyazda 8,38:1), koyu temada Figma
paletindeki gibi `#00AEEF`'e döner (koyu yüzeyde 6,95:1). `#00AEEF` beyaz üzerinde
2,53:1 verir — **hiçbir koşulda metin rengi değildir**, yalnızca dolgu, gradyan ve
koyu tema.

**Kurallar**
- Anlam renkleri aksan rengi değildir; `--money` yalnızca gerçekten paraya, `--danger`
  yalnızca gerçekten kayba karşılık gelir. Dekoratif kullanılmaz.
- `--money` ve `--danger` bir arada bilinçli bir çifttir: ciro ve kayıp yan yana okunur.
- Kapora `--violet` taşır çünkü ciro değildir — güvencedeki paradır. Bu ayrım
  Kapora ekranında, takvim rozetinde ve fatura kartında tutarlı korunur.

### Kontrast eşiği (ölçülmüş, tahmin değil)

Tüm gövde ve etiket metinleri **≥ 4,5:1** olmak zorunda. Doğrulanmış değerler:

| | Açık tema | Koyu tema |
|---|---|---|
| `--ink-3` 12px ipucu | 4,93 | 5,82 |
| `--money` küçük metin | 5,15 | 8,87 |
| `--warn` rozet | 5,09 | 8,02 |
| `--danger` küçük metin | 5,06 | 6,12 |

`#00AEEF` gibi parlak camgöbeği tonları beyaz üzerinde 2,53 verir — **metin olarak
kullanılmaz**, yalnızca dolgu ve gradyanda yer alabilir.

---

## 3. Tipografi

Üç yüz, üç iş. Dördüncüsü eklenmez.

| Token | Yazı tipi | Nerede |
|---|---|---|
| `--font-display` | Bricolage Grotesque | Yalnızca `h1`, `h2`, logo |
| `--font-text` | Source Serif 4 | Yalnızca tanıtım sayfasının okuma metni |
| `--font` | Inter | Panel, veri, form, düğme, rozet — her yer |

**Neden ayrım:** Pazarlama metni kimlik taşır, ürün ekranı okunaklılık taşır. Panelde
11–12px etiketler ve hizalı rakam sütunları var; Inter bunda ölçülmüş biçimde iyi.
Serifi panele sokmak okunaklılığı, Inter'i tüm ürüne dayatmak kimliği zayıflatır.

**Ölçek**

| Kullanım | Boyut / ağırlık |
|---|---|
| Kahraman başlık | `clamp(34px, 5.4vw, 58px)` / 700 |
| Bölüm başlığı | `clamp(25px, 3.4vw, 36px)` / 640 |
| Birincil KPI değeri | 40px / 680, `tabular-nums` |
| KPI değeri | 27px / 680, `tabular-nums` |
| Kart başlığı | 15–16px / 640 |
| Gövde | 14–15px / 400–560 |
| İpucu, etiket | 11,5–12,5px / 550 |

Rakam gösteren her yer `font-variant-numeric: tabular-nums` kullanır. Başlıklarda
`text-wrap: balance` açıktır.

---

## 4. Boşluk, yarıçap, gölge

- **Yarıçap:** `--r-sm` 8px (rozet, küçük düğme) · `--r` 12px (girdi, düğme) ·
  `--r-lg` 16px (kart) · `--r-xl` 22px (modal, öne çıkan blok). Telefon çerçevesi 36px.
- **Gölge:** `--sh-1` kart · `--sh-2` hover · `--sh-3` modal ve çekmece. Dekoratif gölge yok.
- **Boşluk:** kart içi 15–20px, kart arası 14px, bölüm arası 74px (tanıtım) / 14px (panel).
- Kardeş öğeler `gap` ile dizilir; tek tek `margin` verilmez.

---

## 5. Bileşen sözlüğü

Yeni bileşen icat etmeden önce bu listeye bakın.

| Sınıf / API | Ne zaman |
|---|---|
| `.card` + `.card-head` + `.card-pad` | Bir veri bölgesi, başlığı ve eylemi varsa |
| `.kpi` / `.kpi.hero` | Tek bir sayı. Ekranda **en fazla bir** `.hero` olur |
| `.kpi-row` | KPI dizisi; ilk öğe birincil, diğerleri destek |
| `.badge` + `-brand/-money/-warn/-danger/-violet/-cyan` | Durum etiketi |
| `.lrow` | Tıklanabilir liste satırı (rezervasyon, müşteri, kapora) |
| `.tbl` + `.tbl-wrap` | Sıralanabilir/taranabilir veri; `.tbl-wrap` yatay kaydırmayı içerir |
| `.split` / `.split.narrow` / `.split.side` | İki sütunlu yerleşim; 980px altında tek sütuna düşer |
| `.chip-tog` | Filtre / segment seçimi |
| `RZ.ui.emptyState(başlık, metin, ikon, eylem)` | Boş durum — **eylem parametresi zorunlu sayılır** |
| `RZ.ui.skeleton(kind)` | Yükleme; `panel` \| `list` \| `chart` |
| `RZ.ui.errorState(err, onRetry)` | Hata; kullanıcıya ham hata metni gösterilmez |
| `RZ.ui.guarded(feature, render)` | Pakete kapalı içerik: bulanık önizleme + yükseltme |
| `RZ.ui.lineChart / barChart / donut / barList / sparkline` | Grafikler |
| `.setup-hero` + `.setup-card` | İlk gün kurulum akışı |

**Kart kuralı:** kart, içindeki şey bir bölge ya da etkileşimse kullanılır. Dokuz özelliği
dokuz karta koymak kart değil kutudur — tanıtım sayfasındaki özellik listesi bu yüzden
çizgiyle ayrılmış editöryel liste, kart değil.

---

## 6. Erişilebilirlik — pazarlık konusu değil

- Gövde ve etiket metni **≥ 4,5:1** (§2'deki tablo).
- Dokunma hedefi masaüstünde **≥ 34px**, `pointer: coarse` cihazlarda **≥ 44px**.
  Bu kural `@media (pointer:coarse)` bloğunda merkezî olarak uygulanır.
- Her sayfada tek bir `<main id="main">` ve ilk sekme durağı olarak `.skip` bağlantısı.
- Dekoratif ikonlar `aria-hidden`; **veri taşıyan her grafik** `role="img"` ve seriyi
  bir cümleyle özetleyen `aria-label` taşır.
- Fare gerektiren her etkileşimin klavye alternatifi olur. Takvimde sürükle-bırakın
  karşılığı: randevu `tabindex="0"`, Enter detayı açar, oradan saat değiştirilir.
- `prefers-reduced-motion` tüm animasyonları kapatır.
- Görünür odak halkası (`:focus-visible`) hiçbir yerde kaldırılmaz.

---

## 7. Yazım

- Kullanıcının dilinden yaz, sistemin dilinden değil: "kaynak" (saha, koltuk, kabin) denir,
  "resource entity" denmez.
- Düğme ne yapacağını söyler; sonrasında gelen bildirim ne olduğunu söyler
  ("Tahsil et" → "Kapora tahsil edildi").
- Hata mesajı neyin yanlış gittiğini **ve** ne yapılacağını söyler. Özür dilemez.
  "1. Saha 10:00–11:30 arası dolu (Kadıköy United)." — belirsiz değil, eyleme dönük.
- Boş durum çıkmaz sokak değildir: ne olduğunu söyler, bir sonraki adımı önerir.
- Tahmini rakam **"tahmini"** diye etiketlenir ve nasıl hesaplandığı yazılır.
  Değer kanıtı kartında paket peşinatı toplama dahil edilmez — abartmak, beklenti
  açığını ürünün içine koymaktır.
- Türkçe yüzde işareti sayıdan **önce** gelir: `%57`.
- Para her yerde `RZ.util.tl()` ile biçimlenir; tarih `RZ.util.dateStr()` ile.

---

## 8. Yapma listesi

- Dördüncü yazı tipi ekleme.
- Anlam renklerini dekoratif kullanma (`--money` yeşil olduğu için kullanılmaz).
- Beyaz üzerinde `--money`, `--warn`, `--danger` tonlarını daha da açma.
- Renkli daire içinde ikon + kalın başlık + iki satır açıklama grid'i kurma.
- Bir ekrana ikinci bir `.kpi.hero` koyma.
- Hover'a bağlı keşif — dokunmatik cihazda hover yoktur.
- Yer tutucu metni tek etiket olarak kullanma; `<label>` görünür kalır.
- Kullanıcıya ham hata metni gösterme.
- Stok fotoğraf kullanma; kategori görselleri token renklerinden türetilen gradyanlardır.

---

## 9. Değişiklik kaydı

| Tarih | Değişiklik | Gerekçe |
|---|---|---|
| 28.08.2026 | Belge oluşturuldu | Sistem koddaydı, yazılı değildi |
| 28.08.2026 | Birincil KPI hiyerarşisi (`.kpi.hero`) | Dört eşit KPI "önce şunu gör" sorusunu cevaplamıyordu |
| 28.08.2026 | Durum sistemi: boş / iskelet / hata | Boş ekranlar çıkmaz sokaktı, hata ham metin basıyordu |
| 28.08.2026 | Özellik grid'i → editöryel liste | Kart bir etkileşim değildi; en tanınabilir AI düzeniydi |
| 28.08.2026 | Source Serif 4 (yalnız tanıtım metni) | Inter tek başına nötr bir ses bırakıyordu |
| 28.08.2026 | Kontrast token'ları 4,5:1'e çekildi | Ölçüldü: 3,39–4,38 aralığındaydı |
| 28.08.2026 | Dokunma hedefleri 34/44px | Saha kullanımı tablet ve telefon |
| 28.08.2026 | Marka Figma paletine geçti (`#004E92`/`#00AEEF`) + gradyanlı R logosu | Gerçek marka kimliği oradaydı; ürünün tek markası olur |
