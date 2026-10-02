// Page text is pre-rendered by build.js. This file only handles interactions;
// runtime strings come from I18N[<html lang>].
(function () {
  var dict = I18N[document.documentElement.lang] || I18N.ja;
  function $(id) { return document.getElementById(id); }

  // Header shadow once the page scrolls
  var header = document.querySelector('header');
  var onScroll = function () { header.classList.toggle('scrolled', scrollY > 8); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Scroll reveal. Siblings in the same parent are staggered.
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    document.documentElement.classList.add('js');
    var targets = document.querySelectorAll('.block h2, .block .sub, .rows article, .mu > div, .roles > div, .day, .tbl, .steps li, .case, .half-note, .plan, .faq, .partner blockquote, .partner dl, .news li, dl.info, .ways > a, #contactForm, .pp');
    targets.forEach(function (el) {
      var sibs = [].filter.call(el.parentNode.children, function (c) { return c.matches(el.tagName) && [].indexOf.call(targets, c) > -1; });
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', Math.min(sibs.indexOf(el), 5) * 90 + 'ms');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('shown');
        io.unobserve(e.target);
        var c = e.target.querySelector('.count');
        if (c) countUp(c);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }
  function countUp(el) {
    var to = +el.dataset.to, t0 = null;
    el.textContent = '0';
    requestAnimationFrame(function step(t) {
      t0 = t0 || t;
      var p = Math.min((t - t0) / 1100, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    });
  }

  // Mobile menu
  var menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) {
    var nav = menuBtn.parentNode;
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open);
    };
    menuBtn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    nav.querySelectorAll('.menu a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); menuBtn.focus(); }
    });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setOpen(false); });
  }

  // Munemo demo
  var sumBtn = $('sumBtn');
  if (sumBtn) {
    sumBtn.addEventListener('click', function () {
      $('chatInput').hidden = true;
      $('chatEmpty').hidden = true;
      $('askMsg').hidden = false;
      $('thinkMsg').hidden = false;
      setTimeout(function () {
        $('thinkMsg').hidden = true;
        $('sumMsg').hidden = false;
      }, reduce ? 0 : 1200);
    });
  }
  // Demo only: follow-up buttons switch to their "done" label, nothing is sent.
  document.querySelectorAll('.act').forEach(function (b) {
    b.addEventListener('click', function () {
      b.textContent = dict[b.dataset.done];
      b.classList.add('done');
      b.disabled = true;
    });
  });

  // Contact form
  var form = $('contactForm'), msg = $('formMsg');
  if (form) {
    // Submit stays disabled until every required field is valid and consent is ticked,
    // so the browser's own validation bubbles never show.
    var send = form.querySelector('[type=submit]');
    // When the form was shown; the Worker drops submissions faster than a human could type.
    var stamp = function () { form.elements.ts.value = Date.now(); };
    stamp();
    // After a successful send, lock the form for COOLDOWN ms (kept across reloads).
    var COOLDOWN = 60000, KEY = 'contactSentAt';
    var sentAt = function () { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } };
    var coolingDown = function () { return Date.now() - sentAt() < COOLDOWN; };
    var sync = function () {
      send.disabled = !form.checkValidity() || coolingDown();
      if (coolingDown() && !msg.textContent) msg.textContent = dict['f.wait'];
    };
    setInterval(function () { if (!coolingDown() && msg.textContent === dict['f.wait']) msg.textContent = ''; sync(); }, 5000);
    ['input', 'change', 'focusin'].forEach(function (ev) { form.addEventListener(ev, sync); });
    sync();
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (send.disabled) return;
      send.disabled = true; // no double submits while sending
      msg.textContent = dict['f.sending'];
      msg.insertAdjacentHTML('beforeend', '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>');
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (r.status === 429) { msg.textContent = dict['f.wait']; return; }
          if (!r.ok) throw 0;
          try { localStorage.setItem(KEY, Date.now()); } catch (e) {}
          form.reset(); stamp(); msg.textContent = dict['f.ok'];
        })
        .catch(function () { msg.textContent = dict['f.err']; })
        .then(sync);
    });
  }
})();
