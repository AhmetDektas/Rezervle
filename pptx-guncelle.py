"""
Rezzerv tanıtım sunumu — mevcut şablonun metinlerini gerçek içerikle değiştirir.

Tasarım, fotoğraflar ve yerleşim olduğu gibi kalır; yalnızca metin kutularının
içeriği yazılır. Biçim korunur: metin ilk `run` içine yazılıp kalan run'lar
siliniyor, böylece yazı tipi/boyut/renk şablondan geliyor.

Şablondaki uydurma rakamlar (97% piyasa isteği, 40 aktif işletme, 240% büyüme)
gerçek değildi ve kullanılmadı. Yerlerine 41 işletmeyle yapılan saha anketinin
gerçek sonuçları yazıldı.
"""

from pptx import Presentation

KAYNAK = r"C:\Users\ahmet\Downloads\Black and Green Circle Gradient Sass Startup Pricing Plan Presentation.pptx"
HEDEF = r"C:\Users\ahmet\Downloads\Rezzerv Tanitim Sunumu.pptx"

# (slayt, shape_id) -> yeni metin.  '\n' paragraf ayırır.
DEGISIM = {
    # --- 1 · Kapak ---
    (1, 11): "Ankara'nın\nRandevu Pazarı",
    (1, 12): "İŞLETMELER İÇİN DİJİTAL ÇÖZÜMLER",

    # --- 2 · Problem ---
    (2, 10): "Online rezervasyon isteyen",
    (2, 11): "%92",
    (2, 14): "Görüşülen işletme",
    (2, 15): "41",
    (2, 18): "Abonelik modelini seçen",
    (2, 19): "%71",
    (2, 26): "Randevunuz hâlâ\ndefterde mi?",
    (2, 27): "Ankara'da 41 işletmeyle yüz yüze görüştük. Neredeyse tamamı "
             "\"randevu sistemim var\" diyor; ne kullandıklarını sorunca çıkan tablo şu: "
             "%90 telefon, %70 elle tutulan defter. Başka bir uygulama kullanan yalnızca %20. "
             "Rakibimiz yazılım değil, defter.",

    # --- 3 · Takım ---
    (3, 25): "Takımımızla Tanışın",
    (3, 28): "Ürün yönü, iş modeli ve işletme ilişkileri. Pazaryerinin iki tarafını "
             "dengede tutmaktan sorumlu. Pay: %30",
    (3, 31): "Ürünün tamamını geliştiriyor: müşteri uygulaması, işletme paneli, "
             "ödeme altyapısı ve KVKK uyumu. Pay: %30",
    (3, 34): "Operasyon ve işletme kurulumu. Sahadaki işletmeleri sisteme alma ve "
             "ilk kurulum desteği. Pay: %30",
    (3, 37): "Saha araştırması ve anket çalışması. 41 işletmeyle yapılan görüşmeleri "
             "yürüttü. Pay: %5",

    # --- 4 · Neden Rezzerv ---
    (4, 25): "Neden Rezzerv?",
    (4, 26): "İşletmeye yönetim aracı satmıyoruz; müşterisini getiriyoruz. Ankette en "
             "yüksek iki beklenti de bu: kolay kullanım %80, müşteri artışı %80.",
    (4, 33): "Müşteri getiriyoruz",
    (4, 34): "İşletme tek başına bir yazılım alıyor değil; müşterinin zaten aradığı "
             "bir vitrine giriyor. Beş sektör tek uygulamada.",
    (4, 21): "Tek panelde toplanır",
    (4, 22): "Takvim, personel, hizmet, müşteri kaydı ve raporlar aynı yerde. "
             "İşletmelerin %78'i \"her şey tek yerde olsun\" dedi.",
    (4, 13): "Defterden kolay",
    (4, 14): "Katılımcıların %51'i teknoloji kullanımını \"düşük\" olarak tanımladı. "
             "Kurulum kayıt sonrası adım adım yönlendiriliyor.",

    # --- 5 · Yol haritası ---
    (5, 36): "Önümüzdeki bir yılın beş adımı",
    (5, 13): "Adım 1",
    (5, 14): "Ödeme kuruluşu\nsözleşmesi (pazaryeri modeli)",
    (5, 16): "Adım 2",
    (5, 17): "Ankara pilotu:\nanketten 38 işletme",
    (5, 22): "Adım 3",
    (5, 23): "İlk 20 aktif işletme,\nüç sektörde",
    (5, 28): "Adım 4",
    (5, 29): "Denemeden ödemeye\ndönüşümü ölçme",
    (5, 34): "Adım 5",
    (5, 35): "İkinci şehir:\naynı oyun kitabı",

    # --- 6 · Pazar ---
    (6, 6): "Ankara'da beş sektör,\nbinlerce işletme",
    (6, 7): "Restoran, güzellik salonu, halı saha, diş kliniği ve veteriner. "
            "Anketimizdeki dağılım da bu beş sektörü doğruladı. Hedefimiz önce "
            "Ankara'da arz tarafını kurmak; talep tarafı onun arkasından geliyor.",

    # --- 7 · Hizmetler ---
    (7, 29): "Ne sunuyoruz",
    (7, 21): "Online rezervasyon",
    (7, 22): "Müşteri boş saati canlı görüyor ve anında randevu alıyor. "
             "Çifte rezervasyon üç ayrı katmanda engelleniyor.",
    (7, 24): "Kapora ve ödeme",
    (7, 25): "Kapora lisanslı ödeme kuruluşunda bölünüyor; platform müşteri parasını "
             "kendi hesabında tutmuyor.",
    (7, 27): "Hatırlatma ve takip",
    (7, 28): "24 saat önce otomatik hatırlatma, müşteri kaydı ve ciro raporları. "
             "İşletmelerin %82'si hatırlatma istedi.",

    # --- 8 · Paketler ---
    (8, 47): "Basit\npaketler",
    (8, 42): "Profesyonel",
    (8, 43): "Kapora tahsilatı ve çok şube. En çok tercih edilen paket.",
    (8, 45): "Başlangıç",
    (8, 46): "Tek şube, temel randevu yönetimi.",
    (8, 48): "₺2.000",
    (8, 49): "/ ay",
    (8, 50): "₺1.500",
    (8, 51): "/ ay",
    # özellik satırları (sol sütun Profesyonel, sağ sütun Başlangıç)
    (8, 16): "Kapora tahsilatı",
    (8, 19): "Sınırsız online randevu",
    (8, 22): "3 şubeye kadar",
    (8, 25): "Otomatik hatırlatma",
    (8, 28): "Kampanya kodları",
    (8, 30): "Keşfet'te listelenme",
    (8, 33): "90 gün ücretsiz deneme",
    (8, 35): "90 gün ücretsiz deneme",

    # --- 9 · İletişim ---
    (9, 4): "Bizimle\niletişime geçin",
    (9, 6): "+90 (___) ___ __ __",
    (9, 9): "info@rezzerv.com",
    (9, 12): "www.rezzerv.com",
}

# Her slaytta tekrarlayan şablon metinleri.
TOPLU = {
    "PRICING PLAN PRESENTATION": "REZZERV TANITIM SUNUMU",
    "Salford & Co.": "Rezzerv",
    "Rezzervle INC.": "Rezzerv",
}


def yaz(tf, metin: str) -> None:
    """Metni yazar, şablonun biçimini korur."""
    satirlar = metin.split("\n")
    paras = list(tf.paragraphs)
    for i, para in enumerate(paras):
        yeni = satirlar[i] if i < len(satirlar) else ""
        runs = list(para.runs)
        if runs:
            runs[0].text = yeni
            for r in runs[1:]:
                r._r.getparent().remove(r._r)
        elif yeni:
            para.add_run().text = yeni
    # Yeni metin şablondan daha çok satır içeriyorsa sonuncuya ekle.
    if len(satirlar) > len(paras) and paras:
        kalan = " ".join(satirlar[len(paras):])
        son = paras[-1]
        if son.runs:
            son.runs[0].text = (son.runs[0].text + " " + kalan).strip()


def gez(shapes, slayt: int, sayac: dict) -> None:
    for sh in shapes:
        if sh.shape_type == 6:  # GROUP
            gez(sh.shapes, slayt, sayac)
            continue
        if not sh.has_text_frame:
            continue
        anahtar = (slayt, sh.shape_id)
        mevcut = sh.text_frame.text.strip()
        if anahtar in DEGISIM:
            yaz(sh.text_frame, DEGISIM[anahtar])
            sayac["eslesen"] += 1
        elif mevcut in TOPLU:
            yaz(sh.text_frame, TOPLU[mevcut])
            sayac["toplu"] += 1
        elif mevcut.startswith("Presentations are communication tools"):
            # Şablonun doldurma metni: eşleşmediyse boş bırakmak, İngilizce
            # bırakmaktan iyidir — ama sessizce kaybolmasın diye sayılıyor.
            sayac["kalan_lorem"] += 1
            sayac["lorem_yerleri"].append(f"S{slayt}/{sh.shape_id}")


def main() -> None:
    p = Presentation(KAYNAK)
    sayac = {"eslesen": 0, "toplu": 0, "kalan_lorem": 0, "lorem_yerleri": []}
    for i, s in enumerate(p.slides, 1):
        gez(s.shapes, i, sayac)
    p.save(HEDEF)
    print(f"Değiştirilen metin kutusu : {sayac['eslesen']}")
    print(f"Toplu değişim (marka/başlık): {sayac['toplu']}")
    print(f"Kalan İngilizce doldurma  : {sayac['kalan_lorem']} {sayac['lorem_yerleri']}")
    print(f"Kaydedildi: {HEDEF}")


if __name__ == "__main__":
    main()
