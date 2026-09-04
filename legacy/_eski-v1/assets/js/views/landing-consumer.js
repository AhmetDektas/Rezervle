/* Rezervle — Ana sayfa (#/), tüketici için
   Hedef kitle: rezervasyon yapacak kisi. Tek soruya cevap verir:
   "bu uygulamada ne yapiyorum?" — Bos saati gorup yerini ayiriyorsun.
   Isletme tarafi ayri sayfadadir: landing-business.js (#/isletme) */
(function (RZ) {
  'use strict';
  const U = RZ.util, S = RZ.schedule, el = U.el, tl = U.tl;
  RZ.views = RZ.views || {};

  RZ.views.landing = function (root) {
    root.className = 'site';
    root.dataset.page = 'consumer';
    root.appendChild(header());
    root.appendChild(el('main', { id: 'main', tabindex: '-1' },
      hero(), how(), categories(), why(), deposit(), faq(), forBusiness()));
    root.appendChild(footer());
    reveal(root);
  };

  /* ---------------- Üst menü ---------------- */
  function header() {
    const h = el('header.site-head',
      el('div.wrapx',
        el('div.bar',
          el('a.logo', { href: '#/' }, el('span.mark', { html: U.logoMark(31) }), 'Rezervle'),
          el('nav.site-nav',
            el('a', { href: '#nasil' }, 'Nasıl çalışır'),
            el('a', { href: '#kategoriler' }, 'Neler var'),
            el('a', { href: '#sorular' }, 'Sorular')),
          el('div.grow'),
          el('button.icon-btn', { html: U.icon('moon', 18), title: 'Tema', onclick: RZ.app.toggleTheme }),
          el('a.btn.btn-ghost.btn-sm.hide-sm', { href: '#/isletme' }, 'İşletmeler için'),
          el('a.btn.btn-primary.btn-sm', { href: '#/panel/uygulama' }, 'Uygulamayı aç')
        )
      )
    );
    const onScroll = () => h.classList.toggle('stuck', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return h;
  }

  /* ---------------- Hero — "saha ışığı" ---------------- */
  function hero() {
    return el('section.hero-night',
      el('div.wrapx',
        el('div.night-split',
          el('div',
            el('div.night-eyebrow', el('i'), 'Ankara · halı saha, kort, kuaför, güzellik'),
            el('h1.night-h1', 'Akşam sahası ', el('em', 'boş mu'), ', bak.'),
            el('p.night-lead',
              'Aramana gerek yok. Rezervle’de işletmenin ', el('b', 'gerçek takvimini'),
              ' görürsün — dolu saatler zaten karşına çıkmaz. Seçtiğin saat, dokunduğun an senin olur.'),
            el('div.night-cta',
              el('a.btn-spark', { href: '#/panel/uygulama' },
                'Uygulamayı aç', el('span', { html: U.icon('chevR', 18) })),
              el('a.link-quiet', { href: '#nasil' }, 'Nasıl çalışır')),
            el('div.night-fine',
              el('span', 'Ücretsiz'), el('s', '/'),
              el('span', 'Üyelik yok'), el('s', '/'),
              el('span', 'Anında onay'))
          ),
          el('div.night-phone', phoneMock())
        )
      ),
      strip()
    );
  }

  /** Kahramanın altını kapatan sayı şeridi — bölüm ritmini kırar */
  function strip() {
    const cells = [
      ['4 sahadan 3’ü', 'şu anda boş görünüyor'],
      ['0 ₺', 'kullanıcıdan alınan ücret'],
      ['~15 sn', 'rezervasyon tamamlama süresi'],
      ['Üyelik yok', 'ad ve telefon yeterli'],
    ];
    return el('div.night-strip',
      el('div.wrapx', { style: { padding: '0' } },
        el('div.in', cells.map(([k, v]) =>
          el('div.cell',
            el('div.k', el('em', k.split(' ')[0]), ' ' + k.split(' ').slice(1).join(' ')),
            el('div.v', v))))));
  }

  /** Gercek demo verisiyle beslenen uygulama onizlemesi */
  function phoneMock() {
    const st = RZ.store.get();
    const listed = st.businesses.filter(
      (b) => st.resources.some((r) => r.bizId === b.id) && st.services.some((s) => s.bizId === b.id)
    ).slice(0, 2);
    const todayKey = U.dayKey(new Date());


    const screen = el('div.phone-screen',
      el('div.ph-top',
        el('div.row', { style: { gap: '8px' } },
          el('div', { style: { width: '26px', height: '26px', flex: 'none' }, html: U.logoMark(26) }),
          el('div.grow',
            el('div', { style: { fontWeight: '680', fontSize: '14px', letterSpacing: '-.02em' } }, 'Rezervle'),
            el('div.hint', { style: { fontSize: '10.5px' } }, 'Ankara · yakınımdakiler')),
          el('span.hint', { html: U.icon('search', 16) }))),
      el('div.ph-body',
        el('div.ph-cats',
          el('button.ph-cat.on', el('span', { html: U.icon('grid', 13) }), 'Tümü'),
          el('button.ph-cat', el('span', { html: U.icon('bolt', 13) }), 'Halı saha'),
          el('button.ph-cat', el('span', { html: U.icon('sparkle', 13) }), 'Güzellik')),
        el('div.row', { style: { gap: '6px', paddingBottom: '10px' } },
          Array.from({ length: 5 }, (_, i) => i).map((i) => {
            const d = U.addDays(new Date(), i);
            return el('div.ph-slot' + (i === 0 ? '.on' : ''), { style: { minWidth: '48px', padding: '6px 4px' } },
              el('div', { style: { fontSize: '10px', opacity: '.75' } }, i === 0 ? 'Bugün' : U.GUN_K[d.getDay()]),
              el('div', { style: { fontSize: '13px' } }, d.getDate()));
          })),
        listed.map((b) => {
          const res = st.resources.filter((r) => r.bizId === b.id && !r.closed);
          const svcs = st.services.filter((s) => s.bizId === b.id);
          const ctx = { biz: b, resources: res, services: svcs, reservations: st.reservations.filter((r) => r.bizId === b.id) };
          const dur = Math.min.apply(null, svcs.map((s) => s.duration));
          const slots = S.freeSlots(ctx, { date: todayKey, duration: dur, step: 60 });
          const free = slots.length ? Math.max.apply(null, slots.map((s) => s.resources.length)) : 0;
          const unit = res[0] && res[0].type === 'Halı saha' ? 'saha' : 'koltuk';
          const lvl = !slots.length ? 'low' : free / res.length > 0.5 ? 'high' : 'mid';
          return el('div.ph-venue',
            el('div.cover', { html: U.venueArt(b.category, { height: 82 }) }, el('span.ttl', b.name)),
            el('div.meta',
              el('span.avail.' + lvl, el('i.dot'),
                slots.length ? `${res.length} ${unit}tan ${free}’i boş` : 'Bugün dolu'),
              el('span.ph-rate', el('span', { style: { color: 'var(--warn)' }, html: U.icon('star', 12) }), b.rating),
              el('span.hint', { style: { fontSize: '11px' } }, b.district)));
        })),
      el('div.ph-nav',
        el('button.on', el('span', { html: U.icon('search', 18) }), 'Keşfet'),
        el('button', el('span', { html: U.icon('calendar', 18) }), 'Rezervasyonlar'),
        el('button', el('span', { html: U.icon('users', 18) }), 'Profil'))
    );
    return el('div.phone', el('div.phone-notch'), screen);
  }

  /* ---------------- Nasıl çalışır ---------------- */
  function how() {
    const steps = [
      ['01', 'Yakınındakileri gör', 'Konumuna göre işletmeler listelenir. Her kartta o gün gerçekten kaç yer boş yazar — “4 sahadan 2’si boş” gibi. Bu bilgi işletmenin kendi takviminden canlı gelir.', 'search'],
      ['02', 'Saatini seç', 'Sadece gerçekten boş saatler tıklanabilir. Dolu saatler soluk görünür ve seçilemez, çünkü sistem aynı yeri iki kişiye satmaz. Seçtiğin an senindir.', 'clock'],
      ['03', 'Adını ve telefonunu yaz', 'Üyelik kurmana gerek yok. Ad ve telefon yeterli; numaran SMS ile doğrulanır. Onayın anında gelir.', 'phone'],
      ['04', 'Git', 'Randevudan önce hatırlatma mesajı alırsın. Girişte QR kodunu okutursun, işlem biter. Gelemeyeceksen tek dokunuşla iptal edersin.', 'qr'],
    ];
    return el('section.sec', { id: 'nasil' },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Nasıl çalışır'),
          el('h2', 'Dört adım, hepsi telefonundan'),
          el('p', 'Rezervasyon yapmak için kimseyi aramana, mesaj atıp cevap beklemene gerek yok. İşletmenin takvimi neyse ekranda gördüğün de odur.')),
        el('div.steps.reveal', steps.map(([n, t, d, ic]) =>
          el('div.step',
            el('div.step-n', n),
            el('div.step-ic', { html: U.icon(ic, 18) }),
            el('h3', t),
            el('p', d))))
      )
    );
  }

  /* ---------------- Kategoriler ---------------- */
  function categories() {
    const cats = [
      ['Halı saha ve tenis kortu', 'Akşam saatleri hızlı dolar. Hangi sahanın hangi saati boş, listede yazar.', 'Halı saha & tenis kortu'],
      ['Güzellik salonu', 'Cilt bakımı, manikür, ağda. Süresi belli olduğu için sana uygun aralığı görürsün.', 'Güzellik salonu'],
      ['Kuaför ve berber', 'Kesim, fön, boya. Hangi koltuk ne zaman boş, tahmin etmene gerek yok.', 'Kuaför'],
    ];
    return el('section.sec', { id: 'kategoriler', style: { paddingTop: '10px' } },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Neler var'),
          el('h2', 'Şimdilik üç alanda, Ankara’da'),
          el('p', 'Az sayıda kategoriyle başlıyoruz çünkü her işletmenin takvimini gerçekten bağlamak istiyoruz. Listede gördüğün her yer sisteme bağlı; “ara da sor” diyen bir rehber değiliz.')),
        el('div.cat-grid.reveal', cats.map(([t, d, key]) =>
          el('div.cat-card',
            el('div.cat-cover', { html: U.venueArt(key, { height: 130 }) }),
            el('div.cat-body', el('h3', t), el('p', d))))),
        el('div.hint.reveal', { style: { marginTop: '18px', maxWidth: '620px' } },
          'Diş kliniği ve veteriner gibi alanlar şimdilik yok: bu kategorilerde reklam ve sıralama kuralları farklı, ',
          'doğru şekilde çözmeden eklemek istemiyoruz.')
      )
    );
  }

  /* ---------------- Neden ---------------- */
  function why() {
    const items = [
      ['wallet', 'Sana ücretsiz', 'Rezervasyon için hiçbir ücret ödemezsin, üyelik parası yok. Rezervle’yi işletmeler kullandığı için ödüyor.'],
      ['bolt', 'Gerçek müsaitlik', 'Gördüğün boş saat gerçekten boştur. İşletmenin takvimine bağlıyız; telefonla “acaba var mı” turu bitiyor.'],
      ['users', 'Üyelik zorunlu değil', 'Hesap açmak istemiyorsan açma. Ad ve telefon yeter; numaran SMS ile doğrulanır.'],
      ['sms', 'Unutturmayız', 'Randevudan önce hatırlatma gelir. Gelemeyeceksen tek dokunuşla iptal edersin, yerin başkasına açılır.'],
      ['calendar', 'Geçmişin elinde', 'Nereye ne zaman gittiğin tek yerde. Beğendiğin yeri bir daha aramadan, iki dokunuşla yeniden alırsın.'],
      ['qr', 'Kapıda işlem yok', 'Girişte QR kodunu okutursun. İsim aratmak, “rezervasyonum vardı” demek yok.'],
    ];
    return el('section.sec', { style: { paddingTop: '10px' } },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Neden Rezervle'),
          el('h2', 'Rezervasyon zaten yapıyordun. Bu sefer beklemeden.')),
        el('div.why-grid.reveal', items.map(([ic, t, d]) =>
          el('div.why-item',
            el('span.why-ic', { html: U.icon(ic, 17) }),
            el('div', el('h3', t), el('p', d)))))
      )
    );
  }

  /* ---------------- Kapora şeffaflığı ---------------- */
  function deposit() {
    return el('section.night-band',
      el('div.wrapx',
        el('div.reveal',
          el('div.row', { style: { gap: '16px', alignItems: 'flex-start' } },
            el('span', { style: { color: 'var(--spark)', flex: 'none', marginTop: '6px' }, html: U.icon('shield', 24) }),
            el('div',
              el('h2', 'Bazı yerler kapora ister. Kartından para çekilmez.'),
              el('p',
                'Halı saha gibi yerlerde işletme, gelmeyen müşteri yüzünden saatini boşa harcamamak için kapora isteyebilir. ',
                'Rezervasyon sırasında kartını yazarsın ama ',
                el('b', 'tahsilat yapılmaz'),
                ' — tutar yalnızca güvenceye alınır. Randevuna gidersen serbest bırakılır; gitmezsen işletme kendi kartından tahsil eder. ',
                'Ne kadar kapora alındığı, rezervasyonu tamamlamadan önce ekranda yazar. Sürpriz yok.'))))
      )
    );
  }

  /* ---------------- SSS ---------------- */
  function faq() {
    const qs = [
      ['Rezervle’yi kullanmak ücretli mi?',
       'Hayır. Ne rezervasyon başına ne de üyelik için ücret alırız. Uygulama tüketici için tamamen ücretsizdir; Rezervle gelirini işletmelerin ödediği aylık abonelikten elde eder.'],
      ['Üye olmam gerekiyor mu?',
       'Gerekmiyor. Ad ve telefon numaran yeterli; numaran SMS ile doğrulanır. İstersen hesap açarsın, o zaman geçmiş rezervasyonların ve favori işletmelerin kayıtlı kalır.'],
      ['Gördüğüm boş saatler gerçek mi?',
       'Evet. İşletmenin panelindeki takvimle aynı kaynaktan gelir. Bir saat dolduğu anda listeden düşer; aynı yeri iki kişiye satmak sistem tarafından engellenir. Telefondan ya da kapıdan alınan randevular da aynı takvime işlendiği için liste gerçeği gösterir.'],
      ['Rezervasyonumu iptal edebilir miyim?',
       'Evet. Hatırlatma mesajındaki bağlantıdan ya da uygulamadan tek dokunuşla iptal edersin. İşletmenin belirlediği bir iptal süresi olabilir (örneğin randevudan 6 saat öncesine kadar); bu süre rezervasyon ekranında yazar. Kapora verdiysen ve süresinde iptal ettiysen tutar serbest bırakılır.'],
      ['Kapora verirsem param çekilir mi?',
       'Hayır. Tutar yalnızca güvenceye alınır, hesabından çıkmaz. Randevuna gidersen güvence kalkar. Gitmezsen işletme o tutarı kendi sanal POS’undan tahsil edebilir — para hiçbir aşamada Rezervle’nin hesabından geçmez.'],
      ['Aradığım işletme uygulamada yok, ne yapayım?',
       'Şu an Ankara’da halı saha, kort, kuaför ve güzellik salonlarıyla başlıyoruz ve listede gördüğün her yer sisteme gerçekten bağlı. Gitmek istediğin yeri bize söylersen ekibimiz onlarla iletişime geçer.'],
      ['İşletmem var, nasıl katılırım?',
       'İşletme tarafı ayrı bir ürün: takvim, müşteri kaydı, ciro takibi ve kapora yönetimi. Uygulamada listelenmek her pakette ücretsizdir. Ayrıntılar İşletmeler için sayfasında.'],
    ];
    return el('section.sec', { id: 'sorular' },
      el('div.wrapx',
        el('div.sec-head.reveal',
          el('div.sec-tag', 'Sık sorulanlar'),
          el('h2', 'Merak edilenler')),
        el('div.reveal', qs.map(([q, a]) => {
          const ans = el('div.faq-a', el('div.in', a));
          const item = el('div.faq-item',
            el('button.faq-q', {
              onclick: () => {
                const open = item.classList.toggle('open');
                ans.style.maxHeight = open ? ans.scrollHeight + 40 + 'px' : '0';
              },
            }, el('span', q), el('span.pm', { html: U.icon('plus', 18) })),
            ans);
          return item;
        }))
      )
    );
  }

  /* ---------------- İşletme köprüsü ---------------- */
  function forBusiness() {
    return el('section.sec', { style: { paddingTop: '0' } },
      el('div.wrapx',
        el('div.cta-final.reveal',
          el('h2', 'Hemen bir yer ayır'),
          el('p', 'Uygulama bu sayfada canlı çalışıyor — örnek işletmelerle. Bir saat seç, rezervasyonu tamamla, nasıl işlediğini gör.'),
          el('div.row', { style: { justifyContent: 'center', gap: '10px', flexWrap: 'wrap' } },
            el('a.btn.btn-primary.btn-lg', { href: '#/panel/uygulama' }, 'Uygulamayı aç'),
            el('a.btn.btn-ghost.btn-lg', { href: '#/isletme' }, 'İşletmem var'))),
        el('div.biz-bridge.reveal',
          el('div',
            el('h3', 'İşletme sahibi misiniz?'),
            el('p', 'Rezervle aynı zamanda bir işletme panelidir: takvim ve çakışma engeli, müşteri kaydı, ciro takibi, kapora ve kampanya. ',
              'Uygulamada listelenmek her pakette ücretsizdir.')),
          el('a.btn.btn-ghost', { href: '#/isletme' }, 'İşletmeler için', el('span', { html: U.icon('chevR', 15) })))
      )
    );
  }

  function footer() {
    return el('footer.site-foot',
      el('div.wrapx',
        el('div.foot-grid',
          el('div',
            el('a.logo', { href: '#/' }, el('span.mark', { html: U.logoMark(31) }), 'Rezervle'),
            el('p.hint', { style: { marginTop: '11px', maxWidth: '300px', lineHeight: '1.6' } },
              'Boş saati gör, yerini ayır. Halı saha, kort, kuaför ve güzellik salonu rezervasyonu — ücretsiz, üyelik zorunlu değil.')),
          el('div', el('h5', 'Kullanıcılar'),
            el('ul',
              el('li', el('a', { href: '#nasil' }, 'Nasıl çalışır')),
              el('li', el('a', { href: '#kategoriler' }, 'Neler var')),
              el('li', el('a', { href: '#sorular' }, 'Sık sorulanlar')),
              el('li', el('a', { href: '#/panel/uygulama' }, 'Uygulamayı aç')))),
          el('div', el('h5', 'İşletmeler'),
            el('ul',
              el('li', el('a', { href: '#/isletme' }, 'İşletme paneli')),
              el('li', el('a', { href: '#/isletme#paketler' }, 'Paketler')),
              el('li', el('a', { href: '#/panel' }, 'Panele giriş')))),
          el('div', el('h5', 'İletişim'),
            el('ul',
              el('li', 'Ankara, Türkiye'),
              el('li', 'merhaba@rezervle.com'),
              el('li', '0850 000 00 00')))),
        el('div.foot-note',
          'Rezervle · Bu sayfa ve uygulama bir ürün demosudur; işletmeler ve rezervasyonlar örnektir, veriler tarayıcınızda saklanır.')
      )
    );
  }

  /* ---------------- Görünüme girince ---------------- */
  function reveal(root) {
    const items = U.$$('.reveal', root);
    const showAll = () => items.forEach((i) => i.classList.add('in'));
    window.addEventListener('beforeprint', showAll);
    if (!('IntersectionObserver' in window)) { showAll(); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -60px 0px' });
    items.forEach((i) => io.observe(i));
    setTimeout(() => { if (!items.some((i) => i.classList.contains('in'))) showAll(); }, 2500);
  }
})(window.RZ);
