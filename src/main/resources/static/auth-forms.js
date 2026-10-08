// auth-forms.js
// little extras for the signin / signup / forgot / reset forms:
//  - show/hide password button
//  - caps lock warning (everyone forgets caps lock)
//  - password strength meter on the pages where you PICK a password
// loaded on the four auth pages only.

document.addEventListener('DOMContentLoaded', function () {
  var pwFields = document.querySelectorAll('input[type="password"]');

  pwFields.forEach(function (input) {
    // wrap in a div so the toggle button can sit inside the field
    var wrap = document.createElement('div');
    wrap.className = 'pwd-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pwd-toggle';
    btn.textContent = 'Show';
    btn.setAttribute('aria-label', 'Show password');
    btn.addEventListener('click', function () {
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Show' : 'Hide';
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
    });
    wrap.appendChild(btn);

    // caps lock hint under the field
    var hint = document.createElement('p');
    hint.className = 'caps-hint';
    hint.textContent = 'Caps Lock is on';
    wrap.parentNode.insertBefore(hint, wrap.nextSibling);
    function checkCaps(e) {
      if (typeof e.getModifierState === 'function') {
        hint.classList.toggle('show', e.getModifierState('CapsLock'));
      }
    }
    input.addEventListener('keyup', checkCaps);
    input.addEventListener('keydown', checkCaps);
    input.addEventListener('blur', function () { hint.classList.remove('show'); });
  });

  // strength meter - only where a NEW password is being picked. signin has a
  // placeholder of bullets, signup/reset mention the rules, so key off that.
  pwFields.forEach(function (input) {
    var isPicker = (input.placeholder || '').indexOf('Min 8') === 0;
    if (!isPicker) return;

    var meter = document.createElement('div');
    meter.className = 'pwd-meter';
    meter.innerHTML = '<div class="bar"><span></span></div><p class="label"></p>';
    var wrap = input.closest('.pwd-wrap');
    // put the meter after the caps hint so they dont overlap
    if (wrap.nextSibling) wrap.parentNode.insertBefore(meter, wrap.nextSibling.nextSibling);
    else wrap.parentNode.appendChild(meter);
    var fill = meter.querySelector('.bar span');
    var label = meter.querySelector('.label');

    input.addEventListener('input', function () {
      var v = input.value;
      if (!v) { meter.classList.remove('show'); return; }
      meter.classList.add('show');
      // dead simple scoring: length + variety. not a security feature, just a
      // nudge so people stop picking "password1"
      var score = 0;
      if (v.length >= 8) score++;
      if (v.length >= 12) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      var pct = Math.min(100, score * 20);
      fill.style.width = pct + '%';
      fill.style.background = score <= 2 ? 'var(--danger)' : score === 3 ? 'var(--warning)' : 'var(--success)';
      label.textContent = score <= 2 ? 'Weak - add length, a capital or a number'
        : score === 3 ? 'Getting there'
        : 'Strong password';
    });
  });
});
