/* Rezervle — ciro ve isletme analitigi
   Kural: sistemden gecen her rezervasyon kendiliginden ciro kaydidir. Elle giris yok.
   - gerceklesen  : tamamlandi / geldi
   - beklenen     : onaylandi / onay bekliyor (gelecek)
   - kayip        : gelmedi (no-show) -> TL karsiligi ile gosterilir */
(function (RZ) {
  'use strict';
  const U = RZ.util;
  const S = RZ.schedule;

  const REALIZED = ['completed', 'arrived'];
  const EXPECTED = ['confirmed', 'pending'];

  /** Donem araliklari + onceki esdeger donem (karsilastirma icin) */
  function period(kind, ref) {
    const today = U.startOfDay(ref || new Date());
    let from, to, label, prevFrom, prevTo, prevLabel;
    switch (kind) {
      case 'today':
        from = to = today; label = 'Bugün';
        prevFrom = prevTo = U.addDays(today, -1); prevLabel = 'düne göre';
        break;
      case 'yesterday':
        from = to = U.addDays(today, -1); label = 'Dün';
        prevFrom = prevTo = U.addDays(today, -2); prevLabel = 'önceki güne göre';
        break;
      case 'week':
        from = U.startOfWeek(today); to = U.addDays(from, 6); label = 'Bu hafta';
        prevFrom = U.addDays(from, -7); prevTo = U.addDays(from, -1); prevLabel = 'geçen haftaya göre';
        break;
      case 'month':
        from = U.startOfMonth(today); to = U.endOfMonth(today); label = U.dateStr(today, 'monthYear');
        prevFrom = U.startOfMonth(U.addMonths(today, -1)); prevTo = U.endOfMonth(U.addMonths(today, -1));
        prevLabel = 'geçen aya göre';
        break;
      case 'prevMonth': {
        const p = U.addMonths(today, -1);
        from = U.startOfMonth(p); to = U.endOfMonth(p); label = U.dateStr(p, 'monthYear');
        prevFrom = U.startOfMonth(U.addMonths(p, -1)); prevTo = U.endOfMonth(U.addMonths(p, -1));
        prevLabel = 'önceki aya göre';
        break;
      }
      case '90d':
        to = today; from = U.addDays(today, -89); label = 'Son 90 gün';
        prevTo = U.addDays(from, -1); prevFrom = U.addDays(prevTo, -89); prevLabel = 'önceki 90 güne göre';
        break;
      default: // 30d
        to = today; from = U.addDays(today, -29); label = 'Son 30 gün';
        prevTo = U.addDays(from, -1); prevFrom = U.addDays(prevTo, -29); prevLabel = 'önceki 30 güne göre';
    }
    return { kind, from, to, label, prevFrom, prevTo, prevLabel,
             fromKey: U.dayKey(from), toKey: U.dayKey(to) };
  }

  const inRange = (r, fromKey, toKey) => r.date >= fromKey && r.date <= toKey;

  /** Bir donem icin tum ciro kirilimlarini hesaplar. */
  function report(ctx, p) {
    const { biz, reservations, services, resources, staff, customers } = ctx;
    let rows = reservations.filter((r) => r.bizId === biz.id && inRange(r, p.fromKey, p.toKey));
    // Kismi gun kesimi: devam eden bir donemi onceki donemle karsilastirirken
    // onceki donemin son gunu de ayni saatte kesilir (elma-armut karsilastirmasi olmasin).
    if (p.cutoff != null && p.cutoffKey) {
      rows = rows.filter((r) => r.date !== p.cutoffKey || r.start < p.cutoff);
    }

    const realized = rows.filter((r) => REALIZED.includes(r.status));
    const expected = rows.filter((r) => EXPECTED.includes(r.status));
    const noshow = rows.filter((r) => r.status === 'no_show');
    const cancelled = rows.filter((r) => r.status === 'cancelled');

    const gross = U.sum(realized, (r) => r.price);
    const expectedSum = U.sum(expected, (r) => r.price);
    const lost = U.sum(noshow, (r) => r.price);

    /* --- gunluk seri --- */
    const byDay = [];
    for (let d = new Date(p.from); d <= p.to; d = U.addDays(d, 1)) {
      const k = U.dayKey(d);
      const dayRows = rows.filter((r) => r.date === k);
      byDay.push({
        key: k, date: new Date(d),
        total: U.sum(dayRows.filter((r) => REALIZED.includes(r.status)), (r) => r.price),
        expected: U.sum(dayRows.filter((r) => EXPECTED.includes(r.status)), (r) => r.price),
        lost: U.sum(dayRows.filter((r) => r.status === 'no_show'), (r) => r.price),
        count: dayRows.filter((r) => S.isActive(r)).length,
      });
    }

    /* --- kirilimlar --- */
    const dim = (keyFn, nameFn, colorFn) => {
      const m = new Map();
      realized.forEach((r) => {
        const k = keyFn(r);
        if (k == null) return;
        if (!m.has(k)) m.set(k, { key: k, name: nameFn(k), color: colorFn ? colorFn(k) : null, total: 0, count: 0, minutes: 0 });
        const o = m.get(k);
        o.total += r.price; o.count++; o.minutes += r.end - r.start;
      });
      return Array.from(m.values()).sort((a, b) => b.total - a.total);
    };

    const svcName = (id) => (services.find((s) => s.id === id) || {}).name || 'Diğer';
    const resName = (id) => (resources.find((s) => s.id === id) || {}).name || 'Diğer';
    const resColor = (id) => (resources.find((s) => s.id === id) || {}).color || 'var(--brand)';
    const stfName = (id) => (staff.find((s) => s.id === id) || {}).name || 'Atanmadı';

    const byService = dim((r) => r.serviceId, svcName);
    const byResource = dim((r) => r.resourceId, resName, resColor);
    const byStaff = staff.length ? dim((r) => r.staffId, stfName) : [];
    const byChannel = dim(
      (r) => r.channel,
      (k) => (S.CHANNEL[k] || {}).label || k,
      (k) => (S.CHANNEL[k] || {}).color
    );

    /* --- doluluk (acik gunlerin ortalamasi) --- */
    let occSold = 0, occCap = 0, openDays = 0;
    for (let d = new Date(p.from); d <= p.to && d <= new Date(); d = U.addDays(d, 1)) {
      const o = S.occupancy(ctx, U.dayKey(d));
      if (o.capacity) { occSold += o.sold; occCap += o.capacity; openDays++; }
    }

    /* --- kapora --- */
    const withDep = rows.filter((r) => r.deposit && r.deposit.amount);
    const depHeld = U.sum(withDep.filter((r) => r.deposit.status === 'held'), (r) => r.deposit.amount);
    const depCharged = U.sum(withDep.filter((r) => r.deposit.status === 'charged'), (r) => r.deposit.amount);

    /* --- musteri --- */
    const custIds = new Set(realized.map((r) => r.customerId).filter(Boolean));
    // "Yeni musteri" = ilk gerceklesen ziyareti bu doneme dusen musteri.
    // Musteri kaydinda ilk-ziyaret alani tutulmaz; rezervasyon gecmisinden hesaplanir.
    const firstSeen = new Map();
    reservations.forEach((r) => {
      if (r.bizId !== biz.id || !r.customerId || !REALIZED.includes(r.status)) return;
      const cur = firstSeen.get(r.customerId);
      if (!cur || r.date < cur) firstSeen.set(r.customerId, r.date);
    });
    let newCust = 0;
    firstSeen.forEach((d) => { if (d >= p.fromKey && d <= p.toKey) newCust++; });

    const activeCount = realized.length + expected.length;
    return {
      period: p,
      rows, realized, expected, noshow, cancelled,
      gross, expectedSum, lost,
      count: realized.length,
      activeCount,
      avgTicket: realized.length ? gross / realized.length : 0,
      noShowRate: activeCount + noshow.length ? (noshow.length / (activeCount + noshow.length)) * 100 : 0,
      cancelRate: rows.length ? (cancelled.length / rows.length) * 100 : 0,
      byDay, byService, byResource, byStaff, byChannel,
      occupancy: occCap ? Math.round((occSold / occCap) * 100) : 0,
      occSold, occCap, openDays,
      deposit: { held: depHeld, charged: depCharged, count: withDep.length },
      customers: { active: custIds.size, new: newCust },
    };
  }

  /** Onceki donemle karsilastirmali ozet (KPI kartlari icin) */
  function compare(ctx, p) {
    const cur = report(ctx, p);
    // Devam eden donem (bugun/bu hafta/bu ay) yarim; onceki donemi ayni noktadan kes.
    const today = U.startOfDay(new Date());
    const inProgress = p.to >= today;
    let prevTo = p.prevTo, cutoff = null;
    if (inProgress) {
      const elapsed = Math.max(0, U.diffDays(today, p.from));
      const cut = U.addDays(p.prevFrom, elapsed);
      prevTo = cut < p.prevTo ? cut : p.prevTo;
      cutoff = U.minsOfDay(new Date());
    }
    const prevP = Object.assign({}, p, {
      from: p.prevFrom, to: prevTo,
      fromKey: U.dayKey(p.prevFrom), toKey: U.dayKey(prevTo),
      cutoff, cutoffKey: cutoff != null ? U.dayKey(prevTo) : null,
    });
    const prev = report(ctx, prevP);
    const delta = (a, b) => (b ? ((a - b) / b) * 100 : a ? 100 : 0);
    return {
      cur, prev,
      d: {
        gross: delta(cur.gross, prev.gross),
        count: delta(cur.count, prev.count),
        avgTicket: delta(cur.avgTicket, prev.avgTicket),
        occupancy: cur.occupancy - prev.occupancy,
        noShow: cur.noShowRate - prev.noShowRate,
        lost: delta(cur.lost, prev.lost),
      },
    };
  }

  /** Musteri segmentleri — "en degerli" ve "kaybolan" listeleri */
  function customerInsights(ctx, opts) {
    const { biz, customers, reservations } = ctx;
    const o = opts || {};
    const lostAfter = o.lostAfter || 60;
    const todayKey = U.dayKey(new Date());
    const list = customers.filter((c) => c.bizId === biz.id).map((c) => {
      const rs = reservations.filter((r) => r.customerId === c.id && r.bizId === biz.id);
      const done = rs.filter((r) => REALIZED.includes(r.status));
      const spend = U.sum(done, (r) => r.price);
      const last = done.map((r) => r.date).sort().pop() || null;
      const first = done.map((r) => r.date).sort()[0] || null;
      const ns = rs.filter((r) => r.status === 'no_show').length;
      const daysSince = last ? U.diffDays(U.fromKey(todayKey), U.fromKey(last)) : null;
      const months = first ? Math.max(1, U.diffDays(U.fromKey(todayKey), U.fromKey(first)) / 30) : 1;
      return Object.assign({}, c, {
        visits: done.length, spend, lastVisit: last, firstVisit: first,
        noShows: ns, daysSince,
        freq: done.length / months,
        avg: done.length ? spend / done.length : 0,
        risk: daysSince != null && daysSince > lostAfter && done.length >= 2,
      });
    });
    return {
      all: list,
      top: list.slice().sort((a, b) => b.spend - a.spend).slice(0, o.top || 8),
      lost: list.filter((c) => c.risk).sort((a, b) => b.spend - a.spend),
      // Riskli = hem mutlak hem oransal olarak fazla gelmeyen. Sadece "2 kez gelmedi"
      // demek uzun gecmisi olan her musteriyi isaretler ve rozet anlamini yitirir.
      risky: list
        .filter((c) => c.noShows >= 3 && c.visits + c.noShows >= 5 && c.noShows / (c.visits + c.noShows) >= 0.2)
        .sort((a, b) => b.noShows - a.noShows),
      totalValue: U.sum(list, (c) => c.spend),
    };
  }

  /** Saat bazli yogunluk isi haritasi (7 gun x saat) */
  function heatmap(ctx, p) {
    const { biz, reservations } = ctx;
    const rows = reservations.filter(
      (r) => r.bizId === biz.id && S.isActive(r) && inRange(r, p.fromKey, p.toKey)
    );
    const grid = {};
    let max = 0;
    rows.forEach((r) => {
      const d = U.fromKey(r.date);
      const wd = (d.getDay() + 6) % 7;
      const h = Math.floor(r.start / 60);
      const k = wd + ':' + h;
      grid[k] = (grid[k] || 0) + 1;
      if (grid[k] > max) max = grid[k];
    });
    return { grid, max };
  }

  RZ.analytics = { period, report, compare, customerInsights, heatmap, REALIZED, EXPECTED };
})(window.RZ);
