/* Rezervle — rezervasyon formu ve detay cekmecesi
   Cakisma kontrolu form yazilirken canli calisir: kaydet dugmesi ancak slot gercekten bossa aktif olur. */
(function (RZ) {
  'use strict';
  const U = RZ.util;
  const S = RZ.schedule;
  const el = U.el;
  const tl = U.tl;

  /* ---------------- Yeni / duzenle formu ---------------- */
  function openBooking(opts) {
    const o = opts || {};
    const c = RZ.store.ctx();
    const biz = c.biz;

    // Kurulum tamamlanmadan rezervasyon acilamaz: ham hata yerine ne yapilacagini soyle.
    if (!c.services.length || !c.resources.length) {
      return RZ.ui.modal({
        title: 'Önce kurulumu tamamlayın',
        sub: biz.name,
        body: el('div.stack',
          el('p.dim.t-sm', { style: { lineHeight: '1.6' } },
            !c.resources.length
              ? 'Rezervasyon açabilmek için en az bir kaynak (saha, koltuk, kabin, masa) tanımlı olmalı. Çakışma engeli kaynak üzerinden çalışır.'
              : 'Rezervasyon açabilmek için en az bir hizmet ve fiyatı tanımlı olmalı. Ciro raporu bu fiyattan oluşur.'),
          el('div.hint', 'Tanımladıktan sonra bu ekrana geri dönebilirsiniz.')),
        actions: [
          { label: 'Vazgeç' },
          { label: 'Ayarlara git', kind: 'btn-primary', onClick: () => { location.hash = '#/panel/ayarlar'; } },
        ],
      });
    }
    const editing = o.reservationId ? c.reservations.find((r) => r.id === o.reservationId) : null;

    const state = {
      date: editing ? editing.date : o.date || U.dayKey(new Date()),
      serviceId: editing ? editing.serviceId : (o.serviceId || c.services[0].id),
      resourceId: editing ? editing.resourceId : o.resourceId || null,
      staffId: editing ? editing.staffId : null,
      start: editing ? editing.start : o.start != null ? o.start : null,
      customerId: editing ? editing.customerId : null,
      guestName: '',
      guestPhone: '',
      channel: editing ? editing.channel : 'phone',
      price: editing ? editing.price : null,
      note: editing ? editing.note : '',
      useDeposit: editing ? !!(editing.deposit && editing.deposit.amount) : true,
      packageId: null,
    };

    const svcOf = (id) => c.services.find((s) => s.id === id);
    const resOf = (id) => c.resources.find((s) => s.id === id);

    function fitResource() {
      const svc = svcOf(state.serviceId);
      const okList = c.resources.filter((r) => !r.closed && (!svc.resourceTypes || svc.resourceTypes.includes(r.type)));
      if (!state.resourceId || !okList.find((r) => r.id === state.resourceId)) {
        state.resourceId = okList.length ? okList[0].id : null;
      }
      return okList;
    }
    fitResource();

    const body = el('div.stack');
    const api = RZ.ui.modal({
      title: editing ? 'Rezervasyonu düzenle' : 'Yeni rezervasyon',
      sub: biz.name,
      wide: true,
      body,
      actions: [
        { label: 'Vazgeç' },
        { label: editing ? 'Değişikliği kaydet' : 'Rezervasyonu oluştur', kind: 'btn-primary', id: 'bk-save', close: false, onClick: submit },
      ],
    });

    function draft() {
      const svc = svcOf(state.serviceId);
      return {
        bizId: biz.id, date: state.date, resourceId: state.resourceId,
        staffId: state.staffId,
        start: state.start == null ? -1 : state.start,
        end: state.start == null ? -1 : state.start + svc.duration,
      };
    }

    function check() {
      if (state.start == null) return { ok: false, errors: [{ msg: 'Saat seçin.' }], warnings: [] };
      return S.validate(
        { biz, reservations: c.reservations.map(RZ.store.decorate), resources: c.resources },
        draft(), editing ? editing.id : null
      );
    }

    /* --- render --- */
    function render() {
      body.innerHTML = '';
      const svc = svcOf(state.serviceId);
      const resList = fitResource();
      const cust = c.customers.find((x) => x.id === state.customerId);

      /* 1. Musteri */
      const searchInput = el('input.input', {
        placeholder: 'İsim veya telefon ile ara… (kapıdan geldiyse yeni kayıt açın)',
        value: cust ? `${cust.name} · ${cust.phone}` : '',
        oninput: (e) => showSuggest(e.target.value, e.target),
        onfocus: (e) => showSuggest(e.target.value, e.target),
      });
      const sug = el('div.card', {
        style: { position: 'absolute', zIndex: '9', left: '0', right: '0', top: '44px', maxHeight: '220px', overflow: 'auto', display: 'none', boxShadow: 'var(--sh-2)' },
      });
      function showSuggest(q, input) {
        const nq = U.norm(q);
        const hits = c.customers
          .filter((x) => !nq || U.norm(x.name).includes(nq) || String(x.phone).replace(/\D/g, '').includes(q.replace(/\D/g, '')))
          .slice(0, 6);
        sug.innerHTML = '';
        hits.forEach((h) =>
          sug.appendChild(el('div.lrow.clickable', {
            onclick: () => {
              state.customerId = h.id; state.guestName = ''; sug.style.display = 'none'; render();
            },
          },
            el('div.av-circle', U.initials(h.name)),
            el('div.grow', el('div', { style: { fontWeight: '580', fontSize: '14px' } }, h.name), el('div.hint', U.phoneFmt(h.phone))),
            el('span.hint', RZ.store.get().reservations.filter((r) => r.customerId === h.id).length + ' kayıt')
          ))
        );
        if (q && !hits.length) {
          sug.appendChild(el('div.lrow.clickable', {
            onclick: () => {
              state.customerId = null; state.guestName = q; sug.style.display = 'none'; render();
            },
          },
            el('div.av-circle', { style: { background: 'var(--brand-soft)', color: 'var(--brand-ink)' }, html: U.icon('plus', 16) }),
            el('div.grow', el('div', { style: { fontWeight: '580', fontSize: '14px' } }, `"${q}" adıyla yeni müşteri`), el('div.hint', 'Telefonu aşağıda girebilirsiniz'))
          ));
        }
        sug.style.display = sug.children.length ? 'block' : 'none';
      }
      document.addEventListener('click', (e) => {
        if (!sug.contains(e.target) && e.target !== searchInput) sug.style.display = 'none';
      });

      body.appendChild(el('div.field', { style: { position: 'relative' } },
        el('label', 'Müşteri'),
        searchInput,
        sug,
        state.guestName
          ? el('div.row', { style: { marginTop: '8px', gap: '8px' } },
              el('span.badge.badge-brand', 'Yeni: ' + state.guestName),
              el('input.input', {
                placeholder: 'Telefon (SMS hatırlatma için)', style: { height: '34px', maxWidth: '220px' },
                value: state.guestPhone, oninput: (e) => (state.guestPhone = e.target.value),
              })
            )
          : null
      ));

      /* 2. Hizmet + kaynak */
      body.appendChild(el('div.grid.g2',
        el('div.field',
          el('label', 'Hizmet'),
          el('select.select', {
            onchange: (e) => { state.serviceId = e.target.value; state.price = null; render(); },
          }, c.services.map((s) => el('option', { value: s.id, selected: s.id === state.serviceId }, `${s.name} · ${s.duration} dk · ${tl(s.price)}`)))
        ),
        el('div.field',
          el('label', 'Kaynak'),
          el('select.select', { onchange: (e) => { state.resourceId = e.target.value; render(); } },
            resList.map((r) => el('option', { value: r.id, selected: r.id === state.resourceId }, r.name)))
        )
      ));

      /* 3. Tarih + saat */
      body.appendChild(el('div.grid.g2',
        el('div.field',
          el('label', 'Tarih'),
          el('input.input', { type: 'date', value: state.date, onchange: (e) => { state.date = e.target.value; state.start = null; render(); } })
        ),
        c.staff.length
          ? el('div.field',
              el('label', 'Personel'),
              el('select.select', { onchange: (e) => { state.staffId = e.target.value || null; render(); } },
                el('option', { value: '' }, 'Atanmadı'),
                c.staff.map((s) => el('option', { value: s.id, selected: s.id === state.staffId }, `${s.name} · ${s.role}`)))
            )
          : el('div.field',
              el('label', 'Kanal'),
              el('select.select', { onchange: (e) => (state.channel = e.target.value) },
                Object.entries(S.CHANNEL).map(([k, v]) => el('option', { value: k, selected: k === state.channel }, v.label)))
            )
      ));

      /* 4. Uygun saatler */
      const slots = S.freeSlots(
        { biz, reservations: c.reservations, resources: c.resources },
        { date: state.date, duration: svc.duration, step: 30, resourceId: state.resourceId }
      );
      const slotWrap = el('div.row.wrap', { style: { gap: '6px' } });
      if (!slots.length) {
        slotWrap.appendChild(el('div.hint', 'Bu kaynakta bugün uygun saat kalmadı. Başka kaynak veya tarih seçin.'));
      }
      slots.forEach((s) => {
        const on = state.start === s.start;
        slotWrap.appendChild(el('button.chip-tog' + (on ? '.on' : ''), {
          onclick: () => { state.start = s.start; render(); },
        }, U.hhmm(s.start)));
      });
      body.appendChild(el('div.field',
        el('label', `Uygun saatler · ${U.dateStr(U.fromKey(state.date), 'dayName')} · ${resOf(state.resourceId) ? resOf(state.resourceId).name : ''}`),
        el('div', { style: { maxHeight: '116px', overflow: 'auto', padding: '2px' } }, slotWrap),
        el('div.hint', 'Sadece gerçekten boş olan saatler listelenir — çakışma ihtimali sıfırdır.')
      ));

      /* 5. Ucret + kapora */
      const depOn = RZ.plans.can(biz, 'deposit');
      body.appendChild(el('div.grid.g2',
        el('div.field',
          el('label', 'Ücret'),
          el('input.input', {
            type: 'number', value: state.price != null ? state.price : svc.price,
            oninput: (e) => (state.price = Number(e.target.value)),
          }),
          el('div.hint', 'Rezervasyon tamamlandığında ciroya bu tutar işlenir.')
        ),
        el('div.field',
          el('label', 'Kapora'),
          svc.deposit
            ? depOn
              ? el('label.row', { style: { gap: '8px', height: '40px', cursor: 'pointer' } },
                  el('input', { type: 'checkbox', checked: state.useDeposit, onchange: (e) => (state.useDeposit = e.target.checked) }),
                  el('span.t-sm', `${tl(svc.deposit)} güvence al`)
                )
              : el('button.btn.btn-ghost.btn-sm', { onclick: () => RZ.ui.upgradeModal('deposit') },
                  el('span', { html: U.icon('lock', 14) }), 'Kapora modülünü aç')
            : el('div.hint', { style: { paddingTop: '11px' } }, 'Bu hizmette kapora tanımlı değil.'),
          svc.deposit && depOn ? el('div.hint', 'Kart saklanır, tahsilat yapılmaz. Gelmezse kendi POS’unuzdan kesersiniz.') : null
        )
      ));

      body.appendChild(el('div.field',
        el('label', 'Not (opsiyonel)'),
        el('input.input', { value: state.note, placeholder: 'Örn. kaleci filesi istendi', oninput: (e) => (state.note = e.target.value) })
      ));

      /* 6. Canli dogrulama satiri */
      const v = check();
      const box = el('div', { style: { marginTop: '2px' } });
      if (state.start == null) {
        box.appendChild(el('div.hint', 'Devam etmek için bir saat seçin.'));
      } else if (!v.ok) {
        box.appendChild(el('div.card.card-pad', { style: { borderColor: 'var(--danger)', background: 'var(--danger-soft)', padding: '11px 14px' } },
          el('div.row', { style: { gap: '9px', alignItems: 'flex-start', color: 'var(--danger)' } },
            el('span', { html: U.icon('alert', 17) }),
            el('div', v.errors.map((e2) => el('div.t-sm', { style: { fontWeight: '560' } }, e2.msg)))
          )
        ));
      } else {
        box.appendChild(el('div.card.card-pad', { style: { borderColor: 'var(--money)', background: 'var(--money-soft)', padding: '11px 14px' } },
          el('div.row', { style: { gap: '9px', color: 'var(--money)' } },
            el('span', { html: U.icon('check', 17) }),
            el('div.t-sm', { style: { fontWeight: '560' } },
              `${U.hhmm(state.start)}–${U.hhmm(state.start + svc.duration)} · ${resOf(state.resourceId).name} müsait.`)
          ),
          v.warnings.length ? el('div.hint', { style: { marginTop: '6px', color: 'var(--warn)' } }, v.warnings.map((w) => w.msg).join(' ')) : null
        ));
      }
      body.appendChild(box);

      const saveBtn = document.getElementById('bk-save');
      if (saveBtn) saveBtn.disabled = !v.ok;
    }

    function submit() {
      const v = check();
      if (!v.ok) { RZ.ui.toast(v.errors[0].msg, 'err'); return false; }
      const svc = svcOf(state.serviceId);
      let customerId = state.customerId;
      if (!customerId && state.guestName) {
        customerId = RZ.store.upsertCustomer({ name: state.guestName, phone: state.guestPhone || '' }).id;
      }
      const payload = {
        customerId, guestName: customerId ? null : state.guestName || 'Misafir',
        serviceId: state.serviceId, resourceId: state.resourceId, staffId: state.staffId,
        date: state.date, start: state.start, end: state.start + svc.duration,
        channel: state.channel, price: state.price != null ? state.price : svc.price,
        note: state.note,
        deposit: state.useDeposit && svc.deposit && RZ.plans.can(biz, 'deposit')
          ? { amount: svc.deposit, status: 'held', method: 'card' } : null,
        status: 'confirmed',
      };
      const res = editing
        ? RZ.store.updateReservation(editing.id, payload)
        : RZ.store.addReservation(payload);
      if (!res.ok) { RZ.ui.toast(res.errors[0].msg, 'err'); return false; }
      RZ.ui.toast(
        `<b>${U.hhmm(state.start)}</b> · ${resOf(state.resourceId).name} rezervasyonu kaydedildi.` +
        (payload.deposit ? ' Kapora güvenceye alındı.' : ''), 'ok');
      api.close();
      return true;
    }

    render();
    return api;
  }

  /* ---------------- Detay cekmecesi ---------------- */
  function openDetail(id) {
    const render = (api) => {
      const c = RZ.store.ctx();
      const r = c.reservations.find((x) => x.id === id);
      if (!r) return el('div', 'Kayıt bulunamadı.');
      const svc = c.services.find((s) => s.id === r.serviceId) || {};
      const res = c.resources.find((s) => s.id === r.resourceId) || {};
      const cus = c.customers.find((s) => s.id === r.customerId);
      const stf = c.staff.find((s) => s.id === r.staffId);
      const past = r.date < U.dayKey(new Date());
      const history = cus ? c.reservations.filter((x) => x.customerId === cus.id) : [];
      const spent = U.sum(history.filter((x) => x.status === 'completed'), (x) => x.price);
      const ns = history.filter((x) => x.status === 'no_show').length;

      const act = (label, status, kind) =>
        el('button.btn.btn-sm.' + (kind || 'btn-ghost'), {
          onclick: () => { RZ.store.setStatus(r.id, status); RZ.ui.toast('Durum güncellendi: ' + S.STATUS[status].label, 'ok'); api.rerender(); },
        }, label);

      return el('div.stack',
        el('div.row', { style: { gap: '10px' } },
          RZ.ui.statusBadge(r.status),
          el('span.badge', el('span', { html: U.icon(S.CHANNEL[r.channel].icon, 12) }), S.CHANNEL[r.channel].short),
          r.deposit ? el('span.badge.badge-violet', el('span', { html: U.icon('shield', 12) }), 'Kapora ' + tl(r.deposit.amount)) : null
        ),
        el('div',
          el('div', { style: { fontSize: '21px', fontWeight: '680', letterSpacing: '-.02em' } },
            `${U.hhmm(r.start)} – ${U.hhmm(r.end)}`),
          el('div.dim.t-sm', `${U.dateStr(U.fromKey(r.date), 'long')} · ${res.name}`)
        ),
        el('div.card',
          el('div.lrow', el('div.grow.t-sm.dim', 'Hizmet'), el('div', { style: { fontWeight: '580' } }, svc.name)),
          el('div.lrow', el('div.grow.t-sm.dim', 'Ücret'), el('div.mono-money', tl(r.price))),
          stf ? el('div.lrow', el('div.grow.t-sm.dim', 'Personel'), el('div', stf.name)) : null,
          r.note ? el('div.lrow', el('div.grow.t-sm.dim', 'Not'), el('div.t-sm', r.note)) : null,
          r.checkinAt ? el('div.lrow', el('div.grow.t-sm.dim', 'QR giriş'), el('span.badge.badge-cyan', 'Doğrulandı')) : null
        ),
        cus
          ? el('div.card',
              el('div.lrow',
                el('div.av-circle', U.initials(cus.name)),
                el('div.grow',
                  el('div', { style: { fontWeight: '620' } }, cus.name),
                  el('div.hint', U.phoneFmt(cus.phone))
                ),
                el('button.btn.btn-sm.btn-quiet', { onclick: () => { api.close(); location.hash = '#/panel/musteri/' + cus.id; } }, 'Kart')
              ),
              el('div.grid.g3', { style: { padding: '12px 14px', gap: '9px' } },
                el('div.stat-mini', el('div.l', 'Ziyaret'), el('div.v', history.filter((x) => x.status === 'completed').length)),
                el('div.stat-mini', el('div.l', 'Harcama'), el('div.v', tl(spent, { compact: true }))),
                el('div.stat-mini', el('div.l', 'Gelmediği'), el('div.v', { style: ns ? { color: 'var(--danger)' } : null }, ns))
              )
            )
          : null,

        el('div',
          el('div.hint', { style: { marginBottom: '7px' } }, 'Durum'),
          el('div.row.wrap', { style: { gap: '7px' } },
            r.status === 'pending' ? act('Onayla', 'confirmed', 'btn-primary') : null,
            !past && r.status !== 'arrived' && r.status !== 'completed' ? act('Geldi (giriş)', 'arrived') : null,
            r.status !== 'completed' ? act('Tamamlandı', 'completed', 'btn-money') : null,
            r.status !== 'no_show' ? act('Gelmedi', 'no_show', 'btn-danger') : null,
            r.status !== 'cancelled' ? act('İptal et', 'cancelled') : null
          )
        ),

        r.deposit
          ? el('div.card.card-pad', { style: { background: 'var(--violet-soft)', borderColor: 'transparent' } },
              el('div.row-b',
                el('div',
                  el('div', { style: { fontWeight: '620', fontSize: '14px' } }, 'Kapora · ' + tl(r.deposit.amount)),
                  el('div.hint', depLabel(r.deposit.status))
                ),
                r.deposit.status === 'chargeable'
                  ? el('button.btn.btn-sm.btn-danger', {
                      onclick: async () => {
                        const ok = await RZ.ui.confirm({
                          title: 'Kaporayı tahsil et',
                          text: `${tl(r.deposit.amount)} tutarındaki kapora, işletmenizin sanal POS’undan çekilecek. Rezervle bu tutara aracılık etmez; para doğrudan sizin hesabınıza geçer.`,
                          ok: 'Tahsil et', danger: true,
                        });
                        if (ok) { RZ.store.chargeDeposit(r.id); RZ.ui.toast('Kapora tahsil edildi.', 'ok'); api.rerender(); }
                      },
                    }, 'Tahsil et')
                  : r.deposit.status === 'held'
                    ? el('button.btn.btn-sm.btn-ghost', { onclick: () => { RZ.store.releaseDeposit(r.id); api.rerender(); } }, 'Serbest bırak')
                    : null
              )
            )
          : null,

        el('div.row', { style: { gap: '7px', flexWrap: 'wrap' } },
          el('button.btn.btn-sm.btn-ghost', {
            onclick: () => { api.close(); openBooking({ reservationId: r.id }); },
          }, el('span', { html: U.icon('calendar', 14) }), 'Düzenle / taşı'),
          el('button.btn.btn-sm.btn-ghost', {
            onclick: () => {
              const b = RZ.store.biz();
              b.smsUsed = (b.smsUsed || 0) + 1;
              RZ.ui.toast(`Hatırlatma SMS’i gönderildi · ${cus ? U.phoneFmt(cus.phone) : 'misafir'}`, 'ok');
            },
          }, el('span', { html: U.icon('sms', 14) }), 'Hatırlatma gönder'),
          el('button.btn.btn-sm.btn-quiet', {
            style: { color: 'var(--danger)' },
            onclick: async () => {
              const ok = await RZ.ui.confirm({ title: 'Kaydı sil', text: 'Bu rezervasyon kalıcı olarak silinecek. Ciro raporundan da düşer.', ok: 'Sil', danger: true });
              if (ok) { RZ.store.removeReservation(r.id); RZ.ui.toast('Kayıt silindi.'); api.close(); }
            },
          }, 'Sil')
        )
      );
    };

    const api = RZ.ui.drawer({ title: 'Rezervasyon detayı', body: (a) => render(Object.assign(a, { rerender })) });
    function rerender() {
      const body = api.node.querySelector('.modal-body');
      body.innerHTML = '';
      body.appendChild(render(Object.assign(api, { rerender })));
    }
    return api;
  }

  function depLabel(s) {
    return {
      held: 'Kart güvencede — tahsilat yapılmadı',
      chargeable: 'Müşteri gelmedi — tahsil edilebilir',
      charged: 'Tahsil edildi (işletme POS’u)',
      released: 'Ziyaret tamamlandı, serbest bırakıldı',
    }[s] || s;
  }

  RZ.booking = { openBooking, openDetail, depLabel };
})(window.RZ);
