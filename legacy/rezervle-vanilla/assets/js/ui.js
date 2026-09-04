/* Rezervle — ortak arayüz parçaları: bildirim, pencere, çekmece,
   sayı bloğu, sütun grafiği + rezervasyon formu ve detayı. */
RZ.ui = (function () {
  const u = RZ.u, s = RZ.sched, el = u.el;

  /* ------------------------------ bildirim ------------------------------ */
  function toast(msg, bad) {
    let host = document.getElementById('toast');
    if (!host) { host = el('div#toast'); document.body.appendChild(host); }
    const t = el('div.toast' + (bad ? '.bad' : ''), { html: msg });
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s'; setTimeout(() => t.remove(), 220); }, 3000);
  }

  /* ------------------------------ katmanlar ------------------------------ */
  let stack = [];
  const closeTop = () => { const l = stack.pop(); if (l) l.kill(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) closeTop(); });

  function layer(node, onClose) {
    const scrim = el('div.scrim', { onclick: () => api.close() });
    document.body.appendChild(scrim);
    document.body.appendChild(node);
    document.body.style.overflow = 'hidden';
    const api = {
      node,
      kill() {
        node.remove(); scrim.remove();
        stack = stack.filter((x) => x !== api);
        if (!stack.length) document.body.style.overflow = '';
        if (onClose) onClose();
      },
      close() { api.kill(); },
    };
    stack.push(api);
    const f = node.querySelector('input,select,textarea,button');
    if (f) setTimeout(() => f.focus(), 50);
    return api;
  }

  /** dialog({title, sub, body, actions:[{label,kind,run,keepOpen}]}) */
  function dialog(o) {
    const body = el('div.body-s');
    const node = el('div.dlg', { role: 'dialog', 'aria-modal': 'true' },
      el('header',
        el('div', el('h2', o.title), o.sub ? el('div.hint', { style: { marginTop: '3px' } }, o.sub) : null),
        el('button.ico-btn', { html: u.icon('x', 17), 'aria-label': 'Kapat', onclick: () => api.close() })),
      body);
    const api = layer(node, o.onClose);
    const content = typeof o.body === 'function' ? o.body(api) : o.body;
    if (content) body.appendChild(content);
    if (o.actions && o.actions.length) {
      const f = el('footer');
      o.actions.forEach((a) => {
        const b = el('button.btn' + (a.kind ? '.' + a.kind : ''), a.label);
        if (a.id) b.id = a.id;
        b.onclick = () => { const res = a.run ? a.run(api) : true; if (!a.keepOpen && res !== false) api.close(); };
        f.appendChild(b);
      });
      node.appendChild(f);
    }
    return api;
  }

  /** sheet({title, sub, body(api), actions}) — sağdan çekmece */
  function sheet(o) {
    const body = el('div.body-s');
    const node = el('div.sheet', { role: 'dialog', 'aria-modal': 'true' },
      el('header',
        el('div', el('h2', o.title), o.sub ? el('div.hint', { style: { marginTop: '3px' } }, o.sub) : null),
        el('button.ico-btn', { html: u.icon('x', 17), 'aria-label': 'Kapat', onclick: () => api.close() })),
      body);
    const api = layer(node, o.onClose);
    api.redraw = (fn) => { body.innerHTML = ''; body.appendChild(fn(api)); };
    const c = typeof o.body === 'function' ? o.body(api) : o.body;
    if (c) body.appendChild(c);
    return api;
  }

  const ask = (o) => new Promise((res) => dialog({
    title: o.title,
    body: el('p.dim', { style: { fontSize: '13.5px', lineHeight: '1.6' } }, o.text),
    onClose: () => res(false),
    actions: [
      { label: o.cancel || 'Vazgeç', run: () => res(false) },
      { label: o.ok || 'Onayla', kind: o.danger ? 'danger' : 'primary', run: () => res(true) },
    ],
  }));

  /* ------------------------------ parçalar ------------------------------ */
  /** fig({k, v, d, lead, tone}) — başlık + rakam, kart değil */
  function fig(o) {
    return el('div.fig' + (o.lead ? '.lead' : ''),
      el('div.k', o.k),
      el('div.v' + (o.tone ? '.' + o.tone : ''), o.v),
      o.d ? el('div.d', o.d) : null);
  }

  /** Yüzde farkı satırı: yön + değer + neye göre */
  function delta(pct, base, invert) {
    if (pct == null || !isFinite(pct)) return null;
    const flat = Math.abs(pct) < 0.5;
    const up = pct > 0;
    const good = invert ? !up : up;
    return el('span', { class: flat ? '' : good ? 'pos' : 'neg' },
      flat ? '—' : (up ? '↑' : '↓') + ' ' + u.pctS(pct),
      base ? el('span.muted', ' ' + base) : null);
  }

  /** Günlük sütun grafiği — gelecek günler soluk (bekleyen) */
  function bars(days, o) {
    const opt = o || {};
    const max = Math.max(1, ...days.map((d) => Math.max(d.real, d.soon || 0)));
    const todayK = u.key(new Date());
    const wrap = el('div');
    const strip = el('div.bars');
    days.forEach((d) => {
      const future = d.key > todayK;
      const v = future ? (d.soon || 0) : d.real;
      const cell = el('div', { title: `${u.date(d.date, 'md')} · ${u.money(v)}` },
        el('i', { class: future ? 'soft' : '', style: { height: Math.max(1, (v / max) * 100) + '%' } }));
      strip.appendChild(cell);
    });
    wrap.appendChild(strip);
    if (opt.axis !== false && days.length) {
      wrap.appendChild(el('div.axis',
        el('span', u.date(days[0].date, 'md')),
        el('span', u.money(max, true)),
        el('span', u.date(days[days.length - 1].date, 'md'))));
    }
    return wrap;
  }

  /** Kırılım listesi: ad — tutar — oran çubuğu */
  function breakdown(rows, opt) {
    const o = opt || {};
    if (!rows.length) return empty('Bu dönemde kayıt yok');
    const max = Math.max(...rows.map((r) => r.total), 1);
    const tot = u.sum(rows, (r) => r.total) || 1;
    return el('div', rows.slice(0, o.limit || 6).map((r) =>
      el('div', { style: { padding: '9px 0' } },
        el('div.between', { style: { marginBottom: '5px' } },
          el('span', { style: { fontSize: '13px' } }, r.name),
          el('span.n', { style: { fontSize: '13px' } }, u.money(r.total))),
        el('div.meter', el('i', { style: { width: (r.total / max) * 100 + '%' } })),
        el('div.hint', { style: { marginTop: '4px' } }, `${r.n} rezervasyon · toplamın %${Math.round((r.total / tot) * 100)}’i`))));
  }

  const status = (k) => {
    const st = s.STATUS[k];
    return el('span.st' + (st.c ? '.' + st.c : ''), el('i'), st.t);
  };

  function empty(title, text, action) {
    return el('div.empty',
      el('b', title),
      text ? el('p', text) : null,
      action ? el('button.btn.sm', { onclick: action.run }, action.label) : null);
  }

  const panel = (title, sub, body, tools) =>
    el('div.panel',
      el('header', el('div', el('h2', title), sub ? el('div.sub', sub) : null), tools || null),
      body);

  /* ------------------------- rezervasyon formu ------------------------- */
  function book(opts) {
    const o = opts || {};
    const c = RZ.store.ctx();
    const edit = o.id ? c.reservations.find((r) => r.id === o.id) : null;

    const f = {
      date: edit ? edit.date : o.date || u.key(new Date()),
      serviceId: edit ? edit.serviceId : c.services[0].id,
      resourceId: edit ? edit.resourceId : o.resourceId || null,
      start: edit ? edit.start : (o.start != null ? o.start : null),
      customerId: edit ? edit.customerId : (o.customerId || null),
      newName: '', newPhone: '',
      channel: edit ? edit.channel : 'phone',
      price: edit ? edit.price : null,
      deposit: edit ? !!edit.deposit : false,
      note: edit ? edit.note : '',
    };
    const svcOf = (id) => c.services.find((x) => x.id === id);
    const resOf = (id) => c.resources.find((x) => x.id === id);

    function fitRes() {
      const sv = svcOf(f.serviceId);
      const ok = c.resources.filter((r) => !r.closed && (!sv.types || sv.types.includes(r.type)));
      if (!f.resourceId || !ok.find((r) => r.id === f.resourceId)) f.resourceId = ok.length ? ok[0].id : null;
      return ok;
    }
    fitRes();

    const body = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
    const api = dialog({
      title: edit ? 'Rezervasyonu düzenle' : 'Yeni rezervasyon',
      body,
      actions: [
        { label: 'Vazgeç' },
        { label: edit ? 'Kaydet' : 'Oluştur', kind: 'primary', id: 'bk-ok', keepOpen: true, run: submit },
      ],
    });

    function draft() {
      const sv = svcOf(f.serviceId);
      return { date: f.date, resourceId: f.resourceId, start: f.start == null ? -1 : f.start,
        end: f.start == null ? -1 : f.start + sv.duration };
    }
    const verify = () => f.start == null
      ? { ok: false, errors: ['Saat seçin.'], warnings: [] }
      : s.check(c, draft(), edit ? edit.id : null);

    function draw() {
      body.innerHTML = '';
      const sv = svcOf(f.serviceId);
      const resList = fitRes();
      const who = c.customers.find((x) => x.id === f.customerId);

      /* müşteri */
      const sug = el('div.panel', { style: { position: 'absolute', left: 0, right: 0, top: '38px', zIndex: 9, maxHeight: '190px', overflow: 'auto', display: 'none' } });
      const inp = el('input.inp', {
        placeholder: 'İsim veya telefon ara — yoksa yeni kayıt aç',
        value: who ? `${who.name} · ${u.phone(who.phone)}` : f.newName,
        oninput: (e) => hits(e.target.value), onfocus: (e) => hits(e.target.value),
      });
      function hits(q) {
        const nq = u.norm(q), dq = q.replace(/\D/g, '');
        const list = c.customers.filter((x) => !nq || u.norm(x.name).includes(nq) || (dq && String(x.phone).replace(/\D/g, '').includes(dq))).slice(0, 6);
        sug.innerHTML = '';
        const rows = el('div.rows');
        list.forEach((h) => rows.appendChild(el('button', { onclick: () => { f.customerId = h.id; f.newName = ''; sug.style.display = 'none'; draw(); } },
          el('span.grow', el('div', { style: { fontSize: '13px', fontWeight: '550' } }, h.name), el('div.hint.n', u.phone(h.phone))),
          el('span.hint.n', c.reservations.filter((r) => r.customerId === h.id).length))));
        if (q && !list.length) rows.appendChild(el('button', { onclick: () => { f.customerId = null; f.newName = q; sug.style.display = 'none'; draw(); } },
          el('span.grow', `"${q}" adıyla yeni müşteri`)));
        sug.appendChild(rows);
        sug.style.display = rows.children.length ? 'block' : 'none';
      }
      document.addEventListener('click', (e) => { if (!sug.contains(e.target) && e.target !== inp) sug.style.display = 'none'; });
      body.appendChild(el('div.fld', { style: { position: 'relative' } }, el('label', 'Müşteri'), inp, sug,
        f.newName ? el('div.row', { style: { marginTop: '6px' } },
          el('span.st.live', el('i'), 'Yeni: ' + f.newName),
          el('input.inp', { placeholder: 'Telefon', style: { maxWidth: '190px' }, value: f.newPhone, oninput: (e) => (f.newPhone = e.target.value) })) : null));

      /* hizmet + kaynak */
      body.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
        el('div.fld', el('label', 'Hizmet'),
          el('select.sel', { onchange: (e) => { f.serviceId = e.target.value; f.price = null; draw(); } },
            c.services.map((x) => el('option', { value: x.id, selected: x.id === f.serviceId }, `${x.name} · ${u.money(x.price)}`)))),
        el('div.fld', el('label', 'Kaynak'),
          el('select.sel', { onchange: (e) => { f.resourceId = e.target.value; draw(); } },
            resList.map((x) => el('option', { value: x.id, selected: x.id === f.resourceId }, x.name))))));

      /* tarih + kanal */
      body.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
        el('div.fld', el('label', 'Tarih'),
          el('input.inp', { type: 'date', value: f.date, onchange: (e) => { f.date = e.target.value; f.start = null; draw(); } })),
        el('div.fld', el('label', 'Nereden geldi'),
          el('select.sel', { onchange: (e) => (f.channel = e.target.value) },
            Object.entries(s.CHANNEL).map(([k, v]) => el('option', { value: k, selected: k === f.channel }, v.t))))));

      /* boş saatler */
      const slots = s.free(c, { date: f.date, duration: sv.duration, step: 30, resourceId: f.resourceId });
      const chips = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '5px' } });
      if (!slots.length) chips.appendChild(el('div.hint', 'Bu kaynakta bu gün boş saat yok.'));
      slots.forEach((x) => chips.appendChild(
        el('button.btn.sm' + (f.start === x.start ? '.primary' : ''), { class: 'n', onclick: () => { f.start = x.start; draw(); } }, u.hm(x.start))));
      body.appendChild(el('div.fld',
        el('label', `Boş saatler — ${resOf(f.resourceId) ? resOf(f.resourceId).name : ''}`),
        el('div', { style: { maxHeight: '104px', overflow: 'auto', padding: '1px' } }, chips)));

      /* ücret + kapora */
      body.appendChild(el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
        el('div.fld', el('label', 'Ücret'),
          el('input.inp.n', { type: 'number', value: f.price != null ? f.price : sv.price, oninput: (e) => (f.price = Number(e.target.value)) })),
        el('div.fld', el('label', 'Kapora'),
          sv.deposit
            ? el('label.row', { style: { height: '32px', cursor: 'pointer', gap: '7px' } },
                el('input', { type: 'checkbox', checked: f.deposit, onchange: (e) => (f.deposit = e.target.checked) }),
                el('span', { style: { fontSize: '13px' } }, `${u.money(sv.deposit)} güvence`))
            : el('div.hint', { style: { paddingTop: '9px' } }, 'Bu hizmette kapora yok'))));

      body.appendChild(el('div.fld', el('label', 'Not'),
        el('input.inp', { value: f.note, placeholder: 'örn. kaleci filesi istendi', oninput: (e) => (f.note = e.target.value) })));

      /* canlı doğrulama */
      const v = verify();
      const line = el('div', { style: { fontSize: '12.5px', lineHeight: '1.5' } });
      if (f.start == null) line.appendChild(el('span.hint', 'Devam etmek için bir saat seçin.'));
      else if (!v.ok) line.appendChild(el('span.neg', { style: { fontWeight: '550' } }, v.errors[0]));
      else {
        line.appendChild(el('span.st.ok', el('i'),
          `${u.hm(f.start)}–${u.hm(f.start + sv.duration)} · ${resOf(f.resourceId).name} müsait`));
        if (v.warnings.length) line.appendChild(el('div.hint', { style: { color: 'var(--warn)' } }, v.warnings[0]));
      }
      body.appendChild(line);
      const ok = document.getElementById('bk-ok');
      if (ok) ok.disabled = !v.ok;
    }

    function submit() {
      const v = verify();
      if (!v.ok) { toast(v.errors[0], true); return false; }
      const sv = svcOf(f.serviceId);
      let cid = f.customerId;
      if (!cid && f.newName) cid = RZ.store.customer({ name: f.newName, phone: f.newPhone }).id;
      const payload = {
        customerId: cid, serviceId: f.serviceId, resourceId: f.resourceId,
        date: f.date, start: f.start, end: f.start + sv.duration,
        channel: f.channel, price: f.price != null ? f.price : sv.price, note: f.note,
        deposit: f.deposit && sv.deposit ? { amount: sv.deposit, charged: false, chargeable: false } : null,
      };
      const res = edit ? RZ.store.update(edit.id, payload) : RZ.store.add(payload);
      if (!res.ok) { toast(res.errors[0], true); return false; }
      toast(`<b>${u.hm(f.start)}</b> · ${resOf(f.resourceId).name} kaydedildi`);
      api.close();
      return true;
    }

    draw();
    return api;
  }

  /* ------------------------- rezervasyon detayı ------------------------- */
  function detail(id) {
    const api = sheet({ title: 'Rezervasyon', body: () => draw() });
    function draw() {
      const c = RZ.store.ctx();
      const r = c.reservations.find((x) => x.id === id);
      if (!r) return empty('Kayıt bulunamadı');
      const sv = c.services.find((x) => x.id === r.serviceId) || {};
      const res = c.resources.find((x) => x.id === r.resourceId) || {};
      const who = c.customers.find((x) => x.id === r.customerId);
      const hist = who ? c.reservations.filter((x) => x.customerId === who.id) : [];
      const done = hist.filter((x) => x.status === 'done');
      const redraw = () => api.redraw(draw);

      const act = (label, next, kind) => el('button.btn.sm' + (kind ? '.' + kind : ''),
        { onclick: () => { RZ.store.status(r.id, next); toast('Durum: ' + s.STATUS[next].t); redraw(); } }, label);

      return el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
        el('div',
          el('div.n', { style: { fontSize: '26px', fontWeight: '500', letterSpacing: '-.03em' } },
            `${u.hm(r.start)}–${u.hm(r.end)}`),
          el('div.hint', { style: { marginTop: '2px' } }, `${u.date(u.fromKey(r.date), 'long')} · ${res.name}`)),

        el('div.row.wrap', status(r.status),
          el('span.st', el('i'), (s.CHANNEL[r.channel] || {}).t),
          r.deposit ? el('span.st', el('i'), `Kapora ${u.money(r.deposit.amount)}`) : null),

        el('div.panel', el('div.rows',
          el('div', el('span.grow.hint', 'Hizmet'), el('span', { style: { fontSize: '13px' } }, sv.name)),
          el('div', el('span.grow.hint', 'Ücret'), el('span.n', { style: { fontSize: '13.5px', fontWeight: '500' } }, u.money(r.price))),
          r.note ? el('div', el('span.grow.hint', 'Not'), el('span', { style: { fontSize: '13px' } }, r.note)) : null)),

        who ? el('div.panel',
          el('div.rows',
            el('button', { onclick: () => { api.close(); location.hash = '#/musteri/' + who.id; } },
              el('span.grow', el('div', { style: { fontSize: '13.5px', fontWeight: '550' } }, who.name), el('div.hint.n', u.phone(who.phone))),
              el('span.hint', { html: u.icon('right', 15) }))),
          el('div.pad.row', { style: { gap: '22px' } },
            el('div', el('div.hint', 'Ziyaret'), el('div.n', { style: { fontSize: '16px' } }, done.length)),
            el('div', el('div.hint', 'Harcama'), el('div.n', { style: { fontSize: '16px' } }, u.money(u.sum(done, (x) => x.price), true))),
            el('div', el('div.hint', 'Gelmediği'), el('div.n' + (hist.filter((x) => x.status === 'noshow').length ? '.neg' : ''),
              { style: { fontSize: '16px' } }, hist.filter((x) => x.status === 'noshow').length)))) : null,

        el('div',
          el('div.hint', { style: { marginBottom: '7px' } }, 'Durumu değiştir'),
          el('div.row.wrap', { style: { gap: '6px' } },
            r.status === 'pending' ? act('Onayla', 'confirmed', 'primary') : null,
            r.status !== 'arrived' && r.status !== 'done' ? act('Geldi', 'arrived') : null,
            r.status !== 'done' ? act('Tamamlandı', 'done') : null,
            r.status !== 'noshow' ? act('Gelmedi', 'noshow', 'danger') : null,
            r.status !== 'cancelled' ? act('İptal', 'cancelled') : null)),

        r.deposit && r.deposit.chargeable ? el('div.panel.pad',
          el('div.between',
            el('div', el('div', { style: { fontSize: '13px', fontWeight: '550' } }, 'Kapora tahsil edilebilir'),
              el('div.hint', 'Müşteri gelmedi. Tahsilat kendi POS’unuzdan yapılır.')),
            el('button.btn.sm.danger', {
              onclick: async () => {
                if (await ask({ title: 'Kaporayı tahsil et', danger: true, ok: 'Tahsil et',
                  text: `${u.money(r.deposit.amount)} tutarı kendi sanal POS’unuzdan çekilecek. Rezervle bu tutara aracılık etmez.` })) {
                  RZ.store.charge(r.id); toast('Kapora tahsil edildi'); redraw();
                }
              },
            }, 'Tahsil et'))) : null,

        el('div.row.wrap', { style: { gap: '6px' } },
          el('button.btn.sm', { onclick: () => { api.close(); book({ id: r.id }); } }, 'Düzenle'),
          el('button.btn.sm.quiet', { style: { color: 'var(--loss)' },
            onclick: async () => {
              if (await ask({ title: 'Kaydı sil', danger: true, ok: 'Sil', text: 'Bu rezervasyon kalıcı olarak silinecek ve ciro raporundan düşecek.' })) {
                RZ.store.remove(r.id); toast('Kayıt silindi'); api.close();
              }
            } }, 'Sil')));
    }
    return api;
  }

  /** CSV — gömülü ortamda indirme engelli, o zaman kopyalanabilir göster */
  function exportCsv(name, text) {
    const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
    if (!embedded) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      toast(`<b>${name}</b> indirildi`);
      return;
    }
    const ta = el('textarea.inp', { readonly: true, style: { height: '260px', padding: '10px', fontFamily: 'var(--mono)', fontSize: '12px', whiteSpace: 'pre' } });
    ta.value = text;
    dialog({
      title: 'Dışa aktarım', sub: name + ' — gömülü demoda indirme kapalı, buradan kopyalayın',
      body: ta,
      actions: [{ label: 'Kapat' }, { label: 'Panoya kopyala', kind: 'primary', keepOpen: true,
        run: () => { ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} toast(ok ? 'Kopyalandı' : 'Kopyalanamadı', !ok); } }],
    });
  }

  return { toast, dialog, sheet, ask, closeTop, fig, delta, bars, breakdown, status, empty, panel, book, detail, exportCsv };
})();
