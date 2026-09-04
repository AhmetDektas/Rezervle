/* Rezervle — demo veri ureteci
   Tohumlu rastgele kullanir: demo her acilista ayni, tutarli ve gercekci gorunur.
   Uretilen kayitlar cakisma motorunun kurallarina uyar (ayni kaynak ayni anda iki kez satilmaz). */
(function (RZ) {
  'use strict';
  const U = RZ.util;

  const ISIM = [
    'Ahmet Yılmaz', 'Mehmet Demir', 'Ayşe Kaya', 'Fatma Şahin', 'Mustafa Çelik', 'Emine Yıldız',
    'Ali Yıldırım', 'Zeynep Öztürk', 'Hüseyin Aydın', 'Hatice Özdemir', 'İbrahim Arslan', 'Elif Doğan',
    'Murat Kılıç', 'Merve Aslan', 'Osman Çetin', 'Sultan Korkmaz', 'Burak Koç', 'Selin Kurt',
    'Emre Özkan', 'Büşra Şimşek', 'Serkan Polat', 'Derya Erdoğan', 'Onur Yalçın', 'Ceren Bulut',
    'Kaan Aksoy', 'Melis Güneş', 'Barış Taş', 'İrem Bozkurt', 'Cem Aydemir', 'Gizem Ateş',
    'Tolga Çakır', 'Pınar Uzun', 'Volkan Şen', 'Nazlı Kaplan', 'Deniz Turan', 'Ebru Duman',
    'Hakan Tekin', 'Seda Yavuz', 'Uğur Bilgin', 'Aslı Ergün', 'Furkan Sarı', 'Damla Keskin',
    'Berk Özer', 'Yasemin Acar', 'Sinan Güler', 'Tuğçe Avcı', 'Kerem Balcı', 'Nihan Toprak',
    'Mert Sezer', 'Ecem Kavak', 'Arda Tunç', 'Bengi Nalbant', 'Eren Solmaz', 'Duygu Kandemir',
    'Okan Sevinç', 'Şeyma Kutlu', 'Yiğit Bayram', 'Sena Alkan', 'Batuhan Gül', 'Esra Menteş',
  ];

  const TAKIM = ['Yıldızspor', 'Cuma Grubu', 'Ofis Takımı', 'Mahalle FC', 'Kadıköy United', 'Gece Vardiyası'];

  function phone(r) {
    const pre = U.pick(r, ['532', '533', '535', '536', '505', '506', '542', '544', '551']);
    return `0${pre} ${Math.floor(100 + r() * 899)} ${U.pad2(Math.floor(r() * 99))} ${U.pad2(Math.floor(r() * 99))}`;
  }

  /* ------------------------------------------------------------------ */
  function build() {
    const r = U.rng(20260827);
    const today = U.startOfDay(new Date());
    // 100 gunluk gecmis: "60 gundur gelmeyen musteri" gibi metriklerin olusabilmesi
    // ve "Son 90 gun" doneminin dolu olmasi icin gerekli.
    const HISTORY = 100;
    const FUTURE = 14;

    const state = {
      v: 1,
      activeBizId: 'biz_saha',
      businesses: [],
      resources: [], services: [], staff: [], customers: [],
      reservations: [], soldPackages: [], campaigns: [], activity: [],
    };

    /* ---------------- Isletme 1: Hali saha tesisi ---------------- */
    const saha = {
      id: 'biz_saha',
      name: 'Gülveren Spor Tesisleri',
      category: 'Halı saha & tenis kortu',
      emoji: '⚽',
      city: 'Ankara',
      district: 'Mamak',
      address: 'Gülveren Mah. Şehit Mustafa Cad. No:14, Mamak / Ankara',
      phone: '0312 361 44 20',
      plan: 'pro',
      addons: [],
      smsUsed: 412,
      since: '2026-03-14',
      rating: 4.7,
      hours: { 0: [540, 1440], 1: [540, 1440], 2: [540, 1440], 3: [540, 1440], 4: [540, 1440], 5: [540, 1440], 6: [540, 1440] },
      packageDefs: [
        { id: 'pd_10s', name: '10 Saat Halı Saha Paketi', credits: 10, price: 8000, validDays: 180 },
        { id: 'pd_5t', name: '5 Saat Tenis Kortu Paketi', credits: 5, price: 2250, validDays: 120 },
      ],
      settings: { reminderHours: 3, depositDefault: 200, cancelWindow: 6 },
    };
    const sahaRes = [
      { id: 'res_s1', bizId: saha.id, name: '1. Saha', type: 'Halı saha', color: '#2b59f0', closed: false },
      { id: 'res_s2', bizId: saha.id, name: '2. Saha', type: 'Halı saha', color: '#0e9f6e', closed: false },
      { id: 'res_s3', bizId: saha.id, name: 'Kapalı Saha', type: 'Halı saha', color: '#6d4ac7', closed: false },
      { id: 'res_t1', bizId: saha.id, name: 'Tenis Kortu', type: 'Kort', color: '#b4700a', closed: false },
    ];
    const sahaSvc = [
      { id: 'svc_h1', bizId: saha.id, name: 'Halı Saha · 1 Saat', duration: 60, price: 900, deposit: 200, color: '#2b59f0', resourceTypes: ['Halı saha'] },
      { id: 'svc_h15', bizId: saha.id, name: 'Halı Saha · 1,5 Saat', duration: 90, price: 1300, deposit: 300, color: '#1e40c4', resourceTypes: ['Halı saha'] },
      { id: 'svc_t1', bizId: saha.id, name: 'Tenis Kortu · 1 Saat', duration: 60, price: 450, deposit: 100, color: '#b4700a', resourceTypes: ['Kort'] },
      { id: 'svc_ders', bizId: saha.id, name: 'Tenis Dersi (özel)', duration: 60, price: 750, deposit: 150, color: '#0e8ba1', resourceTypes: ['Kort'] },
    ];

    /* ---------------- Isletme 2: Guzellik salonu ---------------- */
    const salon = {
      id: 'biz_salon',
      name: 'Cinnah Güzellik & Bakım',
      category: 'Güzellik salonu',
      emoji: '💇',
      city: 'Ankara',
      district: 'Çankaya',
      address: 'Cinnah Cad. No:62/3, Çankaya / Ankara',
      phone: '0312 428 17 06',
      plan: 'starter',
      addons: [],
      smsUsed: 168,
      since: '2026-05-02',
      rating: 4.9,
      hours: { 0: null, 1: [570, 1200], 2: [570, 1200], 3: [570, 1200], 4: [570, 1200], 5: [570, 1260], 6: [570, 1260] },
      packageDefs: [
        { id: 'pd_8seans', name: '8 Seans Cilt Bakımı', credits: 8, price: 7200, validDays: 240 },
        { id: 'pd_4boya', name: '4 Seans Saç Boyası', credits: 4, price: 5600, validDays: 180 },
      ],
      settings: { reminderHours: 24, depositDefault: 250, cancelWindow: 12 },
    };
    const salonRes = [
      { id: 'res_k1', bizId: salon.id, name: '1. Koltuk', type: 'Koltuk', color: '#6d4ac7', closed: false },
      { id: 'res_k2', bizId: salon.id, name: '2. Koltuk', type: 'Koltuk', color: '#2b59f0', closed: false },
      { id: 'res_kab', bizId: salon.id, name: 'Bakım Kabini', type: 'Kabin', color: '#0e9f6e', closed: false },
    ];
    const salonSvc = [
      { id: 'svc_kesim', bizId: salon.id, name: 'Saç Kesim & Fön', duration: 45, price: 550, deposit: 0, color: '#6d4ac7', resourceTypes: ['Koltuk'] },
      { id: 'svc_boya', bizId: salon.id, name: 'Saç Boyası', duration: 120, price: 1800, deposit: 400, color: '#2b59f0', resourceTypes: ['Koltuk'] },
      { id: 'svc_bakim', bizId: salon.id, name: 'Cilt Bakımı', duration: 60, price: 1100, deposit: 250, color: '#0e9f6e', resourceTypes: ['Kabin'] },
      { id: 'svc_manikur', bizId: salon.id, name: 'Manikür & Pedikür', duration: 45, price: 500, deposit: 0, color: '#0e8ba1', resourceTypes: ['Kabin'] },
      { id: 'svc_agda', bizId: salon.id, name: 'Ağda', duration: 30, price: 450, deposit: 0, color: '#b4700a', resourceTypes: ['Kabin'] },
    ];
    const salonStaff = [
      { id: 'stf_1', bizId: salon.id, name: 'Ayşe Hanım', role: 'Kuaför', color: '#6d4ac7' },
      { id: 'stf_2', bizId: salon.id, name: 'Zeynep', role: 'Kuaför', color: '#2b59f0' },
      { id: 'stf_3', bizId: salon.id, name: 'Merve', role: 'Cilt bakım uzmanı', color: '#0e9f6e' },
    ];

    /* ---------------- Isletme 3: yeni kayit (ilk gun deneyimi) ----------------
       Hicbir kaynagi, hizmeti ve rezervasyonu yok. Panelin "ilk gun" halini
       gostermek icin var: gercek bir musterinin ilk giris ekrani budur. */
    const yeni = {
      id: 'biz_yeni',
      name: 'Kızılay Kuaför (yeni kayıt)',
      category: 'Kuaför',
      emoji: '✂️',
      city: 'Ankara',
      district: 'Çankaya',
      address: '',
      phone: '',
      plan: 'starter',
      addons: [],
      smsUsed: 0,
      since: U.dayKey(today),
      rating: 0,
      hours: { 0: null, 1: [540, 1200], 2: [540, 1200], 3: [540, 1200], 4: [540, 1200], 5: [540, 1260], 6: [540, 1260] },
      packageDefs: [],
      settings: { reminderHours: 24, depositDefault: 0, cancelWindow: 12 },
      isNew: true,
    };

    state.businesses.push(saha, salon, yeni);
    state.resources.push(...sahaRes, ...salonRes);
    state.services.push(...sahaSvc, ...salonSvc);
    state.staff.push(...salonStaff);

    /* ---------------- Musteriler ---------------- */
    function makeCustomers(bizId, n, offset, teamish) {
      const list = [];
      for (let i = 0; i < n; i++) {
        const base = ISIM[(i + offset) % ISIM.length];
        const name = teamish && i % 5 === 0 ? U.pick(r, TAKIM) : base;
        list.push({
          id: `cus_${bizId}_${i}`, bizId, name, phone: phone(r),
          note: '', tags: [],
          createdAt: U.dayKey(U.addDays(today, -Math.floor(r() * 200) - 5)),
        });
      }
      return list;
    }
    const sahaCus = makeCustomers(saha.id, 52, 0, true);
    const salonCus = makeCustomers(salon.id, 44, 17, false);
    state.customers.push(...sahaCus, ...salonCus);

    /* ---------------- Rezervasyon uretimi ---------------- */
    function fillBiz(b, resources, services, staff, cus, opts) {
      const o = opts || {};
      for (let dOff = -HISTORY; dOff <= FUTURE; dOff++) {
        const date = U.addDays(today, dOff);
        const hrs = b.hours[date.getDay()];
        if (!hrs) continue;
        const key = U.dayKey(date);
        const wknd = date.getDay() === 0 || date.getDay() === 6 || date.getDay() === 5;
        const past = dOff < 0;
        const isToday = dOff === 0;

        // Benimseme egrisi: uygulamadan gelen rezervasyon payi zamanla artar
        const adoption = U.clamp(0.18 + ((dOff + HISTORY) / (HISTORY + FUTURE)) * 0.5, 0.1, 0.72);

        resources.forEach((res) => {
          const svcPool = services.filter((s) => !s.resourceTypes || s.resourceTypes.includes(res.type));
          if (!svcPool.length) return;
          // Yogunluk hedefi
          let target = (o.peakOnly ? (wknd ? 0.72 : 0.58) : wknd ? 0.68 : 0.52) * (dOff > 7 ? 0.55 : 1);
          if (dOff > 0 && dOff <= 7) target *= 0.8;
          let t = hrs[0];
          while (t < hrs[1] - 30) {
            // Yogun saat mi?
            const hour = t / 60;
            const hot = o.peakOnly ? hour >= 18 && hour <= 23 : hour >= 10 && hour <= 19;
            const chance = target * (hot ? 1.25 : 0.42);
            if (r() < chance) {
              const svc = U.pick(r, svcPool);
              if (t + svc.duration > hrs[1]) break;
              // Kayan musteri penceresi: ust sinir zamanla buyur (yeni musteri kazanimi),
              // alt sinir da yavasca kayar (musteri kaybi). Boylece "yeni musteri" ve
              // "kaybolan musteri" metrikleri gercek veriden dogar.
              const progress = (dOff + HISTORY) / (HISTORY + FUTURE);
              const hi = Math.max(10, Math.round(cus.length * (0.34 + 0.66 * progress)));
              const lo = Math.floor(cus.length * 0.22 * progress);
              const c = cus[Math.min(cus.length - 1, lo + Math.floor(r() * Math.max(5, hi - lo)))];
              const stf = staff.length ? U.pick(r, staff) : null;
              const fromApp = r() < adoption;
              const channel = fromApp ? 'app' : U.pick(r, ['phone', 'phone', 'phone', 'walkin', 'whatsapp']);

              // Tek bir rastgele deger cekilir: boylece uretim, gunun saatinden bagimsiz
              // olarak hep ayni veriyi verir (demo tutarliligi).
              const x = r();
              let status;
              if (past) {
                status = x < 0.085 ? 'no_show' : x < 0.125 ? 'cancelled' : 'completed';
              } else if (isToday) {
                const nowM = U.minsOfDay(new Date());
                status = t + svc.duration < nowM ? (x < 0.9 ? 'completed' : 'no_show')
                  : t < nowM ? 'arrived'
                  : x < 0.82 ? 'confirmed' : 'pending';
              } else {
                status = x < 0.78 ? 'confirmed' : 'pending';
              }

              // Fiyat: yogun saat farki + ara sira indirim
              let price = svc.price;
              if (o.peakOnly && hot) price = Math.round(price * 1.1);
              if (r() < 0.08) price = Math.round(price * 0.85);

              const rez = {
                id: U.uid('rez'), bizId: b.id, customerId: c.id, guestName: null,
                serviceId: svc.id, resourceId: res.id, staffId: stf ? stf.id : null,
                date: key, start: t, end: t + svc.duration,
                status, channel, price,
                deposit: null, note: '', packageId: null,
                createdAt: U.addDays(date, -Math.floor(r() * 6) - 1).toISOString(),
              };
              // Kapora: uygulamadan gelen ve kapora isteyen hizmetlerde
              if (svc.deposit && fromApp && r() < 0.62) {
                rez.deposit = {
                  amount: svc.deposit, method: 'card',
                  status: status === 'no_show' ? (r() < 0.6 ? 'charged' : 'chargeable')
                    : status === 'completed' ? 'released'
                    : 'held',
                };
              }
              if (status === 'arrived' || status === 'completed') {
                if (fromApp && r() < 0.5) rez.checkinAt = date.toISOString();
              }
              state.reservations.push(rez);
              t += svc.duration + (r() < 0.25 ? 30 : 0);
              continue;
            }
            t += 30;
          }
        });
      }
    }

    fillBiz(saha, sahaRes, sahaSvc, [], sahaCus, { peakOnly: true });
    fillBiz(salon, salonRes, salonSvc, salonStaff, salonCus, { peakOnly: false });

    /* ---------------- Satilmis paketler ---------------- */
    [0, 3, 7, 11, 15, 19, 24, 30].forEach((i, n) => {
      const c = sahaCus[i % sahaCus.length];
      const def = saha.packageDefs[n % 2];
      state.soldPackages.push({
        id: U.uid('pkg'), bizId: saha.id, customerId: c.id, defId: def.id,
        name: def.name, credits: def.credits, used: Math.floor(r() * def.credits),
        price: def.price, soldAt: U.dayKey(U.addDays(today, -Math.floor(r() * 55) - 3)),
        expiresAt: U.dayKey(U.addDays(today, def.validDays - Math.floor(r() * 40))),
      });
    });
    [2, 6, 9].forEach((i, n) => {
      const c = salonCus[i % salonCus.length];
      const def = salon.packageDefs[n % 2];
      state.soldPackages.push({
        id: U.uid('pkg'), bizId: salon.id, customerId: c.id, defId: def.id,
        name: def.name, credits: def.credits, used: Math.floor(r() * def.credits),
        price: def.price, soldAt: U.dayKey(U.addDays(today, -Math.floor(r() * 40) - 3)),
        expiresAt: U.dayKey(U.addDays(today, def.validDays)),
      });
    });

    /* ---------------- Gecmis kampanyalar ---------------- */
    state.campaigns.push(
      {
        id: U.uid('cmp'), bizId: saha.id, title: 'Hafta içi gündüz %25 indirim',
        discount: 25, audience: 148, redeemed: 21, status: 'sent',
        window: 'Pzt–Per · 10:00–16:00',
        createdAt: U.addDays(today, -18).toISOString(),
      },
      {
        id: U.uid('cmp'), bizId: saha.id, title: 'Salı akşamı boş saha kampanyası',
        discount: 15, audience: 96, redeemed: 11, status: 'sent',
        window: 'Salı · 19:00–21:00',
        createdAt: U.addDays(today, -6).toISOString(),
      }
    );

    /* ---------------- Islem gecmisi ---------------- */
    state.activity.push(
      { id: U.uid('log'), bizId: saha.id, type: 'plan', text: 'Pro pakete geçildi', at: U.addDays(today, -42).toISOString() },
      { id: U.uid('log'), bizId: saha.id, type: 'campaign', text: 'Kampanya gönderildi: Salı akşamı boş saha', at: U.addDays(today, -6).toISOString() },
      { id: U.uid('log'), bizId: saha.id, type: 'package', text: '10 Saat Halı Saha Paketi satıldı (8.000 ₺)', at: U.addDays(today, -3).toISOString() }
    );

    return state;
  }

  RZ.seed = { build };
})(window.RZ);
