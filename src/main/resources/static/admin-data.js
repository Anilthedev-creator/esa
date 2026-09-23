/*
 * admin-data.js
 * Wires the admin pages to the backend API.
 *
 *  1. Auth guard  — no valid (admin) session → redirect to
 *     signin.html?next=<this page>; non-admin accounts → index.html.
 *  2. Live data   — replaces the static demo rows/stats with real
 *     data from /api/admin/*. Falls back to the static markup with a
 *     small "backend offline" notice if the API can't be reached.
 *  3. Actions     — view/edit modals, status changes, replies,
 *     add-page, settings save, activity chart + CSV export.
 *
 * Pages opt in with <body data-admin-page="dashboard|customers|
 * enquiries|payments|content|analytics|settings">.
 */

(function () {
  'use strict';

  var API = window.ESA_API_URL ? window.ESA_API_URL.replace(/\/$/, '') + '/admin' : '/api/admin';
  var AUTH_API = (window.ESA_API_URL ? window.ESA_API_URL.replace(/\/$/, '') : '/api') + '/auth';

  /* ----------------------------- small helpers ---------------------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtMoney(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-AU');
  }
  function initials(name) {
    return String(name || 'U').trim().split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || 'U';
  }

  async function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var token = getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var res;
    try {
      res = await fetch(API + path, opts);
    } catch (e) {
      throw new Error('offline');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* ignore */ }
    if (!res.ok) {
      var msg = (data && data.message) || ('Request failed (' + res.status + ')');
      var err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ------------------------------- auth guard ------------------------------ */
  async function guard() {
    var page = document.body.dataset.adminPage || 'dashboard';
    var next = encodeURIComponent(page + '.html');
    if (!getToken()) {
      window.location.replace('signin.html?next=' + next);
      return false;
    }
    var user = null;
    try {
      var token = getToken();
      var res = await fetch(AUTH_API + '/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) {
        var err = new Error('Session check failed');
        err.status = res.status;
        throw err;
      }
      var me = await res.json();
      user = me.user;
      // refresh the cached user (role etc.)
      localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
      if (e.status === 401) {
        await logout();
        window.location.replace('signin.html?next=' + next);
      } else {
        showOffline('Could not verify your session');
      }
      return false;
    }
    if (!user) return false;
    if (user.role !== 'admin') {
      // Signed in, but not an admin — back to the public site.
      window.location.replace('index.html');
      return false;
    }
    applyUserToChrome(user);
    return true;
  }

  function applyUserToChrome(user) {
    var circle = document.querySelector('.sidebar-user .user-circle');
    var nameEl = document.querySelector('.sidebar-user p');
    var roleEl = document.querySelector('.sidebar-user span');
    if (circle) circle.textContent = initials(user.name || user.firstName);
    if (nameEl) nameEl.textContent = user.name || 'User';
    if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrator' : (user.role || 'User');

    var links = document.querySelector('.topbar-links');
    if (links && !links.querySelector('#adminSignOut')) {
      var a = document.createElement('a');
      a.href = '#';
      a.id = 'adminSignOut';
      a.textContent = 'Sign out';
      a.style.color = '#e63946';
      a.style.fontWeight = '700';
      a.addEventListener('click', async function (e) {
        e.preventDefault();
        await logout();
        window.location.href = 'index.html';
      });
      links.appendChild(a);
    }
  }

  /* ------------------------------ offline notice --------------------------- */
  function showOffline(detail) {
    if (document.querySelector('.admin-offline-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'admin-offline-banner';
    banner.innerHTML =
      '<strong>Backend offline</strong> — ' + esc(detail || 'showing static demo data') +
      '. Start the server (<code>npm start</code>) and reload.';
    var wrapper = document.querySelector('.dashboard-wrapper');
    if (wrapper) wrapper.insertBefore(banner, wrapper.firstChild);
    else document.body.insertBefore(banner, document.body.firstChild);
  }

  /* ------------------------------ status badges ---------------------------- */
  var STATUS = {
    enquiry: {
      'new': { cls: 'enquiry-new', label: 'New' },
      'in-progress': { cls: 'enquiry-progress', label: 'In Progress' },
      'resolved': { cls: 'enquiry-resolved', label: 'Resolved' }
    },
    customer: {
      active: { cls: 'active-status', label: 'Active' },
      inactive: { cls: 'inactive-status', label: 'Inactive' }
    },
    payment: {
      completed: { cls: 'completed-status', label: 'Completed' },
      incomplete: { cls: 'incomplete-status', label: 'Incompleted' }
    },
    booking: {
      pending: { cls: 'pending', label: 'Pending' },
      confirmed: { cls: 'completed', label: 'Confirmed' },
      completed: { cls: 'completed', label: 'Completed' },
      cancelled: { cls: 'incomplete-status', label: 'Cancelled' }
    },
    page: {
      published: { cls: 'published', label: 'Published' },
      draft: { cls: 'inactive-status', label: 'Draft' }
    }
  };
  function badge(kind, status) {
    var s = (STATUS[kind] || {})[status] || { cls: 'pending', label: status || '—' };
    return '<span class="status ' + s.cls + '">' + esc(s.label) + '</span>';
  }
  function actionIcons(kind, id) {
    return '<td class="action-icons">' +
      '<i class="fa-solid fa-pen" data-edit="' + kind + ':' + id + '" title="Edit" style="cursor:pointer"></i> ' +
      '<i class="fa-regular fa-eye" data-view="' + kind + ':' + id + '" title="View" style="cursor:pointer"></i>' +
      '</td>';
  }

  /* --------------------------------- modal --------------------------------- */
  var modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    var overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.innerHTML =
      '<div class="admin-modal" role="dialog" aria-modal="true">' +
      '<div class="admin-modal-head"><h3 id="adminModalTitle">Details</h3>' +
      '<button type="button" class="admin-modal-close" aria-label="Close">&times;</button></div>' +
      '<div class="admin-modal-body" id="adminModalBody"></div>' +
      '<div class="admin-modal-foot" id="adminModalFoot"></div>' +
      '</div>';
    document.body.appendChild(overlay);
    modalEl = overlay;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.admin-modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
    return overlay;
  }
  function openModal(title, bodyHtml, footHtml, wide) {
    var m = ensureModal();
    m.querySelector('.admin-modal').classList.toggle('admin-modal-wide', !!wide);
    m.querySelector('#adminModalTitle').textContent = title;
    m.querySelector('#adminModalBody').innerHTML = bodyHtml;
    var foot = m.querySelector('#adminModalFoot');
    if (footHtml) { foot.innerHTML = footHtml; foot.style.display = ''; }
    else { foot.innerHTML = ''; foot.style.display = 'none'; }
    m.style.display = 'flex';
  }
  function closeModal() { if (modalEl) modalEl.style.display = 'none'; }
  function fieldRows(obj) {
    return '<table class="admin-detail-table">' +
      Object.keys(obj).map(function (k) {
        return '<tr><th>' + esc(k) + '</th><td>' + (obj[k].html || esc(obj[k].value)) + '</td></tr>';
      }).join('') + '</table>';
  }

  /* --------------------------- table row builders -------------------------- */
  function customerRow(c) {
    return '<tr>' +
      '<td>' + esc(c.name) + '</td>' +
      '<td>' + esc(c.email) + '</td>' +
      '<td>' + esc(c.phone || '—') + '</td>' +
      '<td>' + badge('customer', c.status) + '</td>' +
      '<td>' + esc(fmtDate(c.lastUpdated)) + '</td>' +
      actionIcons('customer', c.id) +
      '</tr>';
  }
  function enquiryRow(e) {
    return '<tr>' +
      '<td>' + esc(e.name) + '</td>' +
      '<td>' + esc(e.subject) + '</td>' +
      '<td class="msg-cell" title="' + esc(e.message) + '">' + esc(truncate(e.message, 40)) + '</td>' +
      '<td>' + badge('enquiry', e.status) + '</td>' +
      '<td>' + esc(fmtDate(e.date)) + '</td>' +
      actionIcons('enquiry', e.id) +
      '</tr>';
  }
  function paymentRow(p) {
    return '<tr>' +
      '<td>' + esc(p.invoiceId) + '</td>' +
      '<td>' + esc(p.customerName) + '</td>' +
      '<td>' + esc(fmtMoney(p.amount)) + '</td>' +
      '<td>' + badge('payment', p.status) + '</td>' +
      '<td>' + esc(p.paidAt ? fmtDate(p.paidAt) : '—') + '</td>' +
      actionIcons('payment', p.id) +
      '</tr>';
  }
  function pageRow(p) {
    return '<tr>' +
      '<td>' + esc(p.title) + '</td>' +
      '<td>' + badge('page', p.status) + '</td>' +
      '<td>' + esc(fmtDate(p.updatedAt)) + '</td>' +
      '<td class="action-icons">' +
      '<button data-content="' + p.id + '" title="Edit content" class="content-btn">Content</button> ' +
      actionIcons('page', p.id).replace(/^<td[^>]*>|<\/td>$/g, '') +
      '</td>' +
      '</tr>';
  }
  function requestRow(b) {
    return '<tr>' +
      '<td>' + esc(b.customer) + '</td>' +
      '<td>' + esc(b.service) + '</td>' +
      '<td>' + esc(fmtDate(b.date)) + '</td>' +
      '<td>' + badge('booking', b.status) + '</td>' +
      '</tr>';
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* ------------------------------ view/edit -------------------------------- */
  var STORE = { customer: null, enquiry: null, payment: null, page: null };

  function bindActions(container) {
    container.querySelectorAll('[data-edit]').forEach(function (el) {
      el.addEventListener('click', function () {
        var kind = el.dataset.edit.split(':')[0];
        editModal(kind, el.dataset.edit.split(':')[1]);
      });
    });
    container.querySelectorAll('[data-view]').forEach(function (el) {
      el.addEventListener('click', function () {
        var kind = el.dataset.view.split(':')[0];
        viewModal(kind, el.dataset.view.split(':')[1]);
      });
    });
    container.querySelectorAll('[data-content]').forEach(function (el) {
      el.addEventListener('click', function () { editPageContent(el.dataset.content); });
    });
  }

  /* --------------------------- content editor (CMS) ------------------------ */
  async function editPageContent(pageId) {
    let data;
    try {
      data = await api('/pages/' + pageId);
    } catch (e) {
      openModal('Error', '<p>' + esc(e.message) + '</p>');
      return;
    }
    var page = data.page;
    var blocks = data.blocks || [];
    if (!blocks.length) {
      openModal('Edit content — ' + page.title,
        '<p class="admin-muted">This page has no editable blocks yet. ' +
        'Mark any text in its HTML file with <code>data-cms="block-name"</code> ' +
        '(add <code>data-cms-html</code> for blocks that keep their markup) and it will appear here.</p>');
      return;
    }

    var rows = blocks.map(function (b) {
      var rowsCount = b.defaultValue.length > 140 ? 6 : 2;
      return '<div class="admin-block">' +
        '<div class="admin-block-head">' +
        '<label>' + esc(b.label) + (b.html ? ' <span class="admin-block-html">HTML</span>' : '') +
        (b.overridden ? ' <span class="admin-block-changed">edited</span>' : '') + '</label>' +
        '<span class="admin-block-key">' + esc(b.key) + '</span>' +
        '</div>' +
        '<textarea class="admin-input" data-block="' + esc(b.key) + '" rows="' + rowsCount + '">' + esc(b.value) + '</textarea>' +
        (b.overridden ? '<button type="button" class="admin-block-reset" data-reset="' + esc(b.key) + '">Reset to default</button>' : '') +
        '</div>';
    }).join('');

    openModal('Edit content — ' + page.title + '  (' + page.slug + ')',
      '<p class="admin-muted">Changes go live on the public site as soon as you save. ' +
      'Elements you leave untouched keep their original markup.</p>' + rows,
      '<span id="contentSaveStatus" style="font-size:14px;font-weight:600;align-self:center;margin-right:auto"></span>' +
      '<button class="admin-btn-secondary" data-close>Cancel</button>' +
      '<button class="admin-btn-primary" id="content-save">Save content</button>', true);

    document.querySelectorAll('[data-reset]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await api('/pages/' + pageId + '/blocks/' + encodeURIComponent(btn.dataset.reset), { method: 'DELETE' });
          editPageContent(pageId); // re-open with fresh state
        } catch (e) {
          openModal('Error', '<p>' + esc(e.message) + '</p>');
        }
      });
    });

    $('content-save').addEventListener('click', async function () {
      var status = $('contentSaveStatus');
      var payload = {};
      var changed = 0;
      document.querySelectorAll('#adminModalBody [data-block]').forEach(function (ta) {
        var key = ta.dataset.block;
        var original = (blocks.find(function (b) { return b.key === key; }) || {}).defaultValue;
        if (ta.value !== original) { payload[key] = ta.value; changed++; }
      });
      if (!changed) { status.textContent = 'Nothing to save'; status.style.color = '#5a6b84'; return; }
      this.disabled = true;
      status.textContent = 'Saving…';
      status.style.color = '#5a6b84';
      try {
        await api('/pages/' + pageId + '/blocks', { method: 'PUT', body: JSON.stringify({ blocks: payload }) });
        status.textContent = 'Saved — live on the site ✓';
        status.style.color = '#06a77d';
        setTimeout(function () { closeModal(); refresh(); }, 900);
      } catch (e) {
        status.textContent = e.message;
        status.style.color = '#e63946';
        this.disabled = false;
      }
    });
  }

  async function viewModal(kind, id) {
    var path = '/' + kind + 's/' + id;
    if (kind === 'enquiry') path = '/enquiries/' + id;
    try {
      var data = await api(path);
      var item = data[kind] || data.enquiry;
      if (!item) return;
      STORE[kind] = item;
      var rows = {
        Name: { value: kind === 'page' ? item.title : item.name || item.customerName },
        Email: item.email ? { value: item.email } : null,
        Subject: item.subject ? { value: item.subject } : null,
        Message: item.message ? { value: item.message } : null,
        Reply: item.reply ? { value: item.reply } : null,
        Company: item.company ? { value: item.company } : null,
        Phone: item.phone ? { value: item.phone } : null,
        'Invoice ID': item.invoiceId ? { value: item.invoiceId } : null,
        Amount: item.amount != null ? { value: fmtMoney(item.amount) } : null,
        Paid: item.paidAt ? { value: fmtDate(item.paidAt) } : null,
        Slug: item.slug ? { value: item.slug } : null,
        Status: { html: badge(kind, item.status) },
        Date: { value: fmtDate(item.date || item.createdAt || item.lastUpdated || item.updatedAt) }
      };
      openModal(kind.charAt(0).toUpperCase() + kind.slice(1) + ' details', fieldRows(clean(rows)));
    } catch (e) {
      openModal('Error', '<p>' + esc(e.message) + '</p>');
    }
  }
  function clean(rows) {
    var out = {};
    Object.keys(rows).forEach(function (k) { if (rows[k]) out[k] = rows[k]; });
    return out;
  }

  async function editModal(kind, id) {
    var titles = { customer: 'Edit customer', enquiry: 'Edit enquiry', payment: 'Edit payment', page: 'Edit page' };
    try {
      var data = await api('/' + (kind === 'enquiry' ? 'enquiries' : kind + 's') + '/' + id);
      var item = data[kind] || data.enquiry;
      if (!item) return;
      STORE[kind] = item;

      var body = '';
      var foot = '';
      if (kind === 'customer') {
        body =
          '<label>Full name (first / last)</label>' +
          '<div style="display:flex;gap:10px">' +
          '<input id="edit-firstName" class="admin-input" value="' + esc(item.name ? item.name.split(' ')[0] : '') + '">' +
          '<input id="edit-lastName" class="admin-input" value="' + esc(item.name ? item.name.split(' ').slice(1).join(' ') : '') + '"></div>' +
          '<label>Phone</label><input id="edit-phone" class="admin-input" value="' + esc(item.phone || '') + '">' +
          '<label>Company</label><input id="edit-company" class="admin-input" value="' + esc(item.company || '') + '">' +
          '<label>Status</label><select id="edit-status" class="admin-input">' +
          '<option value="active"' + (item.status === 'active' ? ' selected' : '') + '>Active</option>' +
          '<option value="inactive"' + (item.status === 'inactive' ? ' selected' : '') + '>Inactive</option></select>';
      } else if (kind === 'enquiry') {
        body =
          '<label>Message</label><p class="admin-muted">' + esc(item.message || '') + '</p>' +
          '<label>Reply</label><textarea id="edit-reply" class="admin-input" rows="4" placeholder="Type a reply…">' + esc(item.reply || '') + '</textarea>' +
          '<label>Status</label><select id="edit-status" class="admin-input">' +
          '<option value="new"' + (item.status === 'new' ? ' selected' : '') + '>New</option>' +
          '<option value="in-progress"' + (item.status === 'in-progress' ? ' selected' : '') + '>In Progress</option>' +
          '<option value="resolved"' + (item.status === 'resolved' ? ' selected' : '') + '>Resolved</option></select>';
      } else if (kind === 'payment') {
        body =
          '<label>Invoice ID</label><input class="admin-input" value="' + esc(item.invoiceId) + '" disabled>' +
          '<label>Customer</label><input class="admin-input" value="' + esc(item.customerName) + '" disabled>' +
          '<label>Amount (AUD)</label><input id="edit-amount" type="number" min="0" step="0.01" class="admin-input" value="' + esc(item.amount) + '">' +
          '<label>Status</label><select id="edit-status" class="admin-input">' +
          '<option value="completed"' + (item.status === 'completed' ? ' selected' : '') + '>Completed</option>' +
          '<option value="incomplete"' + (item.status === 'incomplete' ? ' selected' : '') + '>Incompleted</option></select>';
      } else if (kind === 'page') {
        body =
          '<label>Title</label><input class="admin-input" value="' + esc(item.title) + '" disabled>' +
          '<label>Slug</label><input class="admin-input" value="' + esc(item.slug) + '" disabled>' +
          '<label>Status</label><select id="edit-status" class="admin-input">' +
          '<option value="published"' + (item.status === 'published' ? ' selected' : '') + '>Published</option>' +
          '<option value="draft"' + (item.status === 'draft' ? ' selected' : '') + '>Draft</option></select>';
      }
      foot = '<button class="admin-btn-secondary" data-close>Cancel</button>' +
             '<button class="admin-btn-primary" id="edit-save">Save changes</button>';
      openModal(titles[kind], body, foot);
      $('edit-save').addEventListener('click', function () {
        saveEdit(kind, id);
      });
    } catch (e) {
      openModal('Error', '<p>' + esc(e.message) + '</p>');
    }
  }

  async function saveEdit(kind, id) {
    var payload = {};
    if (kind === 'customer') {
      payload = {
        firstName: $('edit-firstName').value.trim(),
        lastName: $('edit-lastName').value.trim(),
        phone: $('edit-phone').value.trim(),
        companyName: $('edit-company').value.trim(),
        status: $('edit-status').value
      };
    } else if (kind === 'enquiry') {
      payload = { status: $('edit-status').value, reply: $('edit-reply').value.trim() };
    } else if (kind === 'payment') {
      payload = { status: $('edit-status').value, amount: Number($('edit-amount').value) };
    } else if (kind === 'page') {
      payload = { status: $('edit-status').value };
    }
    try {
      await api('/' + (kind === 'enquiry' ? 'enquiries' : kind + 's') + '/' + id, {
        method: 'PATCH', body: JSON.stringify(payload)
      });
      closeModal();
      refresh();
    } catch (e) {
      openModal('Error', '<p>' + esc(e.message) + '</p>');
    }
  }

  /* ------------------------------ page renderers --------------------------- */
  var lastActivity = null; // latest /analytics/activity payload (for CSV export)

  async function renderDashboard() {
    var stats;
    try {
      stats = await api('/stats');
    } catch (e) { showOffline('stats unavailable'); return; }
    $('statTotalUsers').textContent = (stats.stats.totalUsers || 0).toLocaleString('en-AU');
    $('statActiveBookings').textContent = (stats.stats.activeBookings || 0).toLocaleString('en-AU');
    $('statPendingEnquiries').textContent = (stats.stats.pendingEnquiries || 0).toLocaleString('en-AU');
    $('statRevenue').textContent = fmtMoney(stats.stats.revenue);

    // Trend: website activity this week vs the previous week + live chart.
    try {
      var act = await api('/analytics/activity?days=30');
      var series = act.series || [];
      var recent = series.slice(-7).reduce(function (a, d) { return a + d.visits; }, 0);
      var prev = series.slice(-14, -7).reduce(function (a, d) { return a + d.visits; }, 0);
      var trendEl = $('statTotalUsersTrend');
      if (prev > 0 && trendEl) {
        var pct = Math.round(((recent - prev) / prev) * 100);
        var up = pct >= 0;
        trendEl.textContent = (up ? '↑ ' : '↓ ') + Math.abs(pct) + '% site activity vs last week';
        trendEl.style.color = up ? '#06a77d' : '#e63946';
      }
      renderChartInto($('dashboardChart'), series.slice(-14));
    } catch (e) { /* trends are cosmetic */ }

    var body = $('recentRequestsBody');
    if (body && stats.recentRequests) {
      body.innerHTML = stats.recentRequests.map(requestRow).join('') ||
        '<tr><td colspan="4">No recent service requests</td></tr>';
      bindActions(body);
    }
    var list = $('recentEnquiriesList');
    if (list && stats.recentEnquiries) {
      list.innerHTML = stats.recentEnquiries.map(function (e) {
        return '<div class="enquiry-item">' +
          '<h4>' + esc(e.name) + '</h4>' +
          '<p>' + esc(truncate(e.preview, 60)) + '</p>' +
          '<button data-edit="enquiry:' + e.id + '" style="cursor:pointer">Reply</button>' +
          '</div>';
      }).join('') || '<div class="enquiry-item"><p>No recent enquiries</p></div>';
      bindActions(list);
    }
  }

  async function renderCustomers() {
    try {
      var data = await api('/customers');
      $('customersBody').innerHTML = data.customers.map(customerRow).join('') ||
        '<tr><td colspan="6">No customers yet</td></tr>';
      bindActions($('customersBody'));
    } catch (e) { showOffline('customer list unavailable'); }
  }

  async function renderEnquiries() {
    try {
      var data = await api('/enquiries');
      $('enquiriesBody').innerHTML = data.enquiries.map(enquiryRow).join('') ||
        '<tr><td colspan="6">No enquiries yet</td></tr>';
      bindActions($('enquiriesBody'));
    } catch (e) { showOffline('enquiry list unavailable'); }
  }

  async function renderPayments() {
    try {
      var data = await api('/payments');
      $('paymentsBody').innerHTML = data.payments.map(paymentRow).join('') ||
        '<tr><td colspan="6">No payments yet</td></tr>';
      bindActions($('paymentsBody'));
    } catch (e) { showOffline('payment list unavailable'); }
  }

  async function renderContent() {
    try {
      var data = await api('/pages');
      $('pagesBody').innerHTML = data.pages.map(pageRow).join('') ||
        '<tr><td colspan="4">No pages yet</td></tr>';
      bindActions($('pagesBody'));
    } catch (e) { showOffline('page list unavailable'); }

    // "+ Add New Page" (bind once — refresh() re-runs this renderer)
    var addBtn = document.querySelector('.add-page-btn');
    if (addBtn && !addBtn.__esaBound) {
      addBtn.__esaBound = true;
      addBtn.style.cursor = 'pointer';
      addBtn.addEventListener('click', function () {
        openModal('Add new page',
          '<label>Page title</label><input id="new-page-title" class="admin-input" placeholder="e.g. Case Studies">' +
          '<label>Slug (optional)</label><input id="new-page-slug" class="admin-input" placeholder="case-studies.html">',
          '<button class="admin-btn-secondary" data-close>Cancel</button>' +
          '<button class="admin-btn-primary" id="new-page-save">Create page</button>');
        $('new-page-save').addEventListener('click', async function () {
          try {
            await api('/pages', {
              method: 'POST',
              body: JSON.stringify({
                title: $('new-page-title').value.trim(),
                slug: $('new-page-slug').value.trim() || undefined
              })
            });
            closeModal();
            refresh();
          } catch (e) {
            openModal('Error', '<p>' + esc(e.message) + '</p>');
          }
        });
      });
    }
  }

  async function renderAnalytics() {
    var range = $('activityRange');
    var days = range ? (range.value === '30' ? 30 : 7) : 7;

    // Stat cards (same endpoint as the dashboard).
    try {
      var stats = await api('/stats');
      if ($('statTotalUsers')) $('statTotalUsers').textContent = (stats.stats.totalUsers || 0).toLocaleString('en-AU');
      if ($('statActiveBookings')) $('statActiveBookings').textContent = (stats.stats.activeBookings || 0).toLocaleString('en-AU');
      if ($('statPendingEnquiries')) $('statPendingEnquiries').textContent = (stats.stats.pendingEnquiries || 0).toLocaleString('en-AU');
      if ($('statRevenue')) $('statRevenue').textContent = fmtMoney(stats.stats.revenue);
    } catch (e) { /* stats are cosmetic here */ }

    var act;
    try {
      act = await api('/analytics/activity?days=' + days);
    } catch (e) { showOffline('activity data unavailable'); return; }
    lastActivity = act;

    renderChart(act.series || []);

    // Bind the controls once — the handler re-renders itself.
    if (range && !range.__esaBound) {
      range.__esaBound = true;
      range.addEventListener('change', function () { renderAnalytics(); });
    }
    var exportBtn = $('exportActivity');
    if (exportBtn && !exportBtn.__esaBound) {
      exportBtn.__esaBound = true;
      exportBtn.addEventListener('click', function () {
        if (!lastActivity) return;
        var csv = 'date,visits,enquiries\n' + (lastActivity.series || []).map(function (d) {
          return d.date + ',' + d.visits + ',' + d.enquiries;
        }).join('\n');
        var blob = new Blob([csv], { type: 'text/csv' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'esa-website-activity.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    }
  }

  function renderChartInto(svg, series) {
    if (!svg || !series || !series.length) return;
    var W = 1000, H = 300, PAD = 20;
    var maxVisits = Math.max.apply(null, series.map(function (d) { return d.visits; })) || 1;
    var maxEnq = Math.max.apply(null, series.map(function (d) { return d.enquiries; })) || 1;
    var x = function (i) { return PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1); };
    var yVisits = function (v) { return H - PAD - (v / maxVisits) * (H - PAD * 2); };
    var yEnq = function (v) { return H - PAD - (v / maxEnq) * (H - PAD * 2); };
    var pts = function (fn) { return series.map(function (d, i) { return x(i).toFixed(1) + ',' + fn(d).toFixed(1); }).join(' '); };

    var lines =
      '<polyline fill="none" stroke="#06b6d4" stroke-width="4" stroke-linejoin="round" points="' + pts(function (d) { return yVisits(d.visits); }) + '"/>' +
      '<polyline fill="none" stroke="#84cc16" stroke-width="4" stroke-linejoin="round" points="' + pts(function (d) { return yEnq(d.enquiries); }) + '"/>';

    // #activityChart is a native <svg> (keeps its viewBox); the dashboard
    // target is a plain div that needs a full svg element.
    if (svg.tagName && svg.tagName.toLowerCase() === 'svg') {
      svg.innerHTML = lines;
    } else {
      svg.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + lines + '</svg>';
    }
  }
  function renderChart(series) { renderChartInto($('activityChart'), series); }

  async function renderSettings() {
    var form = $('settingsForm');
    if (!form) return;
    try {
      var data = await api('/settings');
      var s = data.settings || {};
      $('settingsSiteName').value = s.siteName || '';
      $('settingsAdminEmail').value = s.adminEmail || '';
      $('settingsTimezone').value = s.timezone || '';
      $('settingsLanguage').value = s.language || '';
    } catch (e) { showOffline('settings unavailable'); return; }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('settingsSaveBtn');
      var status = $('settingsStatus');
      btn.disabled = true;
      status.textContent = 'Saving…';
      status.style.color = '#5a6b84';
      try {
        await api('/settings', {
          method: 'PUT',
          body: JSON.stringify({
            siteName: $('settingsSiteName').value,
            adminEmail: $('settingsAdminEmail').value,
            timezone: $('settingsTimezone').value,
            language: $('settingsLanguage').value
          })
        });
        status.textContent = 'Saved ✓';
        status.style.color = '#06a77d';
      } catch (err) {
        status.textContent = err.message;
        status.style.color = '#e63946';
      } finally {
        btn.disabled = false;
      }
    });
  }

  var RENDERERS = {
    dashboard: renderDashboard,
    customers: renderCustomers,
    enquiries: renderEnquiries,
    payments: renderPayments,
    content: renderContent,
    analytics: renderAnalytics,
    settings: renderSettings
  };

  function refresh() {
    var page = document.body.dataset.adminPage;
    var fn = RENDERERS[page];
    if (fn) fn();
  }

  /* --------------------------------- boot ---------------------------------- */
  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.body.dataset.adminPage) return; // not an admin page
    var ok = await guard();
    if (ok) refresh();
  });

  // Rebind modal foot "Cancel" buttons (innerHTML swap loses listeners).
  var _origOpen = openModal;
  openModal = function (title, bodyHtml, footHtml, wide) {
    _origOpen(title, bodyHtml, footHtml, wide);
    document.querySelectorAll('#adminModalFoot [data-close]').forEach(function (b) {
      b.addEventListener('click', closeModal);
    });
  };
})();
