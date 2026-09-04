/* Rezervle — Panel > Takvim
   Kaynak bazli gun gorunumu + hafta gorunumu. Surukle-birak ile tasima yapilir;
   birakma anindan once cakisma motoru calisir, cakisan birakma islemi geri alinir. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  const SLOT_H = 56;   // 1 saat = 56px
  const SNAP = 15;     // dakika

  const nav = { date: U.dayKey(new Date()), mode: 'day' };

  RZ.views.calendar = function (root, params) {
    if (params && params.d) nav.date = params.d;
    const c = RZ.store.ctx();
    const biz = c.biz;
    const day = U.fromKey(nav.date);

    /* ---------------- Araç çubuğu ---------------- */
    const label = nav.mode === 'day'
      ? U.dateStr(day, 'long')
      : `${U.dateStr(U.startOfWeek(day), 'md')} – ${U.dateStr(U.addDays(U.startOfWeek(day), 6), 'md')} ${day.getFullYear()}`;

    const shift = (n) => {
      nav.date = U.dayKey(U.addDays(U.fromKey(nav.date), nav.mode === 'day' ? n : n * 7));
      RZ.app.rerender();
    };

    root.appendChild(el('div.cal-toolbar',
      el('div.row', { style: { gap: '4px' } },
        el('button.icon-btn', { html: U.icon('chevL', 18), onclick: () => shift(-1), title: 'Önceki' }),
        el('button.btn.btn-ghost.btn-sm', { onclick: () => { nav.date = U.dayKey(new Date()); RZ.app.rerender(); } }, 'Bugün'),
        el('button.icon-btn', { html: U.icon('chevR', 18), onclick: () => shift(1), title: 'Sonraki' })
      ),
      el('div', { style: { fontWeight: '640', fontSize: '15.5px', minWidth: '210px' } }, label),
      el('div.seg',
        el('button' + (nav.mode === 'day' ? '.on' : ''), { onclick: () => { nav.mode = 'day'; RZ.app.rerender(); } }, 'Gün'),
        el('button' + (nav.mode === 'week' ? '.on' : ''), { onclick: () => { nav.mode = 'week'; RZ.app.rerender(); } }, 'Hafta')
      ),
      el('div.grow'),
      el('div.hint.row', { style: { gap: '6px' } },
        el('span', { html: U.icon('bolt', 14) }),
        'Sürükleyip bırakarak taşıyın · boş alana tıklayıp kayıt açın'),
      el('button.btn.btn-primary.btn-sm', { onclick: () => RZ.booking.openBooking({ date: nav.date }) },
        el('span', { html: U.icon('plus', 15) }), 'Yeni rezervasyon')
    ));

    root.appendChild(nav.mode === 'day' ? dayView(c, biz, nav.date) : weekView(c, biz, day));

    /* Gunun ozeti */
    const occ = S.occupancy(c, nav.date);
    const rows = c.reservations.filter((r) => r.date === nav.date && S.isActive(r));
    if (nav.mode === 'day') {
      root.appendChild(el('div.row.wrap', { style: { gap: '10px', marginTop: '13px' } },
        el('span.badge', `${rows.length} rezervasyon`),
        el('span.badge.badge-money', tl(U.sum(rows, (r) => r.price)) + ' planlanan ciro'),
        el('span.badge' + (occ.pct > 70 ? '.badge-money' : occ.pct > 40 ? '' : '.badge-warn'), `%${occ.pct} doluluk`),
        el('span.hint', `Çalışma saatleri ${U.hhmm(biz.hours[day.getDay()] ? biz.hours[day.getDay()][0] : 0)}–${U.hhmm(biz.hours[day.getDay()] ? biz.hours[day.getDay()][1] : 0)}`)
      ));
    }
  };

  /* ---------------- Gün görünümü ---------------- */
  function dayView(c, biz, dateKey) {
    const day = U.fromKey(dateKey);
    const hrs = S.hoursFor(biz, day);
    if (!hrs) {
      return el('div.card', RZ.ui.emptyState(
        `${U.GUN[day.getDay()]} günü işletme kapalı`,
        'Çalışma saatlerini Ayarlar > Çalışma saatleri bölümünden değiştirebilirsiniz.', 'calendar'));
    }
    const [open, close] = hrs;
    const hours = Math.ceil((close - open) / 60);
    const cols = c.resources;
    if (!cols.length) {
      return el('div.card', RZ.ui.emptyState(
        'Henüz kaynak tanımlanmadı',
        'Takvim kolonları kaynaklarınızdan oluşur: saha, kort, koltuk, kabin ya da masa. En az bir tane tanımlayın, takvim hemen çalışmaya başlasın.',
        'grid',
        { label: 'Kaynak tanımla', icon: 'plus', onClick: () => (location.hash = '#/panel/ayarlar') }));
    }
    const gridCols = `64px repeat(${cols.length}, minmax(160px,1fr))`;

    const head = el('div.cal-head', { style: { gridTemplateColumns: gridCols } },
      el('div.hcell.corner'),
      cols.map((r) =>
        el('div.hcell',
          el('div.row', { style: { gap: '7px' } },
            el('i', { style: { width: '9px', height: '9px', borderRadius: '3px', background: r.color, display: 'block' } }),
            r.name),
          el('div.sub', r.type + (r.closed ? ' · kapalı' : ''))
        )
      )
    );

    const times = el('div.cal-times');
    for (let h = 0; h < hours; h++) times.appendChild(el('div.cal-time', U.hhmm(open + h * 60)));

    const body = el('div.cal-body', { style: { gridTemplateColumns: gridCols } }, times);
    const colEls = [];

    cols.forEach((res) => {
      const col = el('div.cal-col');
      col.dataset.resourceId = res.id;
      for (let h = 0; h < hours; h++) {
        const slot = el('div.cal-slot');
        const startM = open + h * 60;
        slot.addEventListener('click', (e) => {
          if (e.target !== slot) return;
          const rect = slot.getBoundingClientRect();
          const half = e.clientY - rect.top > rect.height / 2 ? 30 : 0;
          RZ.booking.openBooking({ date: dateKey, start: startM + half, resourceId: res.id });
        });
        col.appendChild(slot);
      }
      c.reservations
        .filter((r) => r.date === dateKey && r.resourceId === res.id && r.status !== 'cancelled')
        .forEach((r) => col.appendChild(eventEl(c, r, open, 0, 1)));
      colEls.push(col);
      body.appendChild(col);
    });

    // Simdi cizgisi — her kolona ayri cizilir (grid duzenini bozmamak icin)
    if (dateKey === U.dayKey(new Date())) {
      const nowM = U.minsOfDay(new Date());
      if (nowM >= open && nowM <= close) {
        colEls.forEach((cE) => cE.appendChild(el('div.now-line', { style: { top: ((nowM - open) / 60) * SLOT_H + 'px' } })));
      }
    }

    const wrap = el('div.cal', el('div.cal-scroll', el('div.cal-grid', head, body)));
    enableDrag(wrap, { mode: 'day', open, close, dateKey, colEls, c });
    return wrap;
  }

  /* ---------------- Hafta görünümü ---------------- */
  function weekView(c, biz, ref) {
    const start = U.startOfWeek(ref);
    const days = Array.from({ length: 7 }, (_, i) => U.addDays(start, i));
    let open = 1440, close = 0;
    days.forEach((d) => {
      const h = S.hoursFor(biz, d);
      if (h) { open = Math.min(open, h[0]); close = Math.max(close, h[1]); }
    });
    if (close <= open) { open = 540; close = 1200; }
    const hours = Math.ceil((close - open) / 60);
    const gridCols = `64px repeat(7, minmax(122px,1fr))`;
    const todayKey = U.dayKey(new Date());

    const head = el('div.cal-head', { style: { gridTemplateColumns: gridCols } },
      el('div.hcell.corner'),
      days.map((d) => {
        const k = U.dayKey(d);
        const tot = U.sum(c.reservations.filter((r) => r.date === k && S.isActive(r)), (r) => r.price);
        return el('div.hcell', { style: k === todayKey ? { background: 'var(--brand-soft)' } : null },
          el('div', U.GUN_K[d.getDay()] + ' ' + d.getDate()),
          el('div.sub', tot ? tl(tot, { compact: true }) : '—')
        );
      })
    );

    const times = el('div.cal-times');
    for (let h = 0; h < hours; h++) times.appendChild(el('div.cal-time', U.hhmm(open + h * 60)));

    const body = el('div.cal-body', { style: { gridTemplateColumns: gridCols } }, times);
    const colEls = [];
    days.forEach((d) => {
      const k = U.dayKey(d);
      const col = el('div.cal-col');
      col.dataset.dateKey = k;
      const dayHrs = S.hoursFor(biz, d);
      for (let h = 0; h < hours; h++) {
        const startM = open + h * 60;
        const closed = !dayHrs || startM < dayHrs[0] || startM >= dayHrs[1];
        const slot = el('div.cal-slot', { style: closed ? { background: 'var(--surface-3)', opacity: '.55' } : null });
        if (!closed) {
          slot.addEventListener('click', (e) => {
            if (e.target !== slot) return;
            const rect = slot.getBoundingClientRect();
            const half = e.clientY - rect.top > rect.height / 2 ? 30 : 0;
            RZ.booking.openBooking({ date: k, start: startM + half });
          });
        }
        col.appendChild(slot);
      }
      // Ayni gunde cakisan kayitlar yan yana dizilir
      const rows = c.reservations.filter((r) => r.date === k && r.status !== 'cancelled').sort((a, b) => a.start - b.start);
      const lanes = [];
      rows.forEach((r) => {
        let idx = lanes.findIndex((L) => L <= r.start);
        if (idx < 0) { lanes.push(r.end); idx = lanes.length - 1; } else lanes[idx] = r.end;
        r.__lane = idx;
      });
      const laneCount = Math.max(1, lanes.length);
      rows.forEach((r) => col.appendChild(eventEl(c, r, open, r.__lane, laneCount, true)));
      colEls.push(col);
      body.appendChild(col);
    });

    const wrap = el('div.cal', el('div.cal-scroll', el('div.cal-grid', head, body)));
    enableDrag(wrap, { mode: 'week', open, close, colEls, c });
    return wrap;
  }

  /* ---------------- Etkinlik kutusu ---------------- */
  function eventEl(c, r, open, lane, laneCount, compact) {
    const svc = c.services.find((s) => s.id === r.serviceId) || {};
    const res = c.resources.find((s) => s.id === r.resourceId) || {};
    const cus = c.customers.find((s) => s.id === r.customerId);
    const st = S.STATUS[r.status];
    const top = ((r.start - open) / 60) * SLOT_H;
    const h = Math.max(22, ((r.end - r.start) / 60) * SLOT_H - 3);
    const wPct = 100 / laneCount;

    const label = `${U.hhmm(r.start)}–${U.hhmm(r.end)}, ${cus ? cus.name : r.guestName || 'Misafir'}, ` +
      `${svc.name}, ${res.name}, ${tl(r.price)}, ${st.label}`;
    const node = el('div.ev.st-' + r.status, {
      style: {
        top: top + 2 + 'px', height: h + 'px',
        left: `calc(${lane * wPct}% + 4px)`,
        width: `calc(${wPct}% - 8px)`,
        borderLeftColor: res.color || 'var(--brand)',
        background: r.status === 'no_show' ? 'var(--danger-soft)' : 'var(--surface)',
      },
      data: { rezId: r.id },
      title: `${U.hhmm(r.start)}–${U.hhmm(r.end)} · ${svc.name} · ${tl(r.price)}`,
      // Klavye yolu: surukle-birak yalnizca fareyle calisir; Enter detay
      // cekmecesini acar, oradan "Duzenle / tasi" ile saat degistirilebilir.
      tabindex: '0',
      role: 'button',
      'aria-label': label,
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); RZ.booking.openDetail(r.id); }
      },
    },
      el('span.t', `${U.hhmm(r.start)} ${cus ? cus.name : r.guestName || 'Misafir'}`),
      h > 34 ? el('span.s', compact ? `${res.name} · ${tl(r.price, { compact: true })}` : `${svc.name} · ${tl(r.price)}`) : null,
      r.deposit && r.deposit.amount
        ? el('span.pin', { style: { color: 'var(--violet)' }, html: U.icon('shield', 11) })
        : r.status === 'pending' ? el('span.pin', { style: { color: 'var(--warn)' }, html: U.icon('clock', 11) }) : null
    );
    node.style.setProperty('--st', st.color);
    return node;
  }

  /* ---------------- Sürükle-bırak ---------------- */
  function enableDrag(wrap, cfg) {
    let drag = null;

    wrap.addEventListener('pointerdown', (e) => {
      const ev = e.target.closest('.ev');
      if (!ev || e.button !== 0) return;
      const id = ev.dataset.rezId;
      const rez = RZ.store.get().reservations.find((r) => r.id === id);
      if (!rez) return;
      drag = {
        id, rez, ev, startX: e.clientX, startY: e.clientY, moved: false,
        origTop: parseFloat(ev.style.top), dur: rez.end - rez.start,
        ghost: null, target: null,
      };
      ev.setPointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      const dx = e.clientX - drag.startX;
      if (!drag.moved && Math.abs(dy) < 4 && Math.abs(dx) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        drag.ev.classList.add('dragging');
        drag.ghost = el('div.ghost');
        wrap.querySelector('.cal-body').appendChild(drag.ghost);
      }
      // Hedef kolon
      let col = null;
      cfg.colEls.forEach((cE) => {
        const b = cE.getBoundingClientRect();
        if (e.clientX >= b.left && e.clientX <= b.right) col = cE;
      });
      col = col || drag.ev.parentElement;

      // Yeni baslangic
      const deltaMin = Math.round((dy / SLOT_H) * 60 / SNAP) * SNAP;
      let newStart = U.clamp(drag.rez.start + deltaMin, cfg.open, cfg.close - drag.dur);

      const patch = cfg.mode === 'day'
        ? { resourceId: col.dataset.resourceId, start: newStart, end: newStart + drag.dur }
        : { date: col.dataset.dateKey, start: newStart, end: newStart + drag.dur };

      const next = Object.assign({}, drag.rez, patch);
      const v = S.validate(
        { biz: cfg.c.biz, reservations: cfg.c.reservations.map(RZ.store.decorate), resources: cfg.c.resources },
        next, drag.id
      );
      drag.target = { patch, ok: v.ok, msg: v.ok ? '' : v.errors[0].msg };

      // Hayalet konumu
      const colBox = col.getBoundingClientRect();
      const bodyBox = wrap.querySelector('.cal-body').getBoundingClientRect();
      Object.assign(drag.ghost.style, {
        top: ((newStart - cfg.open) / 60) * SLOT_H + 2 + 'px',
        height: (drag.dur / 60) * SLOT_H - 3 + 'px',
        left: colBox.left - bodyBox.left + 4 + 'px',
        right: 'auto',
        width: colBox.width - 8 + 'px',
      });
      drag.ghost.classList.toggle('bad', !v.ok);
      drag.ghost.textContent = v.ok
        ? `${U.hhmm(newStart)} – ${U.hhmm(newStart + drag.dur)}`
        : 'Dolu · bırakılamaz';
    });

    function finish(e) {
      if (!drag) return;
      const d = drag;
      drag = null;
      d.ev.classList.remove('dragging');
      if (d.ghost) d.ghost.remove();
      if (!d.moved) { RZ.booking.openDetail(d.id); return; }
      if (!d.target || !d.target.ok) {
        d.ev.classList.add('conflict');
        setTimeout(() => d.ev.classList.remove('conflict'), 400);
        RZ.ui.toast(d.target ? d.target.msg : 'Taşınamadı.', 'err');
        RZ.app.rerender();
        return;
      }
      const r = RZ.store.moveReservation(d.id, d.target.patch);
      if (!r.ok) { RZ.ui.toast(r.errors[0].msg, 'err'); RZ.app.rerender(); return; }
      RZ.ui.toast(`Taşındı · <b>${U.hhmm(d.target.patch.start)}</b>` +
        (d.target.patch.date ? ' · ' + U.dateStr(U.fromKey(d.target.patch.date), 'md') : ''), 'ok');
    }
    wrap.addEventListener('pointerup', finish);
    wrap.addEventListener('pointercancel', finish);
  }
})(window.RZ);
