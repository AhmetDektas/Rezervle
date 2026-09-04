/* Rezervle — rezervasyon motoru
   Cakisma engeli, musaitlik hesabi ve dogrulama burada. Panel ve tuketici tarafi ayni fonksiyonlari cagirir. */
(function (RZ) {
  'use strict';
  const U = RZ.util;

  const ACTIVE = ['pending', 'confirmed', 'arrived', 'completed'];
  const isActive = (r) => ACTIVE.includes(r.status);

  const STATUS = {
    pending:   { label: 'Onay bekliyor', badge: 'badge-warn',   color: 'var(--warn)' },
    confirmed: { label: 'Onaylandı',     badge: 'badge-brand',  color: 'var(--brand)' },
    arrived:   { label: 'Geldi',         badge: 'badge-cyan',   color: 'var(--cyan)' },
    completed: { label: 'Tamamlandı',    badge: 'badge-money',  color: 'var(--money)' },
    no_show:   { label: 'Gelmedi',       badge: 'badge-danger', color: 'var(--danger)' },
    cancelled: { label: 'İptal',         badge: '',             color: 'var(--ink-3)' },
  };

  const CHANNEL = {
    app:      { label: 'Rezervle uygulaması', short: 'Uygulama', icon: 'bolt',  color: 'var(--brand)' },
    phone:    { label: 'Telefon',             short: 'Telefon',  icon: 'phone', color: 'var(--violet)' },
    walkin:   { label: 'Kapıdan',             short: 'Kapıdan',  icon: 'users', color: 'var(--cyan)' },
    whatsapp: { label: 'WhatsApp / DM',       short: 'WhatsApp', icon: 'sms',   color: 'var(--money)' },
  };

  /** Isletmenin o gunku calisma araligi -> [acilis, kapanis] dakika, kapaliysa null */
  function hoursFor(biz, date) {
    const h = biz.hours[date.getDay()];
    return h ? h.slice() : null;
  }

  /** Iki aralik kesisiyor mu (uc uca degme cakisma sayilmaz) */
  const overlap = (aS, aE, bS, bE) => aS < bE && bS < aE;

  /** Ayni kaynagi ayni anda ikinci kez satmayi engelleyen cekirdek kontrol. */
  function conflictsFor(reservations, draft, ignoreId) {
    return reservations.filter(
      (r) =>
        r.id !== ignoreId &&
        r.bizId === draft.bizId &&
        r.date === draft.date &&
        r.resourceId === draft.resourceId &&
        isActive(r) &&
        overlap(draft.start, draft.end, r.start, r.end)
    );
  }

  /** Personel cakismasi — ayni kisi iki yerde olamaz (kaynak farkli olsa bile) */
  function staffConflictsFor(reservations, draft, ignoreId) {
    if (!draft.staffId) return [];
    return reservations.filter(
      (r) =>
        r.id !== ignoreId &&
        r.bizId === draft.bizId &&
        r.date === draft.date &&
        r.staffId === draft.staffId &&
        r.resourceId !== draft.resourceId &&
        isActive(r) &&
        overlap(draft.start, draft.end, r.start, r.end)
    );
  }

  /**
   * Bir rezervasyon taslagini dogrular.
   * Doner: { ok, errors:[{code,msg}], warnings:[...], conflicts:[rez] }
   */
  function validate(ctx, draft, ignoreId) {
    const { biz, reservations, resources } = ctx;
    const errors = [];
    const warnings = [];
    const d = U.fromKey(draft.date);

    if (!draft.resourceId) errors.push({ code: 'resource', msg: 'Kaynak seçilmedi.' });
    if (!(draft.end > draft.start)) errors.push({ code: 'range', msg: 'Bitiş saati başlangıçtan sonra olmalı.' });

    const hrs = hoursFor(biz, d);
    if (!hrs) {
      errors.push({ code: 'closed', msg: `${U.GUN[d.getDay()]} günü işletme kapalı.` });
    } else if (draft.start < hrs[0] || draft.end > hrs[1]) {
      errors.push({
        code: 'hours',
        msg: `Çalışma saatleri dışında. ${U.GUN[d.getDay()]}: ${U.hhmm(hrs[0])}–${U.hhmm(hrs[1])}`,
      });
    }

    const res = resources.find((x) => x.id === draft.resourceId);
    if (res && res.closed) errors.push({ code: 'resClosed', msg: `${res.name} bakımda / kapalı.` });

    const conflicts = conflictsFor(reservations, draft, ignoreId);
    if (conflicts.length) {
      const c = conflicts[0];
      errors.push({
        code: 'conflict',
        msg: `${res ? res.name : 'Bu kaynak'} ${U.hhmm(c.start)}–${U.hhmm(c.end)} arası dolu (${c.customerName || 'rezervasyon'}).`,
      });
    }

    const sc = staffConflictsFor(reservations, draft, ignoreId);
    if (sc.length) {
      warnings.push({
        code: 'staff',
        msg: `Seçilen personelin ${U.hhmm(sc[0].start)}–${U.hhmm(sc[0].end)} arası başka bir randevusu var.`,
      });
    }

    const now = new Date();
    if (U.dayKey(now) === draft.date && draft.end < U.minsOfDay(now)) {
      warnings.push({ code: 'past', msg: 'Bu saat geçmişte kaldı; geçmişe kayıt açıyorsunuz.' });
    }

    return { ok: errors.length === 0, errors, warnings, conflicts };
  }

  /**
   * Belirli gun/kaynak icin bos baslangic saatleri (dakika dizisi).
   * Tuketici tarafinda "canli uygun saatler", panelde "hizli slot secimi" icin kullanilir.
   */
  function freeSlots(ctx, opts) {
    const { biz, reservations, resources } = ctx;
    const date = opts.date;
    const dur = opts.duration || 60;
    const step = opts.step || 30;
    const d = U.fromKey(date);
    const hrs = hoursFor(biz, d);
    if (!hrs) return [];
    const list = opts.resourceId
      ? resources.filter((r) => r.id === opts.resourceId)
      : resources.filter((r) => !r.closed);
    const out = [];
    for (let t = hrs[0]; t + dur <= hrs[1]; t += step) {
      const free = list.filter(
        (r) => !r.closed && conflictsFor(reservations, { bizId: biz.id, date, resourceId: r.id, start: t, end: t + dur }).length === 0
      );
      if (free.length) out.push({ start: t, end: t + dur, resources: free.map((r) => r.id) });
    }
    return out;
  }

  /** Gun icin ilk uygun kaynak — "kapidan gelen musteri" akisini tek tusa indirir */
  function firstFreeResource(ctx, date, start, end) {
    const s = freeSlots(ctx, { date, duration: end - start, step: 15 }).find((x) => x.start === start);
    return s ? s.resources[0] : null;
  }

  /** Doluluk: acik dakikalarin ne kadari satildi */
  function occupancy(ctx, date) {
    const { biz, reservations, resources } = ctx;
    const d = U.fromKey(date);
    const hrs = hoursFor(biz, d);
    const open = resources.filter((r) => !r.closed);
    if (!hrs || !open.length) return { pct: 0, sold: 0, capacity: 0 };
    const capacity = (hrs[1] - hrs[0]) * open.length;
    const sold = reservations
      .filter((r) => r.bizId === biz.id && r.date === date && isActive(r))
      .reduce((t, r) => t + (r.end - r.start), 0);
    return { pct: capacity ? Math.round((sold / capacity) * 100) : 0, sold, capacity };
  }

  /** Bos kalan araliklar — kampanya modulu bunlari hedefler */
  function gaps(ctx, date, minLen) {
    const { biz, reservations, resources } = ctx;
    const d = U.fromKey(date);
    const hrs = hoursFor(biz, d);
    if (!hrs) return [];
    const min = minLen || 60;
    const out = [];
    resources.filter((r) => !r.closed).forEach((res) => {
      const day = reservations
        .filter((r) => r.bizId === biz.id && r.date === date && r.resourceId === res.id && isActive(r))
        .sort((a, b) => a.start - b.start);
      let cur = hrs[0];
      day.forEach((r) => {
        if (r.start - cur >= min) out.push({ resourceId: res.id, start: cur, end: r.start });
        cur = Math.max(cur, r.end);
      });
      if (hrs[1] - cur >= min) out.push({ resourceId: res.id, start: cur, end: hrs[1] });
    });
    return out;
  }

  RZ.schedule = {
    STATUS, CHANNEL, ACTIVE, isActive, overlap, hoursFor,
    conflictsFor, staffConflictsFor, validate, freeSlots, firstFreeResource, occupancy, gaps,
  };
})(window.RZ);
