/* Rezervle — Panel > Müşteri uygulaması önizlemesi
   Sistemin ikinci yarisi. Cok ekranli gercek bir tuketici akisi: kesfet -> mekan ->
   saat -> onay -> rezervasyonlarim. Buradan yapilan kayit gercektir: ayni cakisma
   motorundan gecer, kapora kuralina uyar ve aninda isletme paneline duser. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  const flow = {
    screen: 'discover',   // discover | venue | book | done | mine
    cat: 'all',
    bizId: null,
    serviceId: null,
    dateOffset: 0,
    start: null,
    resourceId: null,
    name: '',
    phone: '',
    doneId: null,
  };

  /* Kategori seridi — yalnizca saha arastirmasinin kapsadigi dikeyler.
     Regulasyonlu kategoriler (dis, veteriner) ilk 18 ay bilincli olarak kapsam disidir. */
  const CATS = [
    { id: 'all', label: 'Tümü', icon: 'grid' },
    { id: 'Halı saha & tenis kortu', label: 'Halı saha', icon: 'bolt' },
    { id: 'Güzellik salonu', label: 'Güzellik', icon: 'sparkle' },
    { id: 'Kuaför', label: 'Kuaför', icon: 'users' },
  ];

  /* Kapak: mekanin kendi cizgisi (saha cizgileri, ayna, tarak) — gradyan degil */
  const coverArt = (b, h) => U.venueArt(b.category, { height: h || 82 });

  /** Bugun icin musaitlik: kac kaynak, kac saat bos */
  function availability(st, b) {
    const res = st.resources.filter((r) => r.bizId === b.id && !r.closed);
    const svcs = st.services.filter((s) => s.bizId === b.id);
    if (!res.length || !svcs.length) return null;
    const ctx = {
      biz: b, resources: res, services: svcs,
      reservations: st.reservations.filter((r) => r.bizId === b.id),
    };
    const key = U.dayKey(U.addDays(new Date(), flow.dateOffset));
    const dur = Math.min.apply(null, svcs.map((s) => s.duration));
    const slots = S.freeSlots(ctx, { date: key, duration: dur, step: 60 });
    const total = res.length;
    const free = slots.length ? Math.max.apply(null, slots.map((s) => s.resources.length)) : 0;
    const ratio = total ? free / total : 0;
    return {
      free, total, slots: slots.length,
      level: slots.length === 0 ? 'low' : ratio > 0.5 ? 'high' : ratio > 0.2 ? 'mid' : 'low',
      unit: res[0].type === 'Halı saha' ? 'saha' : res[0].type === 'Kort' ? 'kort' : 'koltuk',
    };
  }

  const listedBusinesses = (st) =>
    st.businesses.filter(
      (b) => st.resources.some((r) => r.bizId === b.id) && st.services.some((s) => s.bizId === b.id)
    );

  /* ------------------------------------------------------------------ */
  RZ.views.consumer = function (root) {
    const st = RZ.store.get();
    const listed = listedBusinesses(st);

    if (!listed.length) {
      root.appendChild(el('div.card', RZ.ui.emptyState(
        'Uygulamada listelenen işletme yok',
        'Bir işletmenin uygulamada görünmesi için en az bir kaynak ve bir hizmet tanımlı olmalı — müşteriye gösterilecek uygun saat ancak böyle hesaplanır.',
        'bolt',
        { label: 'Kurulumu tamamla', icon: 'cog', onClick: () => (location.hash = '#/panel/ayarlar') })));
      return;
    }
    if (!flow.bizId || !listed.find((b) => b.id === flow.bizId)) flow.bizId = listed[0].id;

    const screen = el('div.phone-screen');
    const biz = st.businesses.find((b) => b.id === flow.bizId);

    const go = (s) => { flow.screen = s; RZ.app.rerender(); };

    /* ---------- üst çubuk ---------- */
    screen.appendChild(el('div.ph-top',
      el('div.row', { style: { gap: '8px' } },
        el('div', { style: { width: '26px', height: '26px', flex: 'none' }, html: U.logoMark(26) }),
        el('div.grow',
          el('div', { style: { fontWeight: '680', fontSize: '14px', letterSpacing: '-.02em' } }, 'Rezervle'),
          el('div.hint', { style: { fontSize: '10.5px' } },
            flow.screen === 'mine' ? 'Rezervasyonlarım' : 'Ankara · yakınımdakiler')),
        el('span.hint', { html: U.icon('search', 16) }))));

    const body = el('div.ph-body');
    screen.appendChild(body);

    /* ================= KEŞFET ================= */
    if (flow.screen === 'discover') {
      const cats = el('div.ph-cats');
      CATS.forEach((c) => {
        const has = c.id === 'all' || listed.some((b) => b.category === c.id);
        if (!has) return;
        cats.appendChild(el('button.ph-cat' + (flow.cat === c.id ? '.on' : ''), {
          onclick: () => { flow.cat = c.id; RZ.app.rerender(); },
        }, el('span', { html: U.icon(c.icon, 13) }), c.label));
      });
      body.appendChild(cats);

      body.appendChild(el('div.row', { style: { gap: '6px', overflowX: 'auto', paddingBottom: '10px' } },
        Array.from({ length: 7 }, (_, i) => i).map((i) => {
          const d = U.addDays(new Date(), i);
          return el('button.ph-slot' + (i === flow.dateOffset ? '.on' : ''), {
            style: { minWidth: '52px', flex: 'none', padding: '6px 4px' },
            onclick: () => { flow.dateOffset = i; RZ.app.rerender(); },
          }, el('div', { style: { fontSize: '10px', opacity: '.75' } }, i === 0 ? 'Bugün' : U.GUN_K[d.getDay()]),
             el('div', { style: { fontSize: '13px' } }, d.getDate()));
        })));

      const rows = listed.filter((b) => flow.cat === 'all' || b.category === flow.cat);
      body.appendChild(el('div.hint', { style: { marginBottom: '9px' } },
        `${rows.length} işletme · ${U.dateStr(U.addDays(new Date(), flow.dateOffset), 'dayName')}`));

      rows.forEach((b) => {
        const av = availability(st, b);
        body.appendChild(el('button.ph-venue', {
          onclick: () => { flow.bizId = b.id; flow.serviceId = null; flow.start = null; go('venue'); },
        },
          el('div.cover', { html: coverArt(b, 82) },
            el('span.ttl', b.name)),
          el('div.meta',
            av
              ? el('span.avail.' + av.level, el('i.dot'),
                  av.slots === 0 ? 'Bugün dolu' : `${av.total} ${av.unit}tan ${av.free}’i boş`)
              : null,
            b.rating ? el('span.ph-rate', el('span', { style: { color: 'var(--warn)' }, html: U.icon('star', 12) }), b.rating) : null,
            el('span.hint', { style: { fontSize: '11px' } }, b.district))));
      });

      body.appendChild(el('div.hint', { style: { marginTop: '4px', lineHeight: '1.5' } },
        'Uygulamada listelenmek her pakette ücretsizdir. İşletme abonelik öder, tüketici hiçbir ücret ödemez.'));
    }

    /* ================= MEKÂN DETAY ================= */
    if (flow.screen === 'venue') {
      const svcs = st.services.filter((s) => s.bizId === biz.id);
      if (!flow.serviceId || !svcs.find((s) => s.id === flow.serviceId)) flow.serviceId = svcs[0].id;
      const svc = svcs.find((s) => s.id === flow.serviceId);
      const dateKey = U.dayKey(U.addDays(new Date(), flow.dateOffset));
      const ctx = bizCtx(st, biz);
      const slots = S.freeSlots(ctx, { date: dateKey, duration: svc.duration, step: 30 });
      const all = allSlots(biz, dateKey, svc.duration);

      body.appendChild(el('div.ph-hero', { html: coverArt(biz, 118) },
        el('button.back', { html: U.icon('chevL', 16), onclick: () => go('discover'), 'aria-label': 'Geri' }),
        el('div',
          el('div', { style: { color: '#fff', fontWeight: '700', fontSize: '17px', letterSpacing: '-.02em', textShadow: '0 1px 6px rgba(0,0,0,.35)' } }, biz.name),
          el('div', { style: { color: 'rgba(255,255,255,.9)', fontSize: '11.5px' } },
            `${biz.category} · ${biz.district}`))));

      body.appendChild(el('div.row', { style: { gap: '7px', marginBottom: '12px', flexWrap: 'wrap' } },
        biz.rating ? el('span.badge.badge-warn', el('span', { html: U.icon('star', 11) }), biz.rating) : null,
        el('span.badge', el('span', { html: U.icon('clock', 11) }),
          biz.hours[U.addDays(new Date(), flow.dateOffset).getDay()]
            ? `${U.hhmm(biz.hours[U.addDays(new Date(), flow.dateOffset).getDay()][0])}–${U.hhmm(biz.hours[U.addDays(new Date(), flow.dateOffset).getDay()][1])}`
            : 'Bugün kapalı'),
        el('span.badge', el('span', { html: U.icon('phone', 11) }), 'Ara')));

      body.appendChild(el('div.hint', { style: { margin: '2px 0 4px' } }, 'Hizmet'));
      svcs.forEach((s) => {
        body.appendChild(el('button.ph-svc' + (s.id === flow.serviceId ? '.on' : ''), {
          onclick: () => { flow.serviceId = s.id; flow.start = null; RZ.app.rerender(); },
        },
          el('div', el('div', { style: { fontWeight: '600', fontSize: '13px' } }, s.name),
            el('div.hint', { style: { fontSize: '11px' } }, s.duration + ' dk')),
          el('div', { style: { textAlign: 'right' } },
            el('div.mono-money', { style: { fontSize: '13.5px' } }, tl(s.price)),
            s.deposit && RZ.plans.can(biz, 'deposit')
              ? el('div.hint', { style: { fontSize: '10px' } }, tl(s.deposit) + ' kapora') : null)));
      });

      body.appendChild(el('div.hint', { style: { margin: '14px 0 6px' } }, 'Gün'));
      body.appendChild(el('div.row', { style: { gap: '6px', overflowX: 'auto', paddingBottom: '4px' } },
        Array.from({ length: 7 }, (_, i) => i).map((i) => {
          const d = U.addDays(new Date(), i);
          return el('button.ph-slot' + (i === flow.dateOffset ? '.on' : ''), {
            style: { minWidth: '52px', flex: 'none', padding: '6px 4px' },
            onclick: () => { flow.dateOffset = i; flow.start = null; RZ.app.rerender(); },
          }, el('div', { style: { fontSize: '10px', opacity: '.75' } }, U.GUN_K[d.getDay()]),
             el('div', { style: { fontSize: '13px' } }, d.getDate()));
        })));

      body.appendChild(el('div.hint', { style: { margin: '13px 0 6px' } },
        all.length ? `Uygun saatler · ${slots.length} boş` : 'Bu gün kapalı'));
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' } });
      all.forEach((t) => {
        const s = slots.find((x) => x.start === t);
        grid.appendChild(el('button.ph-slot' + (flow.start === t ? '.on' : '') + (s ? '' : '.off'), {
          onclick: () => { flow.start = t; flow.resourceId = s.resources[0]; RZ.app.rerender(); },
        }, U.hhmm(t)));
      });
      body.appendChild(grid);
      body.appendChild(el('div.hint', { style: { marginTop: '9px', fontSize: '10.5px' } },
        'Dolu saatler paneldeki takvimden canlı gelir — aynı kaynak iki kez satılamaz.'));

      screen.appendChild(el('div.ph-foot',
        el('button.btn.btn-primary.btn-block', {
          disabled: flow.start == null,
          onclick: () => go('book'),
        }, flow.start == null ? 'Saat seçin' : `${U.hhmm(flow.start)} · devam et`)));
    }

    /* ================= ONAY ================= */
    if (flow.screen === 'book') {
      const svc = st.services.find((s) => s.id === flow.serviceId);
      const res = st.resources.find((x) => x.id === flow.resourceId) || {};
      const dateKey = U.dayKey(U.addDays(new Date(), flow.dateOffset));

      body.appendChild(el('div.row', { style: { gap: '8px', marginBottom: '12px' } },
        el('button.btn.btn-sm.btn-quiet', { onclick: () => go('venue'), 'aria-label': 'Geri' }, el('span', { html: U.icon('chevL', 14) })),
        el('div', { style: { fontWeight: '650', fontSize: '14px' } }, 'Rezervasyonu onayla')));

      body.appendChild(el('div.ph-card',
        row('İşletme', biz.name), row('Hizmet', svc.name),
        row('Tarih', U.dateStr(U.fromKey(dateKey), 'dayName')),
        row('Saat', `${U.hhmm(flow.start)} – ${U.hhmm(flow.start + svc.duration)}`),
        row('Kaynak', res.name),
        el('div.divider', { style: { margin: '8px 0' } }),
        el('div.row-b', el('span.hint', 'Tutar'), el('b.mono-money', tl(svc.price)))));

      // Onay dugmesi once olusturulur: her tus vurusunda tum ekrani yeniden cizmek
      // odagi kaybettirir, bu yuzden yalnizca dugmenin durumu guncellenir.
      const cta = el('button.btn.btn-primary.btn-block', { onclick: () => submit() }, 'Rezervasyonu tamamla');
      const syncCta = () => {
        const ok = flow.name.trim().length >= 2 && flow.phone.replace(/\D/g, '').length >= 10;
        cta.disabled = !ok;
        cta.textContent = ok ? 'Rezervasyonu tamamla' : 'Ad ve telefon girin';
      };

      body.appendChild(el('div.field', { style: { marginTop: '10px' } }, el('label', 'Ad Soyad'),
        el('input.input', {
          value: flow.name, placeholder: 'Adınız',
          oninput: (e) => { flow.name = e.target.value; syncCta(); },
        })));
      body.appendChild(el('div.field', { style: { marginTop: '8px' } }, el('label', 'Telefon'),
        el('input.input', {
          value: flow.phone, placeholder: '05xx xxx xx xx', inputmode: 'tel',
          oninput: (e) => { flow.phone = e.target.value; syncCta(); },
        })));

      if (svc.deposit && RZ.plans.can(biz, 'deposit')) {
        body.appendChild(el('div.ph-card', { style: { marginTop: '10px', background: 'var(--violet-soft)', borderColor: 'transparent' } },
          el('div.row', { style: { gap: '8px', alignItems: 'flex-start' } },
            el('span', { style: { color: 'var(--violet)' }, html: U.icon('shield', 15) }),
            el('div.hint', { style: { fontSize: '11px', lineHeight: '1.5' } },
              el('b', tl(svc.deposit) + ' kapora'),
              ' güvenceye alınır. Kartınızdan tahsilat yapılmaz; yalnızca randevuya gelinmezse işletme tarafından tahsil edilir.'))));
      }
      body.appendChild(el('div.hint', { style: { marginTop: '10px', fontSize: '10.5px' } },
        'Üyelik zorunlu değildir; telefon numarası SMS ile doğrulanır.'));

      syncCta();
      screen.appendChild(el('div.ph-foot', cta));

      function submit() {
        if (RZ.store.biz().id !== biz.id) RZ.store.setBiz(biz.id);
        const cus = RZ.store.upsertCustomer({ name: flow.name.trim(), phone: flow.phone });
        const r = RZ.store.addReservation({
          customerId: cus.id, serviceId: svc.id, resourceId: flow.resourceId,
          date: dateKey, start: flow.start, end: flow.start + svc.duration,
          channel: 'app', status: 'confirmed',
          deposit: svc.deposit && RZ.plans.can(biz, 'deposit')
            ? { amount: svc.deposit, status: 'held', method: 'card' } : null,
        });
        if (!r.ok) { RZ.ui.toast(r.errors[0].msg, 'err'); RZ.app.rerender(); return; }
        flow.doneId = r.reservation.id;
        flow.screen = 'done';
        RZ.ui.toast('Uygulamadan gelen rezervasyon panele düştü.', 'ok');
        RZ.app.rerender();
      }
    }

    /* ================= BAŞARILI ================= */
    if (flow.screen === 'done') {
      const svc = st.services.find((s) => s.id === flow.serviceId) || {};
      const dateKey = U.dayKey(U.addDays(new Date(), flow.dateOffset));
      body.appendChild(el('div', { style: { textAlign: 'center', paddingTop: '40px' } },
        el('div', { style: { width: '62px', height: '62px', borderRadius: '50%', background: 'var(--money-soft)', color: 'var(--money)', display: 'grid', placeItems: 'center', margin: '0 auto 15px' }, html: U.icon('check', 28) }),
        el('div', { style: { fontWeight: '680', fontSize: '17px', marginBottom: '6px' } }, 'Rezervasyonunuz onaylandı'),
        el('div.hint', { style: { lineHeight: '1.55' } },
          `${biz.name} · ${U.dateStr(U.fromKey(dateKey), 'dayName')} ${U.hhmm(flow.start)}`),
        el('div.ph-card', { style: { marginTop: '18px', textAlign: 'left' } },
          el('div.row', { style: { gap: '9px' } },
            el('span', { style: { color: 'var(--brand)' }, html: U.icon('qr', 18) }),
            el('div.hint', { style: { fontSize: '11px', lineHeight: '1.5' } },
              'Girişte okutmanız için QR kodunuz hazır. Randevudan ' + biz.settings.reminderHours + ' saat önce hatırlatma SMS’i gönderilecek.')))));
      screen.appendChild(el('div.ph-foot',
        el('div.row', { style: { gap: '8px' } },
          el('button.btn.btn-ghost.btn-block', { onclick: () => go('mine') }, 'Rezervasyonlarım'),
          el('button.btn.btn-primary.btn-block', { onclick: () => { location.hash = '#/panel/takvim?d=' + dateKey; } }, 'Takvimde gör'))));
    }

    /* ================= REZERVASYONLARIM ================= */
    if (flow.screen === 'mine') {
      const mine = myBookings(st);
      body.appendChild(el('div.hint', { style: { marginBottom: '10px' } },
        mine.length ? `${mine.length} rezervasyon` : ''));
      if (!mine.length) {
        body.appendChild(el('div', { style: { paddingTop: '30px' } }, RZ.ui.emptyState(
          'Henüz rezervasyonunuz yok',
          'Keşfet sekmesinden bir işletme seçip uygun saatlerden birini alın; rezervasyonunuz burada görünür.',
          'calendar',
          { label: 'Keşfet’e dön', icon: 'search', onClick: () => go('discover') })));
      }
      mine.forEach((r) => {
        const b = st.businesses.find((x) => x.id === r.bizId) || {};
        const svc = st.services.find((x) => x.id === r.serviceId) || {};
        body.appendChild(el('div.ph-mine',
          el('div.row-b', { style: { marginBottom: '5px' } },
            el('span.when', `${U.dateStr(U.fromKey(r.date), 'md')} · ${U.hhmm(r.start)}`),
            RZ.ui.statusBadge(r.status)),
          el('div', { style: { fontWeight: '620', fontSize: '13px' } }, b.name),
          el('div.hint', { style: { fontSize: '11px' } }, `${svc.name} · ${tl(r.price)}`),
          r.deposit ? el('div.hint', { style: { fontSize: '10.5px', color: 'var(--violet)', marginTop: '4px' } },
            `${tl(r.deposit.amount)} kapora güvencede — tahsilat yapılmadı`) : null));
      });
    }

    /* ---------- alt navigasyon ---------- */
    if (flow.screen !== 'book' && flow.screen !== 'done') {
      const mineCount = myBookings(st).length;
      screen.appendChild(el('div.ph-nav',
        navBtn('search', 'Keşfet', flow.screen === 'discover' || flow.screen === 'venue', () => go('discover')),
        navBtn('calendar', 'Rezervasyonlar', flow.screen === 'mine', () => go('mine'), mineCount),
        navBtn('users', 'Profil', false, () => RZ.ui.toast('Profil ekranı bu önizlemede yok.', ''))));
    }

    /* ---------- yerleşim ---------- */
    root.appendChild(el('div.split.phone-split',
      el('div.phone', el('div.phone-notch'), screen),
      el('div.stack',
        el('div.card.card-pad',
          el('h3', { style: { fontSize: '16px', marginBottom: '8px' } }, 'Sistem iki taraflı çalışır'),
          el('p.dim.t-sm', { style: { lineHeight: '1.65' } },
            'Soldaki ekran tüketici uygulamasıdır ve gerçek veriyle çalışır: gösterilen boş saatler paneldeki takvimden gelir, ',
            'buradan yapılan rezervasyon aynı çakışma motorundan geçer ve anında işletme paneline düşer. ',
            'Uygulamada listelenmek ücretsizdir; gelir yalnızca panel aboneliğinden gelir.'),
          el('div.divider'),
          el('div.grid.g2', { style: { gap: '10px' } },
            el('div.stat-mini', el('div.l', 'Tüketiciden alınan ücret'), el('div.v', '0 ₺')),
            el('div.stat-mini', el('div.l', 'Ödeme akışı'), el('div.v', { style: { fontSize: '14px' } }, 'İşletmenin POS’u')))),
        el('div.card.card-pad',
          el('h3', { style: { fontSize: '15px', marginBottom: '10px' } }, 'Kritik tasarım kararı'),
          el('p.dim.t-sm', { style: { lineHeight: '1.65' } },
            'Uygulamadan ', el('b', 'gelmeyen'), ' rezervasyonlar da panele girilir: telefon, WhatsApp, kapıdan gelen — hepsi aynı takvime düşer. ',
            'Böylece ciro raporu işletmenin tamamını gösterir, yalnızca bizden geleni değil. Ürünü ilk günden, henüz tüketici trafiği yokken bile kullanılabilir kılan şey budur.')),
        el('div.card.card-pad',
          el('div.row', { style: { gap: '10px', alignItems: 'flex-start' } },
            el('span', { style: { color: 'var(--warn)' }, html: U.icon('alert', 18) }),
            el('div.hint', { style: { lineHeight: '1.6' } },
              el('b', 'Kategoriler bilinçli olarak dar. '),
              'Uygulamada yalnızca saha araştırmasının kapsadığı dikeyler listelenir. ',
              'Diş kliniği ve veteriner gibi regülasyonlu kategoriler reklam yasağı nedeniyle ilk 18 ay kapsam dışıdır ve projeksiyona dahil edilmemiştir.'))))
    ));

    /* --------- yardımcılar --------- */
    function row(k, v) {
      return el('div.row-b', { style: { padding: '3px 0' } },
        el('span.hint', k), el('b', { style: { fontSize: '12.5px' } }, v));
    }
    function navBtn(icon, label, on, onClick, count) {
      return el('button' + (on ? '.on' : ''), { onclick: onClick },
        el('span', { style: { position: 'relative' }, html: U.icon(icon, 18) },
          count ? el('span.badge.badge-brand', String(count)) : null),
        label);
    }
  };

  function bizCtx(st, b) {
    return {
      biz: b,
      resources: st.resources.filter((r) => r.bizId === b.id),
      services: st.services.filter((s) => s.bizId === b.id),
      reservations: st.reservations.filter((r) => r.bizId === b.id),
    };
  }

  /** Bu onizlemede "benim rezervasyonlarim" = uygulamadan gelen son kayitlar */
  function myBookings(st) {
    const todayKey = U.dayKey(new Date());
    return st.reservations
      .filter((r) => r.channel === 'app' && r.date >= todayKey && r.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
      .slice(0, 6);
  }

  function allSlots(biz, dateKey, dur) {
    const d = U.fromKey(dateKey);
    const h = biz.hours[d.getDay()];
    if (!h) return [];
    const out = [];
    for (let t = h[0]; t + dur <= h[1]; t += 30) out.push(t);
    return out;
  }
})(window.RZ);
