document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('adminToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    sidebar.parentNode.insertBefore(overlay, sidebar.nextSibling);
  }

  function setExpanded(v) {
    toggle.setAttribute('aria-expanded', v ? 'true' : 'false');
    if (v) {
      sidebar.classList.add('open');
      document.body.style.overflow = 'hidden';
    } else {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function toggleSidebar() {
    setExpanded(!sidebar.classList.contains('open'));
  }

  function closeSidebar() {
    if (!sidebar.classList.contains('open')) return;
    setExpanded(false);
    toggle.focus();
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  document.addEventListener('click', function (e) {
    if (!sidebar.classList.contains('open')) return;
    if (!sidebar.contains(e.target) && e.target !== toggle && e.target !== overlay) {
      closeSidebar();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSidebar();
  });

  try {
    const saved = sessionStorage.getItem('adminSidebarOpen') === '1';
    if (saved) { setExpanded(true); }
    window.addEventListener('beforeunload', function () {
      sessionStorage.setItem('adminSidebarOpen', sidebar.classList.contains('open') ? '1' : '0');
    });
  } catch (err) { /* ignore storage errors */ }
});

/* ------------------------------------------------------------------------
   esaConfirm - styled yes/no dialog so we can stop using window.confirm.
   returns a promise: window.esaConfirm('Delete?', '...').then(function (yes) {...})
   css lives in admin.css (.esa-confirm-*)
   ------------------------------------------------------------------------ */
window.esaConfirm = function (title, message, yesLabel) {
  return new Promise(function (resolve) {
    var backdrop = document.getElementById('esaConfirmBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'esaConfirmBackdrop';
      backdrop.className = 'esa-confirm-backdrop';
      backdrop.innerHTML =
        '<div class="esa-confirm-box" role="alertdialog" aria-modal="true">' +
          '<h3 id="esaConfirmTitle"></h3>' +
          '<p id="esaConfirmMsg"></p>' +
          '<div class="esa-confirm-actions">' +
            '<button type="button" class="no">Cancel</button>' +
            '<button type="button" class="yes">Yes, go ahead</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(backdrop);
    }
    backdrop.querySelector('#esaConfirmTitle').textContent = title || 'Are you sure?';
    backdrop.querySelector('#esaConfirmMsg').textContent = message || '';
    var yesBtn = backdrop.querySelector('.yes');
    var noBtn = backdrop.querySelector('.no');
    yesBtn.textContent = yesLabel || 'Yes, go ahead';
    backdrop.classList.add('open');
    yesBtn.focus();

    function finish(answer) {
      backdrop.classList.remove('open');
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      backdrop.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(answer);
    }
    function onYes() { finish(true); }
    function onNo() { finish(false); }
    function onBackdrop(e) { if (e.target === backdrop) finish(false); }
    function onKey(e) { if (e.key === 'Escape') finish(false); }
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
    backdrop.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
};
