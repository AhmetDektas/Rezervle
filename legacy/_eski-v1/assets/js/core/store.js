/* Rezervle — durum yonetimi
   Tek merkezi state + yayin/abone. Tum yazma islemleri buradan gecer; dogrulama motoru
   (RZ.schedule) burada devreye girer, boylece cakisan bir kayit hicbir yoldan iceri giremez. */
(function (RZ) {
  'use strict';
  const U = RZ.util;
  const S = RZ.schedule;
  const KEY = 'rezervle.state.v1';

  let state = null;
  const subs = new Set();

  function emit(reason) {
    save();
    subs.forEach((fn) => {
      try { fn(state, reason); } catch (e) { console.error(e); }
    });
  }
  const on = (fn) => { subs.add(fn); return () => subs.delete(fn); };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* gizli sekme vb. */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 && Array.isArray(s.businesses) && s.businesses.length ? s : null;
    } catch (e) { return null; }
  }

  function init() {
    state = load() || RZ.seed.build();
    return state;
  }
  function reset() {
    state = RZ.seed.build();
    emit('reset');
    return state;
  }

  const get = () => state;
  const biz = () => state.businesses.find((b) => b.id === state.activeBizId) || state.businesses[0];

  /** Aktif isletmeye gore filtrelenmis calisma baglami */
  function ctx() {
    const b = biz();
    return {
      biz: b,
      resources: state.resources.filter((r) => r.bizId === b.id),
      services: state.services.filter((r) => r.bizId === b.id),
      staff: state.staff.filter((r) => r.bizId === b.id),
      customers: state.customers.filter((r) => r.bizId === b.id),
      reservations: state.reservations.filter((r) => r.bizId === b.id),
      soldPackages: state.soldPackages.filter((r) => r.bizId === b.id),
      campaigns: state.campaigns.filter((r) => r.bizId === b.id),
    };
  }

  const find = (coll, id) => state[coll].find((x) => x.id === id);

  function log(type, text, meta) {
    state.activity.unshift({
      id: U.uid('log'), bizId: biz().id, type, text,
      at: new Date().toISOString(), meta: meta || null,
    });
    state.activity = state.activity.slice(0, 200);
  }

  /* ---------------- Isletme / paket ---------------- */
  function setBiz(id) { state.activeBizId = id; emit('biz'); }

  function setPlan(planId) {
    const b = biz();
    b.plan = planId;
    // Pakete dahil olan ek modullerin ayrica faturalanmamasi icin temizle
    const inc = RZ.plans.byId(planId).features;
    b.addons = (b.addons || []).filter((a) => !inc.includes(a));
    log('plan', `Paket ${RZ.plans.byId(planId).name} olarak güncellendi`);
    emit('plan');
  }

  function toggleAddon(key) {
    const b = biz();
    b.addons = b.addons || [];
    const i = b.addons.indexOf(key);
    if (i >= 0) b.addons.splice(i, 1);
    else b.addons.push(key);
    log('addon', `${RZ.plans.FEATURES[key].name} modülü ${i >= 0 ? 'kapatıldı' : 'etkinleştirildi'}`);
    emit('addon');
    return b.addons.includes(key);
  }

  function updateBiz(patch) { Object.assign(biz(), patch); emit('biz'); }

  /* ---------------- Musteri ---------------- */
  function upsertCustomer(data) {
    if (data.id) {
      const c = find('customers', data.id);
      Object.assign(c, data);
      emit('customer');
      return c;
    }
    const phone = String(data.phone || '').replace(/\D/g, '');
    const existing = state.customers.find(
      (c) => c.bizId === biz().id && String(c.phone).replace(/\D/g, '') === phone && phone.length >= 10
    );
    if (existing) return existing;
    const c = {
      id: U.uid('cus'), bizId: biz().id, name: data.name, phone: data.phone,
      note: data.note || '', tags: data.tags || [], createdAt: U.dayKey(new Date()),
    };
    state.customers.push(c);
    log('customer', `Yeni müşteri: ${c.name}`);
    emit('customer');
    return c;
  }

  /* ---------------- Rezervasyon ---------------- */
  function decorate(r) {
    const c = state.customers.find((x) => x.id === r.customerId);
    return Object.assign({}, r, { customerName: c ? c.name : r.guestName || 'Misafir' });
  }

  /**
   * Yeni rezervasyon. Cakisma varsa YAZMAZ; { ok:false, errors } doner.
   */
  function addReservation(draft) {
    const b = biz();
    const c = ctx();
    const svc = c.services.find((s) => s.id === draft.serviceId);
    const rec = {
      id: U.uid('rez'), bizId: b.id,
      customerId: draft.customerId || null,
      guestName: draft.guestName || null,
      serviceId: draft.serviceId,
      resourceId: draft.resourceId,
      staffId: draft.staffId || null,
      date: draft.date,
      start: draft.start,
      end: draft.end != null ? draft.end : draft.start + ((svc && svc.duration) || 60),
      status: draft.status || 'confirmed',
      channel: draft.channel || 'phone',
      price: draft.price != null ? draft.price : (svc ? svc.price : 0),
      deposit: draft.deposit || null,
      note: draft.note || '',
      createdAt: new Date().toISOString(),
      packageId: draft.packageId || null,
    };
    const v = S.validate(
      { biz: b, reservations: c.reservations.map(decorate), resources: c.resources },
      rec
    );
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };

    // Kapora gerekiyorsa ve modul acikSa guvence kaydi olustur
    if (!rec.deposit && svc && svc.deposit && RZ.plans.can(b, 'deposit')) {
      rec.deposit = { amount: svc.deposit, status: 'held', method: 'card' };
    }
    // Paket bakiyesi varsa dus
    if (rec.packageId) consumeCredit(rec.packageId, rec.id);

    state.reservations.push(rec);
    const cus = state.customers.find((x) => x.id === rec.customerId);
    log('booking', `${cus ? cus.name : rec.guestName || 'Misafir'} · ${U.dateStr(U.fromKey(rec.date), 'md')} ${U.hhmm(rec.start)}`, { id: rec.id });
    emit('reservation');
    return { ok: true, reservation: rec, warnings: v.warnings };
  }

  /** Saat/kaynak degisikligi — takvimde surukle-birak bunu cagirir */
  function moveReservation(id, patch) {
    const r = find('reservations', id);
    if (!r) return { ok: false, errors: [{ msg: 'Kayıt bulunamadı.' }] };
    const c = ctx();
    const next = Object.assign({}, r, patch);
    if (patch.start != null && patch.end == null) next.end = patch.start + (r.end - r.start);
    const v = S.validate(
      { biz: biz(), reservations: c.reservations.map(decorate), resources: c.resources },
      next, id
    );
    if (!v.ok) return { ok: false, errors: v.errors };
    Object.assign(r, next);
    emit('reservation');
    return { ok: true, reservation: r, warnings: v.warnings };
  }

  function updateReservation(id, patch) {
    if (patch.start != null || patch.resourceId != null || patch.date != null || patch.end != null) {
      return moveReservation(id, patch);
    }
    const r = find('reservations', id);
    Object.assign(r, patch);
    emit('reservation');
    return { ok: true, reservation: r };
  }

  function setStatus(id, status) {
    const r = find('reservations', id);
    if (!r) return;
    r.status = status;
    if (status === 'arrived' && !r.checkinAt) r.checkinAt = new Date().toISOString();
    if (status === 'no_show' && r.deposit && r.deposit.status === 'held') r.deposit.status = 'chargeable';
    if (status === 'completed' && r.deposit && r.deposit.status === 'held') r.deposit.status = 'released';
    log('status', `Rezervasyon durumu: ${S.STATUS[status].label}`, { id });
    emit('reservation');
  }

  function removeReservation(id) {
    state.reservations = state.reservations.filter((r) => r.id !== id);
    emit('reservation');
  }

  /* ---------------- Kapora ---------------- */
  function chargeDeposit(id) {
    const r = find('reservations', id);
    if (!r || !r.deposit) return;
    r.deposit.status = 'charged';
    r.deposit.chargedAt = new Date().toISOString();
    log('deposit', `Kapora tahsil edildi: ${U.tl(r.deposit.amount)}`, { id });
    emit('deposit');
  }
  function releaseDeposit(id) {
    const r = find('reservations', id);
    if (!r || !r.deposit) return;
    r.deposit.status = 'released';
    log('deposit', 'Kapora serbest bırakıldı', { id });
    emit('deposit');
  }

  /* ---------------- Paket & kredi ---------------- */
  function sellPackage(customerId, defId) {
    const b = biz();
    const def = (b.packageDefs || []).find((p) => p.id === defId);
    if (!def) return null;
    const p = {
      id: U.uid('pkg'), bizId: b.id, customerId, defId,
      name: def.name, credits: def.credits, used: 0, price: def.price,
      soldAt: U.dayKey(new Date()),
      expiresAt: U.dayKey(U.addDays(new Date(), def.validDays || 180)),
    };
    state.soldPackages.push(p);
    const c = state.customers.find((x) => x.id === customerId);
    log('package', `${c ? c.name : ''} · ${def.name} satıldı (${U.tl(def.price)})`);
    emit('package');
    return p;
  }
  function consumeCredit(pkgId, rezId) {
    const p = find('soldPackages', pkgId);
    if (!p || p.used >= p.credits) return false;
    p.used++;
    p.lastUse = { at: U.dayKey(new Date()), rezId };
    return true;
  }

  /* ---------------- Kampanya ---------------- */
  function createCampaign(data) {
    const c = {
      id: U.uid('cmp'), bizId: biz().id, status: 'sent',
      createdAt: new Date().toISOString(), redeemed: 0,
      ...data,
    };
    state.campaigns.push(c);
    log('campaign', `Kampanya gönderildi: ${c.title} · ${c.audience} kişi`);
    biz().smsUsed = (biz().smsUsed || 0) + (c.audience || 0);
    emit('campaign');
    return c;
  }

  /* ---------------- Kaynak / hizmet ---------------- */
  function addResource(data) {
    const b = biz();
    const count = state.resources.filter((r) => r.bizId === b.id).length;
    if (RZ.plans.overLimit(b, 'resources', count)) {
      return { ok: false, error: `${RZ.plans.byId(b.plan).name} paketinde en fazla ${RZ.plans.limit(b, 'resources')} kaynak tanımlanabilir.` };
    }
    const r = { id: U.uid('res'), bizId: b.id, closed: false, ...data };
    state.resources.push(r);
    emit('resource');
    return { ok: true, resource: r };
  }
  function updateResource(id, patch) { Object.assign(find('resources', id), patch); emit('resource'); }
  function removeResource(id) {
    state.resources = state.resources.filter((r) => r.id !== id);
    emit('resource');
  }
  function upsertService(data) {
    if (data.id) { Object.assign(find('services', data.id), data); }
    else state.services.push({ id: U.uid('svc'), bizId: biz().id, ...data });
    emit('service');
  }
  function removeService(id) {
    state.services = state.services.filter((s) => s.id !== id);
    emit('service');
  }

  RZ.store = {
    init, reset, get, biz, ctx, on, emit, find, log,
    setBiz, setPlan, toggleAddon, updateBiz,
    upsertCustomer,
    addReservation, moveReservation, updateReservation, setStatus, removeReservation, decorate,
    chargeDeposit, releaseDeposit,
    sellPackage, consumeCredit,
    createCampaign,
    addResource, updateResource, removeResource, upsertService, removeService,
  };
})(window.RZ);
