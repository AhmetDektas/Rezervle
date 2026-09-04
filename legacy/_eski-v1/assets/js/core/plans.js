/* Rezervle — paket / yetki mimarisi (entitlements)
   Tek dogruluk kaynagi: bir ozellik ya pakete dahildir ya da ek modul olarak satin alinir.
   Panelde her kilit bu tablodan okunur; kod icinde "eger pro ise" gibi dagilmis kontrol yoktur. */
(function (RZ) {
  'use strict';

  /** Ozellik katalogu. addon.price -> alt pakette ek modul olarak satilabilir. */
  const FEATURES = {
    calendar:      { name: 'Takvim ve çakışma engeli',   icon: 'calendar', core: true },
    onlineBooking: { name: 'Online rezervasyon',          icon: 'bolt',     core: true },
    listing:       { name: 'Rezervle uygulamasında listelenme', icon: 'star', core: true },
    customers:     { name: 'Müşteri kaydı ve geçmişi',    icon: 'users',    core: true },
    revenueBasic:  { name: 'Temel ciro raporu',           icon: 'trend',    core: true },
    smsReminder:   { name: 'Otomatik SMS hatırlatma',     icon: 'sms',      core: true },

    deposit:   { name: 'Kapora ve no-show koruması', icon: 'shield', minPlan: 'pro',
                 desc: 'Seçtiğiniz hizmetlerde kart ile güvence alınır. Müşteri gelmezse tutarı kendi POS’unuzdan tahsil edersiniz — para Rezervle’den geçmez.',
                 addon: { price: 500, sku: 'RZ-KAPORA' } },
    packages:  { name: 'Paket ve kredi satışı', icon: 'box', minPlan: 'pro',
                 desc: '10 saat halı saha, 8 seans bakım gibi ön ödemeli paketleri satın, bakiyeyi otomatik düşün. İşletmeye peşin nakit sağlar.',
                 addon: { price: 400, sku: 'RZ-PAKET' } },
    qrCheckin: { name: 'QR ile giriş doğrulama', icon: 'qr', minPlan: 'pro',
                 desc: 'Rezervasyon QR’ı girişte okutulur; kimin geldiği, kimin gelmediği ciroya otomatik işlenir.',
                 addon: { price: 250, sku: 'RZ-QR' } },
    campaigns: { name: 'Kampanya ve boş slot yönetimi', icon: 'mega', minPlan: 'pro',
                 desc: 'Doluluğun düştüğü saatlere hedefli indirim duyurusu gönderin; boş kapasiteyi ciroya çevirin.',
                 addon: { price: 350, sku: 'RZ-KAMPANYA' } },
    revenueAdv:{ name: 'Personel ve kaynak bazlı ciro analizi', icon: 'trend', minPlan: 'pro',
                 desc: 'Hangi hizmet, hangi saha, hangi personel ve hangi kanal ne kazandırdı — kırılımlı rapor.',
                 addon: { price: 300, sku: 'RZ-ANALIZ' } },
    multiBranch:{ name: 'Çok şube yönetimi', icon: 'building', minPlan: 'business',
                 desc: 'Şubeleri tek ekrandan yönetin, konsolide ciro alın, rol bazlı yetki verin.',
                 addon: { price: 750, sku: 'RZ-SUBE', unit: 'şube başına' } },
    api:       { name: 'API ve entegrasyonlar', icon: 'repeat', minPlan: 'business',
                 desc: 'Ön muhasebe, POS ve web siteniz için REST API; webhook ile anlık rezervasyon akışı.' },
    exportAdv: { name: 'Gelişmiş dışa aktarım', icon: 'download', minPlan: 'business',
                 desc: 'Excel/CSV çıktı, muhasebeciye özel dönemsel rapor.' },
  };

  /** Paketler — fiyatlar saha anketi medyanlarina gore kalibre edildi (medyan 2.000 ₺). */
  const PLANS = [
    {
      id: 'starter', name: 'Başlangıç', price: 1500, yearly: 15000,
      pitch: 'Tek salon, düşük hacim',
      target: 'Aylık 100 rezervasyona kadar',
      limits: { resources: 3, sms: 250, bookings: 100, branches: 1 },
      features: ['calendar', 'onlineBooking', 'listing', 'customers', 'revenueBasic', 'smsReminder'],
    },
    {
      id: 'pro', name: 'Pro', price: 2500, yearly: 25000, popular: true,
      pitch: 'Halı saha, kort, yoğun salon ve restoran',
      target: 'Aylık 200+ rezervasyon',
      limits: { resources: Infinity, sms: 1000, bookings: Infinity, branches: 1 },
      features: ['calendar', 'onlineBooking', 'listing', 'customers', 'revenueBasic', 'smsReminder',
                 'deposit', 'packages', 'qrCheckin', 'campaigns', 'revenueAdv'],
    },
    {
      id: 'business', name: 'Business', price: 3500, yearly: 35000,
      pitch: 'Zincir ve çok tesisli işletmeler',
      target: 'Birden fazla şube',
      limits: { resources: Infinity, sms: 3000, bookings: Infinity, branches: 10 },
      features: ['calendar', 'onlineBooking', 'listing', 'customers', 'revenueBasic', 'smsReminder',
                 'deposit', 'packages', 'qrCheckin', 'campaigns', 'revenueAdv',
                 'multiBranch', 'api', 'exportAdv'],
    },
  ];

  const byId = (id) => PLANS.find((p) => p.id === id) || PLANS[0];
  const rank = (id) => PLANS.findIndex((p) => p.id === id);

  /** Ozellik acik mi? Pakete dahil ya da ek modul olarak alinmis olabilir. */
  function can(biz, feature) {
    if (!biz) return false;
    const f = FEATURES[feature];
    if (!f) return true;
    if (f.core) return true;
    if (byId(biz.plan).features.includes(feature)) return true;
    return (biz.addons || []).includes(feature);
  }

  /** Ozellik neden kapali / nasil acilir? */
  function gate(biz, feature) {
    const f = FEATURES[feature] || {};
    const open = can(biz, feature);
    const need = f.minPlan ? byId(f.minPlan) : null;
    return {
      open,
      feature,
      meta: f,
      needPlan: need,
      /** Ek modul olarak alinabiliyorsa fiyati */
      addon: f.addon || null,
      /** Mevcut paketin ustune yukseltme farki */
      upgradeDelta: need ? Math.max(0, need.price - byId(biz.plan).price) : 0,
    };
  }

  /** Kaynak/SMS gibi sayisal limitler */
  function limit(biz, key) {
    return byId(biz.plan).limits[key];
  }
  function overLimit(biz, key, current) {
    const lim = limit(biz, key);
    return lim !== Infinity && current >= lim;
  }

  /** Aylik fatura: paket + ek moduller */
  function monthlyBill(biz) {
    const plan = byId(biz.plan);
    const lines = [{ label: plan.name + ' paketi', amount: plan.price, kind: 'plan' }];
    (biz.addons || []).forEach((a) => {
      const f = FEATURES[a];
      if (f && f.addon) lines.push({ label: f.name, amount: f.addon.price, kind: 'addon', key: a });
    });
    return { lines, total: lines.reduce((t, l) => t + l.amount, 0) };
  }

  /** Bir pakette kapali kalan, ek modul olarak satilabilecek ozellikler */
  function availableAddons(biz) {
    return Object.keys(FEATURES).filter((k) => {
      const f = FEATURES[k];
      return f.addon && !byId(biz.plan).features.includes(k) && !(biz.addons || []).includes(k);
    });
  }

  RZ.plans = { FEATURES, PLANS, byId, rank, can, gate, limit, overLimit, monthlyBill, availableAddons };
})(window.RZ);
