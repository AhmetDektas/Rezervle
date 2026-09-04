/* Rezervle — Panel > Özet
   Isletmenin "bugun ne oluyor + bu ay nerede duruyorum" ekrani. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, A = RZ.analytics, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  RZ.views.dashboard = function (root) {
    const c = RZ.store.ctx();
    const biz = c.biz;

    // Ilk gun: hic rezervasyon yoksa panel sifirlarla dolu bir dashboard degil,
    // yonlendirilmis bir kurulum akisi gosterir. Tutundurmanin ilk dakikasi burasi.
    if (!c.reservations.length) { setupMode(root, c); return; }
    const todayKey = U.dayKey(new Date());
    const nowM = U.minsOfDay(new Date());

    const dayCmp = A.compare(c, A.period('today'));
    const monthCmp = A.compare(c, A.period('month'));
    const last30 = A.report(c, A.period('30d'));

    const today = c.reservations.filter((r) => r.date === todayKey).sort((a, b) => a.start - b.start);
    const occ = S.occupancy(c, todayKey);
    const pendings = c.reservations.filter((r) => r.status === 'pending' && r.date >= todayKey);
    const chargeable = c.reservations.filter((r) => r.deposit && r.deposit.status === 'chargeable');
    const tomorrow = U.dayKey(U.addDays(new Date(), 1));
    const tomorrowGaps = S.gaps(c, tomorrow, 60);

    root.appendChild(el('div.kpi-row', { style: { marginBottom: '14px' } },
      RZ.ui.kpi({
        label: 'Bugünkü ciro', icon: 'trend', accent: 'money', hero: true,
        value: tl(dayCmp.cur.gross), delta: dayCmp.d.gross, deltaLabel: 'düne göre',
        spark: last30.byDay.slice(-14).map((d) => d.total), sparkColor: 'var(--money)',
        foot: dayCmp.cur.expectedSum ? `+${tl(dayCmp.cur.expectedSum)} bekleyen` : null,
      }),
      RZ.ui.kpi({
        label: 'Bugünkü rezervasyon', icon: 'calendar',
        value: today.filter((r) => S.isActive(r)).length,
        delta: dayCmp.d.count, deltaLabel: 'düne göre',
      }),
      RZ.ui.kpi({
        label: 'Bugünkü doluluk', icon: 'grid',
        value: occ.pct, unit: '%',
        foot: `${Math.round(occ.sold / 60)} saat satıldı · ${Math.round(occ.capacity / 60)} saat kapasite`,
      }),
      RZ.ui.kpi({
        label: 'Bu ay gelmeyen müşteri', icon: 'ban', accent: 'danger', invert: true,
        value: tl(monthCmp.cur.lost), delta: monthCmp.d.lost, deltaLabel: 'geçen aya göre',
        foot: `${monthCmp.cur.noshow.length} rezervasyon · kayıp kapasite`,
      })
    ));

    /* ---------- Aksiyon kartlari ---------- */
    const actions = [];
    if (pendings.length) {
      actions.push({
        icon: 'clock', color: 'var(--warn)',
        title: `${pendings.length} rezervasyon onay bekliyor`,
        text: 'Onaylanmayan rezervasyonlar müşteride tereddüt yaratır ve no-show riskini artırır.',
        cta: 'Onay kuyruğunu aç', go: () => (location.hash = '#/panel/rezervasyon?f=pending'),
      });
    }
    if (chargeable.length && RZ.plans.can(biz, 'deposit')) {
      actions.push({
        icon: 'shield', color: 'var(--violet)',
        title: `${chargeable.length} kapora tahsil edilebilir`,
        text: `Toplam ${tl(U.sum(chargeable, (r) => r.deposit.amount))} — gelmeyen müşterilerin güvence tutarı.`,
        cta: 'Kapora ekranı', go: () => (location.hash = '#/panel/kapora'),
      });
    }
    if (tomorrowGaps.length >= 2) {
      actions.push({
        icon: 'mega', color: 'var(--brand)',
        title: `Yarın ${tomorrowGaps.length} boş aralık var`,
        text: 'Doluluğun düştüğü saatlere hedefli indirim duyurusu göndererek kapasiteyi ciroya çevirin.',
        cta: 'Kampanya oluştur', go: () => (location.hash = '#/panel/kampanya'),
      });
    }
    const ins = A.customerInsights(c, { lostAfter: 60 });
    if (ins.lost.length) {
      actions.push({
        icon: 'users', color: 'var(--cyan)',
        title: `${ins.lost.length} müşteri 2 aydır gelmedi`,
        text: `Bu grubun geçmiş harcaması ${tl(U.sum(ins.lost, (x) => x.spend), { compact: true })}. Geri kazanım mesajı gönderin.`,
        cta: 'Listeyi gör', go: () => (location.hash = '#/panel/musteri?seg=lost'),
      });
    }

    if (actions.length) {
      root.appendChild(el('div.grid.g3', { style: { marginBottom: '16px' } },
        actions.slice(0, 3).map((a) =>
          el('div.card.card-pad', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' } },
            el('div', { style: { color: a.color, flex: 'none', marginTop: '1px' }, html: U.icon(a.icon, 20) }),
            el('div.grow',
              el('div', { style: { fontWeight: '640', fontSize: '14.5px', marginBottom: '3px' } }, a.title),
              el('div.hint', { style: { marginBottom: '9px' } }, a.text),
              el('button.btn.btn-sm.btn-ghost', { onclick: a.go }, a.cta)
            )
          )
        )
      ));
    }

    /* ---------- Bugunun akisi + yan sutun ---------- */
    const flow = el('div.card');
    flow.appendChild(el('div.card-head',
      el('div',
        el('h3', 'Bugünün akışı'),
        el('div.sub', `${U.dateStr(new Date(), 'long')} · ${today.filter((r) => S.isActive(r)).length} rezervasyon`)
      ),
      el('button.btn.btn-sm.btn-primary', { onclick: () => RZ.booking.openBooking({ date: todayKey }) },
        el('span', { html: U.icon('plus', 15) }), 'Kapıdan gelen')
    ));

    if (!today.length) {
      flow.appendChild(RZ.ui.emptyState(
        'Bugün için kayıt yok',
        'Telefondan, WhatsApp’tan ya da kapıdan gelen randevuyu buraya girin — defterinize yazdığınız gibi. Ciro kaydı kendiliğinden oluşur.',
        'calendar',
        { label: 'Rezervasyon gir', icon: 'plus', onClick: () => RZ.booking.openBooking({ date: todayKey }) }));
    } else {
      const list = el('div', { style: { maxHeight: '430px', overflow: 'auto' } });
      today.forEach((r) => {
        const svc = c.services.find((s) => s.id === r.serviceId) || {};
        const res = c.resources.find((s) => s.id === r.resourceId) || {};
        const cus = c.customers.find((s) => s.id === r.customerId);
        const isNow = r.start <= nowM && r.end > nowM;
        list.appendChild(el('div.lrow.clickable', {
          style: isNow ? { background: 'var(--brand-soft)' } : null,
          onclick: () => RZ.booking.openDetail(r.id),
        },
          el('div.time-chip', { style: { background: res.color ? res.color + '22' : null, color: res.color } }, U.hhmm(r.start)),
          el('div.grow',
            el('div.row', { style: { gap: '7px' } },
              el('span', { style: { fontWeight: '600', fontSize: '14px' } }, cus ? cus.name : r.guestName || 'Misafir'),
              isNow ? el('span.badge.badge-brand', 'şu an') : null
            ),
            el('div.hint.truncate', `${svc.name} · ${res.name}${r.staffId ? ' · ' + (c.staff.find((s) => s.id === r.staffId) || {}).name : ''}`)
          ),
          r.deposit ? el('span', { style: { color: 'var(--violet)' }, title: 'Kapora alındı', html: U.icon('shield', 15) }) : null,
          el('div.mono-money.t-sm', tl(r.price)),
          RZ.ui.statusBadge(r.status)
        ));
      });
      flow.appendChild(list);
    }

    /* --- yan sutun --- */
    const smsLimit = RZ.plans.limit(biz, 'sms');
    const smsUsed = biz.smsUsed || 0;
    const side = el('div.stack',
      el('div.card',
        el('div.card-head', el('div', el('h3', 'Bu ay'), el('div.sub', U.dateStr(new Date(), 'monthYear')))),
        el('div.card-pad',
          el('div', { style: { fontSize: '30px', fontWeight: '700', letterSpacing: '-.03em', color: 'var(--money)' } },
            tl(monthCmp.cur.gross)),
          el('div.row', { style: { gap: '6px', marginTop: '2px' } },
            el('span.t-sm', {
              style: { color: monthCmp.d.gross >= 0 ? 'var(--money)' : 'var(--danger)', fontWeight: '620' },
            }, (monthCmp.d.gross >= 0 ? '▲ ' : '▼ ') + U.pctStr(Math.abs(monthCmp.d.gross))),
            el('span.hint', 'geçen ayın aynı dönemine göre')
          ),
          el('div.divider'),
          el('div.grid.g2', { style: { gap: '9px' } },
            el('div.stat-mini', el('div.l', 'Rezervasyon'), el('div.v', monthCmp.cur.count)),
            el('div.stat-mini', el('div.l', 'Ortalama fiş'), el('div.v', tl(monthCmp.cur.avgTicket, { compact: true }))),
            el('div.stat-mini', el('div.l', 'Doluluk'), el('div.v', '%' + monthCmp.cur.occupancy)),
            el('div.stat-mini', el('div.l', 'Yeni müşteri'), el('div.v', monthCmp.cur.customers.new))
          ),
          el('button.btn.btn-ghost.btn-block', { style: { marginTop: '13px' }, onclick: () => (location.hash = '#/panel/ciro') },
            'Ciro raporunu aç')
        )
      ),
      el('div.card.card-pad',
        el('div.row-b', el('div', { style: { fontWeight: '620', fontSize: '14px' } }, 'SMS kotası'),
          el('span.hint', `${U.fmtNum(smsUsed)} / ${smsLimit === Infinity ? '∞' : U.fmtNum(smsLimit)}`)),
        el('div.bar-track', { style: { marginTop: '9px' } },
          el('span', {
            style: {
              width: U.clamp((smsUsed / (smsLimit || 1)) * 100, 0, 100) + '%',
              background: smsUsed / smsLimit > 0.85 ? 'var(--warn)' : 'var(--brand)',
            },
          })),
        el('div.hint', { style: { marginTop: '8px' } },
          'Otomatik hatırlatmalar bu kotadan düşer. Anket: işletmelerin %82’si otomatik hatırlatma istiyor.')
      ),
      el('div.card',
        el('div.card-head', el('div', el('h3', 'Son hareketler'))),
        el('div', { style: { maxHeight: '220px', overflow: 'auto' } },
          RZ.store.get().activity.filter((a) => a.bizId === biz.id).slice(0, 8).map((a) =>
            el('div.lrow',
              el('div.av-circle', { style: { width: '28px', height: '28px', borderRadius: '9px' }, html: U.icon(logIcon(a.type), 14) }),
              el('div.grow', el('div.t-sm.truncate', a.text),
                el('div.hint', new Date(a.at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })))
            )
          )
        )
      )
    );

    root.appendChild(el('div.split', flow, side));

    /* ---------- Trend ---------- */
    const labels = last30.byDay.map((d) => U.dateStr(d.date, 'md'));
    root.appendChild(el('div.split', { style: { marginTop: '14px' } },
      RZ.ui.sectionCard('Son 30 gün cirosu', 'Gerçekleşen ciro ve gelmeyen müşteri kaybı',
        el('div.chart-box',
          RZ.ui.lineChart(labels, [
            { key: 'g', name: 'Ciro', color: 'var(--money)', values: last30.byDay.map((d) => d.total) },
            { key: 'l', name: 'Kayıp (no-show)', color: 'var(--danger)', values: last30.byDay.map((d) => d.lost), dashed: true, fill: false },
          ], { money: true, height: 220 }),
          el('div.chart-legend',
            el('span', el('i', { style: { background: 'var(--money)' } }), 'Gerçekleşen ciro'),
            el('span', el('i', { style: { background: 'var(--danger)' } }), 'Gelmeyen müşteri kaybı')
          )
        )
      ),
      RZ.ui.sectionCard('Rezervasyon nereden geldi', 'Son 30 gün · kanal dağılımı',
        el('div.card-pad',
          el('div.row', { style: { gap: '16px', justifyContent: 'center', flexWrap: 'wrap' } },
            RZ.ui.donut(last30.byChannel, { centerValue: U.fmtNum(last30.count), centerLabel: 'rezervasyon' })
          ),
          el('div', { style: { marginTop: '14px' } },
            last30.byChannel.map((ch) =>
              el('div.row-b', { style: { padding: '6px 0' } },
                el('div.row', { style: { gap: '8px' } },
                  el('i', { style: { width: '9px', height: '9px', borderRadius: '3px', background: ch.color, display: 'block' } }),
                  el('span.t-sm', ch.name)),
                el('div.row', { style: { gap: '10px' } },
                  el('span.hint', '%' + U.pct(ch.total, last30.gross)),
                  el('span.mono-money.t-sm', tl(ch.total, { compact: true })))
              )
            )
          ),
          el('div.hint', { style: { marginTop: '10px' } },
            'Uygulamadan gelen pay zamanla artar; panel ilk günden telefonla gelen rezervasyonu da kaydeder.')
        )
      )
    ));
  };

  /* ---------------- İlk gün: kurulum modu ---------------- */
  function setupMode(root, c) {
    const steps = [
      {
        n: 1, title: 'Kaynaklarınızı tanımlayın',
        desc: 'Saha, kort, koltuk, kabin ya da masa — aynı anda kaç rezervasyon alabildiğinizi belirleyen şey budur. Çakışma engeli buna göre çalışır.',
        done: c.resources.length > 0,
        cta: 'Kaynak ekle', go: () => (location.hash = '#/panel/ayarlar'),
      },
      {
        n: 2, title: 'Hizmet ve fiyatlarınızı girin',
        desc: 'Ciro raporunuz bu fiyatlardan oluşur. Süreyi de girin ki takvim doğru aralıkları göstersin.',
        done: c.services.length > 0,
        cta: 'Hizmet ekle', go: () => (location.hash = '#/panel/ayarlar'),
      },
      {
        n: 3, title: 'İlk rezervasyonunuzu girin',
        desc: 'Telefonla gelen bir randevuyu girin — defterinize yazdığınız gibi. Girdiğiniz an ciro takibi çalışmaya başlar.',
        done: c.reservations.length > 0,
        cta: 'Rezervasyon aç',
        go: () => {
          if (!c.services.length || !c.resources.length) {
            RZ.ui.toast('Önce kaynak ve hizmet tanımlayın.', 'err');
            location.hash = '#/panel/ayarlar';
            return;
          }
          RZ.booking.openBooking({});
        },
      },
    ];
    const next = steps.find((s) => !s.done);

    root.appendChild(el('div.setup-hero',
      el('div.badge.badge-brand', { style: { marginBottom: '12px' } }, el('i.dot'), 'Kuruluma 3 adım kaldı'),
      el('h2', `Hoş geldiniz, ${c.biz.name.replace(' (yeni kayıt)', '')}`),
      el('p', 'Panel henüz boş çünkü ilk rezervasyonunuz girilmedi. Aşağıdaki üç adımı tamamladığınızda takvim, müşteri kaydı ve ciro raporu kendiliğinden dolmaya başlar — ayrıca bir şey yapmanız gerekmez.'),
      el('div.setup-list', steps.map((s) =>
        el('div.setup-card' + (s.done ? '.done' : s === next ? '.next' : ''),
          el('div.num', s.done ? el('span', { html: U.icon('check', 15) }) : String(s.n)),
          el('div.grow',
            el('div.st', s.title),
            el('div.sd', s.desc),
            !s.done && s === next
              ? el('button.btn.btn-primary.btn-sm', { style: { marginTop: '11px' }, onclick: s.go }, s.cta)
              : null),
          s.done ? el('span.badge.badge-money', 'tamam') : null))),
      el('div.divider'),
      el('div.row', { style: { gap: '10px', alignItems: 'flex-start' } },
        el('span', { style: { color: 'var(--ink-3)' }, html: U.icon('phone', 17) }),
        el('div.hint', { style: { lineHeight: '1.6' } },
          el('b', 'Kurulumu biz de yapabiliriz. '),
          'Mevcut defterinizdeki müşteri listesini CSV olarak aktarıyor, kaynak ve fiyatları yerinde tanımlıyoruz. Saha ekibimiz için ',
          el('b', '0850 000 00 00'), '.'))
    ));

    root.appendChild(el('div.hint', { style: { marginTop: '18px', maxWidth: '760px' } },
      'Bu ekran demonun bir parçası: yeni kaydolan bir işletmenin ilk açılışta gördüğü hâl. ',
      'Dolu bir işletme görmek için sol üstten ', el('b', 'Gülveren Spor Tesisleri'), '’ne geçin.'));
  }

  function logIcon(t) {
    return { plan: 'star', addon: 'bolt', booking: 'calendar', status: 'check', deposit: 'shield', package: 'box', campaign: 'mega', customer: 'users' }[t] || 'bolt';
  }
})(window.RZ);
