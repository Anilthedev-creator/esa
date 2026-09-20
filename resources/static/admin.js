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
