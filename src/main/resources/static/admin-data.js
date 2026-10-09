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
 *     add-page, settings save, booking trend chart.
 *
 * Pages opt in with <body data-admin-page="dashboard|customers|
 * enquiries|payments|content|settings">.
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
    // Updated message: backend can be either Node (npm start) or Spring Boot (mvn spring-boot:run)
    banner.innerHTML =
      '<strong>Backend offline</strong> — ' + esc(detail || 'showing static demo data') +
      '. Start the server (<code>npm start</code> or <code>mvn spring-boot:run</code>) and reload. ' +
      '<button onclick="location.reload()" style="margin-left:10px;padding:4px 10px;cursor:pointer">Retry</button>';
    var wrapper = document.querySelector('.dashboard-wrapper');
    if (wrapper) wrapper.insertBefore(banner, wrapper.firstChild);
    else document.body.insertBefore(banner, document.body.firstChild);
    console.warn('[ESA] Backend offline:', detail);
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
    // unwrap the td from actionIcons so we can squeeze one more button in
    var actions = actionIcons('payment', p.id).replace(/^<td[^>]*>|<\/td>$/g, '');
    // once the bank transfer shows up in the feed the office ticks it off here
    if (p.status !== 'completed') {
      actions += ' <button class="admin-btn-secondary" data-mark-paid="' + p.id + '" style="margin-left:6px">Mark paid</button>';
    }
    // how it was paid: card shows the last 4, transfers say so
    var howPaid = '';
    if (p.method === 'card' && p.cardLast4) howPaid = '<br><span class="admin-muted">card \u2022\u2022\u2022\u2022 ' + esc(p.cardLast4) + '</span>';
    else if (p.method === 'transfer') howPaid = '<br><span class="admin-muted">bank transfer</span>';
    return '<tr>' +
      '<td>' + esc(p.invoiceId) + howPaid + '</td>' +
      '<td>' + esc(p.customerName) + '</td>' +
      '<td>' + esc(fmtMoney(p.amount)) + '</td>' +
      '<td>' + badge('payment', p.status) + '</td>' +
      '<td>' + esc(p.paidAt ? fmtDate(p.paidAt) : '—') + '</td>' +
      '<td class="action-icons">' + actions + '</td>' +
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
  var STORE = { customer: null, enquiry: null, payment: null, page: null, bookings: null };

  /* Client-side pagination for the big tables. Called after every render:
     rows over pageSize get hidden and a Prev/Next pager is built under the
     table. Small lists just show everything with no pager. */
  function paginate(bodyId, pageSize) {
    var body = $(bodyId);
    if (!body) return;
    var table = body.closest('table');
    var card = table.closest('.dashboard-card') || table.parentNode;
    var oldPager = document.getElementById(bodyId + 'Pager');
    if (oldPager) oldPager.remove();
    var rows = Array.prototype.slice.call(body.querySelectorAll('tr'));
    if (rows.length <= pageSize) {
      rows.forEach(function (r) { r.style.display = ''; });
      return;
    }
    var page = 0;
    var pages = Math.ceil(rows.length / pageSize);
    var pager = document.createElement('div');
    pager.className = 'table-pager';
    pager.id = bodyId + 'Pager';
    pager.innerHTML = '<span class="pager-info"></span>' +
      '<button type="button" class="pager-prev">Prev</button>' +
      '<button type="button" class="pager-next">Next</button>';
    card.appendChild(pager);
    function draw() {
      rows.forEach(function (r, i) {
        r.style.display = (i >= page * pageSize && i < (page + 1) * pageSize) ? '' : 'none';
      });
      pager.querySelector('.pager-info').textContent =
        'Showing ' + (page * pageSize + 1) + '-' + Math.min((page + 1) * pageSize, rows.length) + ' of ' + rows.length;
      pager.querySelector('.pager-prev').disabled = (page === 0);
      pager.querySelector('.pager-next').disabled = (page === pages - 1);
    }
    pager.querySelector('.pager-prev').addEventListener('click', function () { if (page > 0) { page--; draw(); } });
    pager.querySelector('.pager-next').addEventListener('click', function () { if (page < pages - 1) { page++; draw(); } });
    draw();
  }

  /* Export whatever is in a table to CSV. Every row is already in the DOM
     (pagination just hides some), so this grabs the full list, not just the
     visible page. Same trick as the portal payments export. */
  window.exportTableCsv = function (bodyId, filename) {
    var body = $(bodyId);
    if (!body) return;
    var table = body.closest('table');
    var rows = [];
    var heads = table.querySelectorAll('thead th');
    rows.push(Array.prototype.map.call(heads, function (th) { return th.textContent.trim(); }));
    body.querySelectorAll('tr').forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      if (!cells.length) return;
      rows.push(Array.prototype.map.call(cells, function (td) { return td.textContent.trim(); }));
    });
    if (rows.length <= 1) {
      if (window.showToast) window.showToast('Nothing to export yet.');
      return;
    }
    var csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    if (window.showToast) window.showToast('CSV downloaded (' + (rows.length - 1) + ' rows).', 'ok');
  };

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
    container.querySelectorAll('[data-booking-view]').forEach(function (el) {
      el.addEventListener('click', function () { bookingDetailModal(el.dataset.bookingView); });
    });
    container.querySelectorAll('[data-mark-paid]').forEach(function (el) {
      el.addEventListener('click', async function () {
        var yes = await window.esaConfirm('Mark payment completed?',
          'Only do this once the transfer is visible in the bank feed.', 'Mark completed');
        if (!yes) return;
        try {
          await api('/payments/' + el.dataset.markPaid, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
          if (window.showToast) window.showToast('Payment marked completed.', 'ok');
          refresh();
        } catch (e) { if (window.showToast) window.showToast(e.message, 'err'); }
      });
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
  async function renderDashboard() {
    var stats;
    try {
      stats = await api('/stats');
    } catch (e) { showOffline('stats unavailable'); return; }
    $('statTotalUsers').textContent = (stats.stats.totalUsers || 0).toLocaleString('en-AU');
    $('statActiveBookings').textContent = (stats.stats.activeBookings || 0).toLocaleString('en-AU');
    $('statPendingEnquiries').textContent = (stats.stats.pendingEnquiries || 0).toLocaleString('en-AU');
    $('statRevenue').textContent = fmtMoney(stats.stats.revenue);

    // work queue: only show the card when there is actually something to do
    var alerts = stats.alerts || {};
    var alertsCard = $('alertsCard');
    var alertsList = $('alertsList');
    if (alertsCard && alertsList) {
      var items = [];
      if (alerts.newEnquiries) {
        items.push({ n: alerts.newEnquiries, text: 'new ' + (alerts.newEnquiries === 1 ? 'enquiry' : 'enquiries') + ' waiting for a reply', href: 'enquiries.html' });
      }
      if (alerts.pendingPayments) {
        items.push({ n: alerts.pendingPayments, text: 'payment' + (alerts.pendingPayments === 1 ? '' : 's') + ' to confirm against the bank feed', href: 'payments.html' });
      }
      if (alerts.bookingsNext7Days) {
        items.push({ n: alerts.bookingsNext7Days, text: 'booking' + (alerts.bookingsNext7Days === 1 ? '' : 's') + ' in the next 7 days', href: 'bookings.html' });
      }
      if (items.length) {
        alertsList.innerHTML = items.map(function (it) {
          return '<a class="alert-row" href="' + it.href + '">' +
            '<span class="alert-n">' + it.n + '</span> ' + it.text +
            ' <i class="fa-solid fa-arrow-right" style="margin-left:auto"></i></a>';
        }).join('');
        alertsCard.style.display = '';
      } else {
        alertsCard.style.display = 'none';
      }
    }

    // Trend: bookings this week vs last week, from real booking rows.
    try {
      var thisWeek = stats.bookingsThisWeek || 0;
      var lastWeek = stats.bookingsLastWeek || 0;
      var trendEl = $('statTotalUsersTrend');
      if (trendEl) {
        if (lastWeek > 0) {
          var pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
          var up = pct >= 0;
          trendEl.textContent = (up ? '↑ ' : '↓ ') + Math.abs(pct) + '% bookings vs last week';
          trendEl.style.color = up ? '#06a77d' : '#e63946';
        } else {
          trendEl.textContent = thisWeek + ' this week';
          trendEl.style.color = '#5a6b84';
        }
      }
      renderChartInto($('dashboardChart'), stats.bookingsByDay || []);
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
      paginate('customersBody', 12);
    } catch (e) { showOffline('customer list unavailable'); }
  }

  async function renderEnquiries() {
    try {
      var data = await api('/enquiries');
      $('enquiriesBody').innerHTML = data.enquiries.map(enquiryRow).join('') ||
        '<tr><td colspan="6">No enquiries yet</td></tr>';
      bindActions($('enquiriesBody'));
      paginate('enquiriesBody', 12);
    } catch (e) { showOffline('enquiry list unavailable'); }
  }

  /**
   * Bookings come from GET /api/admin/bookings, which projects the Booking
   * entity into the seven fields this table renders (see
   * AdminDataService.bookings()). There is no GET /api/admin/bookings/{id}, so
   * the detail modal is built from the row already in the list.
   */
  async function renderBookings() {
    var body = $('bookingsAdminBody');
    if (!body) return;
    try {
      var data = await api('/bookings');
      var bookings = data.bookings || [];
      STORE.bookings = bookings;
      body.innerHTML = bookings.map(bookingAdminRow).join('') ||
        '<tr><td colspan="7">No bookings yet</td></tr>';
      bindActions(body);
      paginate('bookingsAdminBody', 12);
    } catch (e) { showOffline('booking list unavailable'); }
  }

  function bookingAdminRow(b) {
    return '<tr>' +
      '<td>#' + esc(b.bookingId) + '</td>' +
      '<td>' + esc(b.customer) + '</td>' +
      '<td>' + esc(b.service) + '</td>' +
      '<td>' + esc(fmtDate(b.date)) + '</td>' +
      '<td>' + esc(b.email) + '</td>' +
      '<td>' + badge('booking', b.status) + '</td>' +
      '<td class="action-icons">' +
      '<i class="fa-regular fa-eye" data-booking-view="' + esc(b.bookingId) + '" title="View" style="cursor:pointer"></i>' +
      '</td>' +
      '</tr>';
  }

  function bookingDetailModal(bookingId) {
    var b = (STORE.bookings || []).find(function (x) { return String(x.bookingId) === String(bookingId); });
    if (!b) return;
    var rows = {
      'Booking': { value: '#' + b.bookingId },
      'Customer': { value: b.customer || '—' },
      'Service': { value: b.service || '—' },
      'Status': { value: b.status || '—' },
      'Booking date': { value: fmtDate(b.date) },
      'Email': { value: b.email || '—' },
      'Phone': { value: b.phone || '—' },
      'ABN': { value: b.abn || '—' },
      'Notes': { value: b.notes || '—' },
      'Created': { value: fmtDate(b.createdAt) }
    };
    openModal('Booking #' + b.bookingId, fieldRows(rows));
  }

  async function renderPayments() {
    try {
      var data = await api('/payments');
      $('paymentsBody').innerHTML = data.payments.map(paymentRow).join('') ||
        '<tr><td colspan="6">No payments yet</td></tr>';
      bindActions($('paymentsBody'));
      paginate('paymentsBody', 12);
    } catch (e) { showOffline('payment list unavailable'); }
  }

  async function renderContent() {
    try {
      var data = await api('/pages');
      $('pagesBody').innerHTML = data.pages.map(pageRow).join('') ||
        '<tr><td colspan="4">No pages yet</td></tr>';
      bindActions($('pagesBody'));
      paginate('pagesBody', 12);
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

  /**
   * Dashboard chart: bookings per day over the last 14 days, from real booking
   * rows. The previous version drew two series (visits + enquiries) fed by the
   * analytics endpoint, which only ever recorded hits on a single page.
   */
  function renderChartInto(svg, series) {
    if (!svg || !series || !series.length) return;
    var W = 1000, H = 300, PAD = 20;
    var max = Math.max.apply(null, series.map(function (d) { return d.bookings || 0; })) || 1;
    var x = function (i) { return PAD + (i * (W - PAD * 2)) / Math.max(1, series.length - 1); };
    var y = function (v) { return H - PAD - (v / max) * (H - PAD * 2); };
    var points = series.map(function (d, i) { return x(i).toFixed(1) + ',' + y(d.bookings || 0).toFixed(1); }).join(' ');
    var area = points + ' ' + x(series.length - 1).toFixed(1) + ',' + (H - PAD) + ' ' + x(0).toFixed(1) + ',' + (H - PAD);

    var lines =
      '<polygon fill="rgba(6,182,212,0.12)" points="' + area + '"/>' +
      '<polyline fill="none" stroke="#06b6d4" stroke-width="4" stroke-linejoin="round" points="' + points + '"/>';

    // #dashboardChart is a plain div, so a full <svg> wrapper is required.
    svg.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' + lines + '</svg>';
  }

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
    bookings: renderBookings,
    content: renderContent,
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
