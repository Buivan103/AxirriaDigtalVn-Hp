// Page text is pre-rendered by build.js. This file only handles interactions;
// runtime strings come from I18N[<html lang>].
(function () {
  var dict = I18N[document.documentElement.lang] || I18N.ja;
  function $(id) { return document.getElementById(id); }

  // Munemo demo
  var sumBtn = $('sumBtn');
  if (sumBtn) {
    sumBtn.addEventListener('click', function () {
      var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = dict['f.sending'];
      fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw 0; form.reset(); msg.textContent = dict['f.ok']; })
        .catch(function () { msg.textContent = dict['f.err']; });
    });
  }
})();
