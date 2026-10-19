/* Comportamento mínimo da vitrine de componentes (não é código do produto). */
(function () {
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  // tema: claro / escuro / sistema
  $$('[data-theme-set]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-theme-set'), r = document.documentElement;
      if (t === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
      $$('[data-theme-set]').forEach(function (x) { x.classList.toggle('is-active', x === b); });
    });
  });

  // segmented e abas: um ativo por grupo
  $$('.seg, .tabs').forEach(function (g) {
    $$('button', g).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('button', g).forEach(function (x) { x.classList.toggle('is-active', x === b); });
      });
    });
  });

  // modal
  $$('[data-open]').forEach(function (b) {
    b.addEventListener('click', function () { document.getElementById(b.getAttribute('data-open')).classList.add('is-open'); });
  });
  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('.overlay').classList.remove('is-open'); });
  });
  $$('.overlay').forEach(function (o) {
    o.addEventListener('click', function (e) { if (e.target === o) o.classList.remove('is-open'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $$('.overlay').forEach(function (o) { o.classList.remove('is-open'); });
  });

  // copiar #ID
  $$('.id-chip').forEach(function (c) {
    c.addEventListener('click', function () {
      try { navigator.clipboard.writeText(c.textContent.trim()).catch(function () {}); } catch (e) {}
    });
  });

  // status do WhatsApp (demonstração)
  $$('[data-wa-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var chip = document.getElementById('waChip'), off = chip.classList.toggle('status-chip--off');
      chip.classList.toggle('status-chip--on', !off);
      chip.lastChild.textContent = off ? ' Desconectado · Ler QR Code' : ' WhatsApp online';
    });
  });

  // carta holográfica: reflexo e inclinação seguem o ponteiro
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('.tcg').forEach(function (c) {
    function reset() { c.style.setProperty('--x', '50%'); c.style.setProperty('--y', '50%'); c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      c.style.setProperty('--x', (x * 100).toFixed(1) + '%');
      c.style.setProperty('--y', (y * 100).toFixed(1) + '%');
      if (!reduce) { c.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(1) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 16).toFixed(1) + 'deg'); }
    });
    c.addEventListener('pointerleave', reset);
  });

  // mostrar/ocultar painéis: [data-show="id1 id2"] (e opcional data-hide). Em .seg/.tabs, esconde os alvos dos irmãos.
  function ids(v) { return (v || '').split(/\s+/).filter(Boolean); }
  function setHidden(list, hide) { list.forEach(function (id) { var e = document.getElementById(id); if (e) e.hidden = hide; }); }
  $$('[data-show],[data-hide]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      var grp = b.closest('.seg, .tabs');
      if (grp) $$('[data-show]', grp).forEach(function (x) { setHidden(ids(x.getAttribute('data-show')), true); });
      setHidden(ids(b.getAttribute('data-hide')), true);
      setHidden(ids(b.getAttribute('data-show')), false);
      if (b.tagName === 'A' && b.getAttribute('href') === '#') ev.preventDefault();
    });
  });

  // máscaras
  var masks = {
    tel: function (d) { d = d.slice(0, 11); return d.length > 10 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7) : d.length > 6 ? '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6) : d.length > 2 ? '(' + d.slice(0, 2) + ') ' + d.slice(2) : d.length ? '(' + d : ''; },
    cpf: function (d) { d = d.slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); },
    cep: function (d) { d = d.slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; }
  };
  $$('[data-mask]').forEach(function (i) {
    var f = masks[i.getAttribute('data-mask')];
    i.addEventListener('input', function () { i.value = f(i.value.replace(/\D/g, '')); });
  });

  // caixas de código (OTP / chave): avança sozinho
  $$('.otp').forEach(function (g) {
    var xs = $$('input', g);
    xs.forEach(function (e, i) {
      e.addEventListener('input', function () { e.value = e.value.replace(/\D/g, ''); if (e.value && xs[i + 1]) xs[i + 1].focus(); });
      e.addEventListener('keydown', function (ev) { if (ev.key === 'Backspace' && !e.value && xs[i - 1]) xs[i - 1].focus(); });
    });
  });

  // copiar texto: [data-copy="texto"]
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      try { navigator.clipboard.writeText(b.getAttribute('data-copy')).catch(function () {}); } catch (e) {}
      var old = b.textContent; b.textContent = 'Copiado'; setTimeout(function () { b.textContent = old; }, 1200);
    });
  });

  // menu móvel
  $$('[data-menu]').forEach(function (b) {
    b.addEventListener('click', function () { var a = document.querySelector('.app'); if (a) a.classList.toggle('is-menu'); });
  });

  // rótulos das tabelas no mobile
  $$('.table').forEach(function (t) {
    var hs = $$('th', t).map(function (h) { return h.textContent.trim(); });
    $$('tbody tr', t).forEach(function (r) { $$('td', r).forEach(function (c, i) { if (!c.hasAttribute('data-label')) c.setAttribute('data-label', hs[i] || ''); }); });
  });

  // status do WhatsApp (demonstração): [data-wa-demo]
  $$('[data-wa-demo]').forEach(function (b) {
    b.addEventListener('click', function () {
      var chip = document.getElementById('waChip'); if (!chip) return;
      var off = chip.classList.toggle('status-chip--off');
      chip.classList.toggle('status-chip--on', !off);
      chip.lastChild.textContent = off ? 'Desconectado · Ler QR Code' : 'WhatsApp online';
      b.textContent = off ? 'Simular volta' : 'Simular queda';
      $$('[data-wa-on]').forEach(function (e) { e.hidden = off; });
      $$('[data-wa-off]').forEach(function (e) { e.hidden = !off; });
    });
  });

  // carrossel de lojas
  var deck = document.getElementById('deck');
  if (deck) {
    var cards = $$('.store-card', deck), dots = document.getElementById('dots');
    if (dots) cards.forEach(function () { dots.appendChild(document.createElement('i')); });
    var sel = function () {
      var c = deck.getBoundingClientRect(), mid = c.left + c.width / 2, best = 0, bd = 1e9;
      cards.forEach(function (k, i) { var r = k.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
      cards.forEach(function (k, i) { k.classList.toggle('is-sel', i === best); });
      if (dots) $$('i', dots).forEach(function (d, i) { d.classList.toggle('is-on', i === best); });
      return best;
    };
    var go = function (i) { i = Math.max(0, Math.min(cards.length - 1, i)); var k = cards[i]; deck.scrollTo({ left: k.offsetLeft - (deck.clientWidth - k.offsetWidth) / 2, behavior: 'smooth' }); };
    deck.addEventListener('scroll', sel);
    var pv = document.getElementById('deckPrev'), nx = document.getElementById('deckNext');
    if (pv) pv.addEventListener('click', function () { go(sel() - 1); });
    if (nx) nx.addEventListener('click', function () { go(sel() + 1); });
    deck.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); go(sel() + 1); } if (e.key === 'ArrowLeft') { e.preventDefault(); go(sel() - 1); } });
    cards.forEach(function (k, i) { k.addEventListener('click', function (e) { if (sel() !== i) { e.preventDefault(); go(i); } }); });
    setTimeout(function () { deck.style.scrollBehavior = 'auto'; deck.scrollLeft = 0; sel(); deck.style.scrollBehavior = ''; }, 30);
  }
})();
