/* Rezervle — örnek işletme verisi
   Tohumlu rastgele: aynı gün açıldığında hep aynı tabloyu verir.
   Üretilen her kayıt çakışma kurallarına uyar; müşteri havuzu zamanla kayar,
   böylece "yeni müşteri" ve "kaybolan müşteri" gerçek veriden doğar. */
RZ.seed = function () {
  const u = RZ.u;
  const r = u.rng(90218);
  const today = u.day0(new Date());
  const BACK = 90, FWD = 14;

  const ISIM = [
    'Ahmet Yılmaz','Mehmet Demir','Ayşe Kaya','Mustafa Çelik','Ali Yıldırım','Hüseyin Aydın',
    'İbrahim Arslan','Murat Kılıç','Osman Çetin','Burak Koç','Emre Özkan','Serkan Polat',
    'Onur Yalçın','Kaan Aksoy','Barış Taş','Cem Aydemir','Tolga Çakır','Volkan Şen',
    'Deniz Turan','Hakan Tekin','Uğur Bilgin','Furkan Sarı','Berk Özer','Sinan Güler',
    'Kerem Balcı','Mert Sezer','Arda Tunç','Eren Solmaz','Okan Sevinç','Yiğit Bayram',
    'Batuhan Gül','Selim Korkmaz','Emrah Duman','Koray Aslan','Tuncay Erdem','Levent Uzun',
    'Cihan Kaplan','Ozan Bulut','Görkem Ateş','Alper Yavuz','Doruk Menteş','Ege Nalbant',
    'Sercan Kurt','Bora Şimşek','Umut Acar','Efe Toprak','Tarık Bilir','Kağan Sarıoğlu',
  ];
  const TAKIM = ['Cuma Grubu','Ofis Takımı','Mahalle FC','Gece Vardiyası','Yıldızspor','Salı Ekibi','Kombine Grup'];

  const phone = () => `0${u.rng(Math.floor(r() * 1e6))() > .5 ? '53' : '54'}${Math.floor(2 + r() * 7)} ` +
    `${Math.floor(100 + r() * 899)} ${u.p2(Math.floor(r() * 99))} ${u.p2(Math.floor(r() * 99))}`;

  const biz = {
    name: 'Gülveren Spor Tesisleri',
    kind: 'Halı saha ve tenis kortu',
    city: 'Ankara', district: 'Mamak',
    phone: '0312 361 44 20',
    address: 'Gülveren Mah. Şehit Mustafa Cad. No:14, Mamak / Ankara',
    // 0=Pazar … 6=Cumartesi · dakika cinsinden [açılış, kapanış]
    hours: { 0: [540, 1440], 1: [540, 1440], 2: [540, 1440], 3: [540, 1440], 4: [540, 1440], 5: [540, 1440], 6: [540, 1440] },
    settings: { reminderHours: 3, defaultDeposit: 200 },
  };

  const resources = [
    { id: 'res1', name: '1. Saha', type: 'Halı saha', closed: false },
    { id: 'res2', name: '2. Saha', type: 'Halı saha', closed: false },
    { id: 'res3', name: 'Kapalı Saha', type: 'Halı saha', closed: false },
    { id: 'res4', name: 'Tenis Kortu', type: 'Kort', closed: false },
  ];

  const services = [
    { id: 'sv1', name: 'Halı Saha · 1 saat',   duration: 60, price: 900,  deposit: 200, types: ['Halı saha'] },
    { id: 'sv2', name: 'Halı Saha · 1,5 saat', duration: 90, price: 1300, deposit: 300, types: ['Halı saha'] },
    { id: 'sv3', name: 'Tenis Kortu · 1 saat', duration: 60, price: 450,  deposit: 100, types: ['Kort'] },
    { id: 'sv4', name: 'Tenis Dersi (özel)',   duration: 60, price: 750,  deposit: 150, types: ['Kort'] },
  ];

  const customers = ISIM.map((n, i) => ({
    id: 'c' + i,
    name: i % 7 === 0 ? TAKIM[(i / 7) % TAKIM.length | 0] : n,
    phone: phone(),
    note: '',
  }));

  const reservations = [];
  for (let off = -BACK; off <= FWD; off++) {
    const d = u.addD(today, off);
    const h = biz.hours[d.getDay()];
    if (!h) continue;
    const k = u.key(d);
    const past = off < 0, isToday = off === 0;
    const weekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
    // Uygulamadan gelen pay zamanla artar
    const online = u.clamp(0.10 + ((off + BACK) / (BACK + FWD)) * 0.42, 0.08, 0.60);
    // Müşteri penceresi: üst sınır büyür (kazanım), alt sınır kayar (kayıp)
    const prog = (off + BACK) / (BACK + FWD);
    const hi = Math.max(12, Math.round(customers.length * (0.32 + 0.68 * prog)));
    const lo = Math.floor(customers.length * 0.24 * prog);

    resources.forEach((res) => {
      const pool = services.filter((s) => !s.types || s.types.includes(res.type));
      if (!pool.length) return;
      let target = (weekend ? 0.66 : 0.5) * (off > 7 ? 0.5 : off > 0 ? 0.8 : 1);
      let t = h[0];
      while (t < h[1] - 30) {
        const hot = t / 60 >= 18 && t / 60 <= 23;
        if (r() < target * (hot ? 1.3 : 0.38)) {
          const svc = pool[Math.floor(r() * pool.length)];
          if (t + svc.duration > h[1]) break;
          const c = customers[Math.min(customers.length - 1, lo + Math.floor(r() * Math.max(5, hi - lo)))];
          const fromApp = r() < online;
          const ch = fromApp ? 'online' : ['phone', 'phone', 'phone', 'walkin', 'whatsapp'][Math.floor(r() * 5)];

          // Tek rastgele değer: üretim günün saatinden bağımsız, hep aynı
          const x = r();
          let status;
          if (past) status = x < 0.075 ? 'noshow' : x < 0.115 ? 'cancelled' : 'done';
          else if (isToday) {
            const now = u.mins(new Date());
            status = t + svc.duration < now ? (x < 0.9 ? 'done' : 'noshow')
              : t < now ? 'arrived' : x < 0.8 ? 'confirmed' : 'pending';
          } else status = x < 0.78 ? 'confirmed' : 'pending';

          let price = svc.price;
          if (hot) price = Math.round(price * 1.1);
          if (r() < 0.07) price = Math.round(price * 0.85);

          const rec = {
            id: u.id('r'), customerId: c.id, serviceId: svc.id, resourceId: res.id,
            date: k, start: t, end: t + svc.duration, status, channel: ch, price,
            deposit: null, note: '', at: u.addD(d, -Math.floor(r() * 5) - 1).toISOString(),
          };
          if (svc.deposit && fromApp && r() < 0.6) {
            rec.deposit = {
              amount: svc.deposit,
              charged: status === 'noshow' && r() < 0.6,
              chargeable: status === 'noshow',
              released: status === 'done',
            };
            if (rec.deposit.charged) rec.deposit.chargeable = false;
          }
          reservations.push(rec);
          t += svc.duration + (r() < 0.22 ? 30 : 0);
          continue;
        }
        t += 30;
      }
    });
  }

  return {
    v: 2, biz, resources, services, customers, reservations,
    log: [
      { id: u.id('l'), text: 'Örnek veri yüklendi', at: new Date().toISOString() },
    ],
  };
};
