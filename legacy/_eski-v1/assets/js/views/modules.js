/* Rezervle — Panel > Ek modüller: Kapora, Paket & Kredi, Kampanya
   Ucu de paket mimarisine baglidir: kapali paketlerde ekran bulaniklasir ve yukseltme akisi acilir. */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, A = RZ.analytics, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  /* ================= KAPORA ================= */
  RZ.views.deposits = function (root) {
    root.appendChild(RZ.ui.guarded('deposit', (preview) => build(preview)));

    function build() {
      const c = RZ.store.ctx();
      const withDep = c.reservations.filter((r) => r.deposit && r.deposit.amount);
      const held = withDep.filter((r) => r.deposit.status === 'held');
      const chargeable = withDep.filter((r) => r.deposit.status === 'chargeable');
      const charged = withDep.filter((r) => r.deposit.status === 'charged');
      const monthKey = U.dayKey(U.startOfMonth(new Date()));
      const monthCharged = charged.filter((r) => r.date >= monthKey);

      // Kapora alinan vs alinmayan rezervasyonlarda no-show orani
      const past = c.reservations.filter((r) => r.date < U.dayKey(new Date()) && r.status !== 'cancelled');
      const rate = (arr) => (arr.length ? (arr.filter((r) => r.status === 'no_show').length / arr.length) * 100 : 0);
      const withRate = rate(past.filter((r) => r.deposit));
      const withoutRate = rate(past.filter((r) => !r.deposit));

      const wrap = el('div');
      wrap.appendChild(el('div.grid.g4', { style: { marginBottom: '14px' } },
        RZ.ui.kpi({ label: 'Güvencedeki tutar', icon: 'shield', value: tl(U.sum(held, (r) => r.deposit.amount)), foot: `${held.length} rezervasyon · tahsilat yapılmadı` }),
        RZ.ui.kpi({ label: 'Tahsil edilebilir', icon: 'alert', accent: 'danger', value: tl(U.sum(chargeable, (r) => r.deposit.amount)), foot: `${chargeable.length} müşteri gelmedi` }),
        RZ.ui.kpi({ label: 'Bu ay tahsil edilen', icon: 'wallet', accent: 'money', value: tl(U.sum(monthCharged, (r) => r.deposit.amount)), foot: 'Kendi POS’unuzdan' }),
        RZ.ui.kpi({
          label: 'No-show farkı', icon: 'trend',
          value: '%' + Math.round(withRate) + ' / %' + Math.round(withoutRate),
          foot: 'kaporalı / kaporasız rezervasyonlarda gelmeme oranı',
        })
      ));

      wrap.appendChild(el('div.card.card-pad', { style: { marginBottom: '14px', background: 'var(--violet-soft)', borderColor: 'transparent' } },
        el('div.row', { style: { gap: '11px', alignItems: 'flex-start' } },
          el('span', { style: { color: 'var(--violet)' }, html: U.icon('shield', 20) }),
          el('div',
            el('div', { style: { fontWeight: '650', marginBottom: '4px' } }, 'Para Rezervle’den geçmez'),
            el('div.hint', { style: { lineHeight: '1.65' } },
              'Müşteri rezervasyon sırasında kart bilgisini verir, tutar yalnızca ',
              el('b', 'güvenceye alınır'),
              '. Gelmezse tahsilatı kendi sanal POS’unuzdan yaparsınız. Böylece cironuz eksilmez, ödeme aracılığı ve ek vergi yükü doğmaz.')
          )
        )
      ));

      if (chargeable.length) {
        wrap.appendChild(RZ.ui.sectionCard('Tahsil edilmeyi bekleyen kaporalar', `${chargeable.length} kayıt`,
          el('div', chargeable.map((r) => {
            const cus = c.customers.find((x) => x.id === r.customerId);
            const svc = c.services.find((x) => x.id === r.serviceId) || {};
            return el('div.lrow',
              el('div.av-circle', { style: { background: 'var(--danger-soft)', color: 'var(--danger)' } }, U.initials(cus ? cus.name : '?')),
              el('div.grow',
                el('div', { style: { fontWeight: '580', fontSize: '14px' } }, cus ? cus.name : 'Misafir'),
                el('div.hint', `${U.dateStr(U.fromKey(r.date), 'md')} ${U.hhmm(r.start)} · ${svc.name} · gelmedi`)),
              el('div.mono-money', tl(r.deposit.amount)),
              el('button.btn.btn-sm.btn-danger', {
                onclick: async () => {
                  const ok = await RZ.ui.confirm({
                    title: 'Kaporayı tahsil et',
                    text: `${tl(r.deposit.amount)} tutarı ${cus ? cus.name : 'müşteri'} adına kayıtlı karttan, işletmenizin POS’u üzerinden çekilecek.`,
                    ok: 'Tahsil et', danger: true,
                  });
                  if (ok) { RZ.store.chargeDeposit(r.id); RZ.ui.toast('Kapora tahsil edildi.', 'ok'); RZ.app.rerender(); }
                },
              }, 'Tahsil et'));
          })), null));
        wrap.appendChild(el('div', { style: { height: '14px' } }));
      }

      /* Hangi hizmette kapora isteniyor */
      wrap.appendChild(RZ.ui.sectionCard('Kapora kuralları', 'Hangi hizmette ne kadar güvence alınsın',
        el('div', c.services.map((s) =>
          el('div.lrow',
            el('div.grow',
              el('div.t-sm', { style: { fontWeight: '560' } }, s.name),
              el('div.hint', `${s.duration} dk · ${tl(s.price)}`)),
            el('div.row', { style: { gap: '9px' } },
              el('input.input', {
                type: 'number', value: s.deposit || 0, style: { width: '110px', height: '34px' },
                onchange: (e) => { RZ.store.upsertService({ id: s.id, deposit: Number(e.target.value) }); RZ.ui.toast('Kapora tutarı güncellendi.', 'ok'); },
              }),
              el('span.hint', '₺'))
          )
        ))));

      wrap.appendChild(el('div', { style: { height: '14px' } }));
      wrap.appendChild(RZ.ui.sectionCard('Tüm kapora hareketleri', `${withDep.length} kayıt`,
        el('div.tbl-wrap', el('table.tbl',
          el('thead', el('tr', el('th', 'Tarih'), el('th', 'Müşteri'), el('th', 'Hizmet'), el('th.r', 'Tutar'), el('th.r', 'Durum'))),
          el('tbody', withDep.slice(0, 60).map((r) => {
            const cus = c.customers.find((x) => x.id === r.customerId);
            const svc = c.services.find((x) => x.id === r.serviceId) || {};
            return el('tr.clickable', { onclick: () => RZ.booking.openDetail(r.id) },
              el('td.t-sm', U.dateStr(U.fromKey(r.date), 'md') + ' ' + U.hhmm(r.start)),
              el('td.t-sm', cus ? cus.name : 'Misafir'),
              el('td.t-sm', svc.name),
              el('td.r', el('span.mono-money', tl(r.deposit.amount))),
              el('td.r', el('span.badge' + (r.deposit.status === 'charged' ? '.badge-money' : r.deposit.status === 'chargeable' ? '.badge-danger' : r.deposit.status === 'held' ? '.badge-violet' : ''),
                RZ.booking.depLabel(r.deposit.status).split(' —')[0])));
          }))))));
      return wrap;
    }
  };

  /* ================= PAKET & KREDİ ================= */
  RZ.views.packages = function (root) {
    root.appendChild(RZ.ui.guarded('packages', () => build()));

    function build() {
      const c = RZ.store.ctx();
      const sold = c.soldPackages;
      const revenue = U.sum(sold, (p) => p.price);
      const openCredits = U.sum(sold, (p) => p.credits - p.used);
      const liability = U.sum(sold, (p) => ((p.credits - p.used) / p.credits) * p.price);

      const wrap = el('div');
      wrap.appendChild(el('div.grid.g4', { style: { marginBottom: '14px' } },
        RZ.ui.kpi({ label: 'Satılan paket', icon: 'box', value: sold.length, foot: 'Aktif ön ödemeli paket' }),
        RZ.ui.kpi({ label: 'Peşin alınan nakit', icon: 'wallet', accent: 'money', value: tl(revenue), foot: 'Hizmet verilmeden tahsil edilen' }),
        RZ.ui.kpi({ label: 'Kullanılmamış hak', icon: 'clock', value: openCredits, foot: `Karşılığı ${tl(liability)} — yükümlülük` }),
        RZ.ui.kpi({ label: 'Paketli müşteri', icon: 'users', value: new Set(sold.map((p) => p.customerId)).size, foot: 'Bu müşteriler kolay kolay ayrılmaz' })
      ));

      wrap.appendChild(el('div.card.card-pad', { style: { marginBottom: '14px', background: 'var(--surface-2)' } },
        el('div.hint', { style: { lineHeight: '1.65' } },
          el('b', 'Neden önemli: '),
          'Parası paket olarak sistemde duran müşteri geri gelir, o müşteriyi tutan işletme de sistemi bırakmaz. ',
          'Modelde tutundurma (churn) tek en hassas değişkendir — paket satışı doğrudan onu iyileştirir.')
      ));

      wrap.appendChild(RZ.ui.sectionCard('Paket tanımları', 'Satışa açık ön ödemeli paketler',
        el('div', (c.biz.packageDefs || []).map((d) =>
          el('div.lrow',
            el('div.av-circle', { style: { background: 'var(--violet-soft)', color: 'var(--violet)' }, html: U.icon('box', 16) }),
            el('div.grow',
              el('div', { style: { fontWeight: '580', fontSize: '14px' } }, d.name),
              el('div.hint', `${d.credits} kullanım hakkı · ${d.validDays} gün geçerli · birim ${tl(d.price / d.credits)}`)),
            el('div.mono-money', tl(d.price)))
        ))));

      wrap.appendChild(el('div', { style: { height: '14px' } }));
      wrap.appendChild(RZ.ui.sectionCard('Satılan paketler', `${sold.length} kayıt`,
        el('div.tbl-wrap', el('table.tbl',
          el('thead', el('tr', el('th', 'Müşteri'), el('th', 'Paket'), el('th', 'Kullanım'), el('th.r', 'Tutar'), el('th.r', 'Bitiş'))),
          el('tbody', sold.map((p) => {
            const cus = c.customers.find((x) => x.id === p.customerId);
            return el('tr.clickable', { onclick: () => (location.hash = '#/panel/musteri/' + p.customerId) },
              el('td', el('div.row', { style: { gap: '9px' } },
                el('div.av-circle', { style: { width: '28px', height: '28px' } }, U.initials(cus ? cus.name : '?')),
                el('span.t-sm', cus ? cus.name : '—'))),
              el('td.t-sm', p.name),
              el('td', el('div', { style: { minWidth: '120px' } },
                el('div.hint', `${p.used} / ${p.credits}`),
                el('div.bar-track', { style: { marginTop: '4px' } },
                  el('span', { style: { width: (p.used / p.credits) * 100 + '%', background: 'var(--violet)' } })))),
              el('td.r', el('span.mono-money', tl(p.price))),
              el('td.r.t-sm.dim', U.dateStr(U.fromKey(p.expiresAt), 'md')));
          }))))));
      return wrap;
    }
  };

  /* ================= KAMPANYA ================= */
  RZ.views.campaigns = function (root) {
    root.appendChild(RZ.ui.guarded('campaigns', () => build()));

    function build() {
      const c = RZ.store.ctx();
      const today = new Date();
      const wrap = el('div');

      // Onumuzdeki 7 gunun bos araliklari
      const days = Array.from({ length: 7 }, (_, i) => U.dayKey(U.addDays(today, i)));
      const gapRows = [];
      days.forEach((k) => {
        S.gaps(c, k, 60).forEach((g) => gapRows.push(Object.assign({ date: k }, g)));
      });
      const lostCapacity = U.sum(gapRows, (g) => ((g.end - g.start) / 60)) ;
      const avgPrice = c.services.length ? U.sum(c.services, (s) => s.price) / c.services.length : 0;

      wrap.appendChild(el('div.grid.g3', { style: { marginBottom: '14px' } },
        RZ.ui.kpi({ label: 'Önümüzdeki 7 günde boş aralık', icon: 'clock', value: gapRows.length, foot: `${Math.round(lostCapacity)} saat kapasite` }),
        RZ.ui.kpi({ label: 'Potansiyel gelir', icon: 'trend', accent: 'money', value: tl(lostCapacity * avgPrice, { compact: true }), foot: 'Boş kapasitenin tam karşılığı' }),
        RZ.ui.kpi({ label: 'Kampanya dönüşümü', icon: 'mega', value: c.campaigns.length ? '%' + Math.round((U.sum(c.campaigns, (x) => x.redeemed) / Math.max(1, U.sum(c.campaigns, (x) => x.audience))) * 100) : '—', foot: 'Geçmiş kampanyalarda' })
      ));

      wrap.appendChild(RZ.ui.sectionCard('Doldurulmayı bekleyen saatler', 'Kampanya bu boşlukları hedefler',
        el('div', { style: { maxHeight: '340px', overflow: 'auto' } },
          gapRows.length ? gapRows.slice(0, 40).map((g) => {
            const res = c.resources.find((r) => r.id === g.resourceId) || {};
            const d = U.fromKey(g.date);
            return el('div.lrow',
              el('div.time-chip', U.dateStr(d, 'md')),
              el('div.grow',
                el('div.t-sm', { style: { fontWeight: '560' } }, `${U.hhmm(g.start)} – ${U.hhmm(g.end)}`),
                el('div.hint', `${res.name} · ${Math.round((g.end - g.start) / 60 * 10) / 10} saat boş`)),
              el('button.btn.btn-sm.btn-ghost', { onclick: () => campaignModal(c, g) }, 'Kampanya kur'));
          }) : RZ.ui.emptyState(
            'Boş aralık yok',
            'Önümüzdeki 7 gün dolu görünüyor — kampanyaya ihtiyacınız yok. Doluluk düştüğünde bu liste kendiliğinden dolar.',
            'check',
            { label: 'Takvimi gör', icon: 'calendar', onClick: () => (location.hash = '#/panel/takvim') })),
        el('button.btn.btn-primary.btn-sm', { onclick: () => campaignModal(c, null) },
          el('span', { html: U.icon('plus', 15) }), 'Yeni kampanya')));

      wrap.appendChild(el('div', { style: { height: '14px' } }));
      wrap.appendChild(RZ.ui.sectionCard('Gönderilen kampanyalar', `${c.campaigns.length} kampanya`,
        el('div', c.campaigns.length ? c.campaigns.slice().reverse().map((cm) =>
          el('div.lrow',
            el('div.av-circle', { style: { background: 'var(--brand-soft)', color: 'var(--brand-ink)' }, html: U.icon('mega', 16) }),
            el('div.grow',
              el('div', { style: { fontWeight: '580', fontSize: '14px' } }, cm.title),
              el('div.hint', `${cm.window || ''} · %${cm.discount} indirim · ${new Date(cm.createdAt).toLocaleDateString('tr-TR')}`)),
            el('div', { style: { textAlign: 'right' } },
              el('div.t-sm', { style: { fontWeight: '620' } }, `${cm.redeemed} / ${cm.audience}`),
              el('div.hint', 'kullanan / ulaşılan')))
        ) : RZ.ui.emptyState(
          'Henüz kampanya gönderilmedi',
          'Doluluğun düştüğü saatlere hedefli indirim duyurusu gönderin. Geçmiş kampanyaların kaç kişiye ulaştığı ve kaçının rezervasyona döndüğü burada birikir.',
          'mega',
          { label: 'İlk kampanyayı kur', icon: 'plus', onClick: () => campaignModal(RZ.store.ctx(), null) }))));
      return wrap;
    }
  };

  function campaignModal(c, gap) {
    const state = {
      title: gap ? `${U.dateStr(U.fromKey(gap.date), 'md')} ${U.hhmm(gap.start)} boş saat fırsatı` : 'Hafta içi gündüz indirimi',
      discount: 20,
      audience: 'lost',
      window: gap ? `${U.dateStr(U.fromKey(gap.date), 'dayName')} · ${U.hhmm(gap.start)}–${U.hhmm(gap.end)}` : 'Pzt–Per · 10:00–16:00',
    };
    const ins = A.customerInsights(c, { lostAfter: 60 });
    const sizes = {
      all: c.customers.length,
      lost: ins.lost.length,
      loyal: ins.all.filter((x) => x.visits >= 5).length,
      recent: ins.all.filter((x) => x.lastVisit && x.lastVisit >= U.dayKey(U.addDays(new Date(), -30))).length,
    };
    const labels = { all: 'Tüm müşteriler', lost: 'Kaybolan müşteriler', loyal: 'Sadık müşteriler', recent: 'Son 30 günde gelenler' };

    const body = el('div.stack');
    const render = () => {
      body.innerHTML = '';
      body.appendChild(el('div.field', el('label', 'Kampanya başlığı'),
        el('input.input', { value: state.title, oninput: (e) => (state.title = e.target.value) })));
      body.appendChild(el('div.grid.g2',
        el('div.field', el('label', 'İndirim oranı'),
          el('select.select', { onchange: (e) => { state.discount = Number(e.target.value); render(); } },
            [10, 15, 20, 25, 30].map((d) => el('option', { value: d, selected: d === state.discount }, '%' + d)))),
        el('div.field', el('label', 'Geçerlilik'),
          el('input.input', { value: state.window, oninput: (e) => (state.window = e.target.value) }))
      ));
      body.appendChild(el('div.field', el('label', 'Hedef kitle'),
        el('div.row.wrap', { style: { gap: '7px' } },
          Object.keys(labels).map((k) =>
            el('button.chip-tog' + (state.audience === k ? '.on' : ''), {
              onclick: () => { state.audience = k; render(); },
            }, `${labels[k]} · ${sizes[k]}`)))));
      const cost = sizes[state.audience];
      body.appendChild(el('div.card.card-pad', { style: { background: 'var(--surface-2)' } },
        el('div.row-b', el('span.t-sm', 'Ulaşılacak kişi'), el('b', U.fmtNum(cost))),
        el('div.row-b', el('span.t-sm', 'SMS kotasından düşecek'), el('b', U.fmtNum(cost))),
        el('div.row-b', el('span.t-sm.dim', 'Beklenen dönüşüm (%12)'), el('b', { style: { color: 'var(--money)' } }, Math.round(cost * 0.12) + ' rezervasyon'))));
    };
    render();

    RZ.ui.modal({
      title: 'Kampanya oluştur',
      sub: 'Boş kapasiteyi hedefli indirimle ciroya çevirin',
      body,
      actions: [
        { label: 'Vazgeç' },
        { label: 'Kampanyayı gönder', kind: 'btn-primary', onClick: () => {
            RZ.store.createCampaign({
              title: state.title, discount: state.discount,
              window: state.window, audience: sizes[state.audience], redeemed: 0,
            });
            RZ.ui.toast(`Kampanya <b>${U.fmtNum(sizes[state.audience])} kişiye</b> gönderildi.`, 'ok');
            RZ.app.rerender();
          } },
      ],
    });
  }
})(window.RZ);
