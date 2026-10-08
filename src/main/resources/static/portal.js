/**
 * Customer portal (portal.html).
 *
 * Every call carries the bearer token from auth.js and is scoped server-side to
 * the email inside it - this file never sends a customer identity of its own.
 * The portal is read-only apart from three actions the customer owns: saving
 * their details, changing their password, and cancelling an unpaid booking.
 */
(function () {
  "use strict";

  var state = { bookings: [], enquiries: [], payments: [], profile: null };

  /* ------------------------------ bootstrap ----------------------------- */

  document.addEventListener("DOMContentLoaded", function () {
    // A portal page is meaningless without a session; auth.js clears an expired
    // one and this redirects a visitor who simply is not signed in.
    if (typeof getToken !== "function" || !getToken()) {
      window.location.href = "signin.html";
      return;
    }
    bindTabs();
    bindForms();
    bindConfirm();
    bindReschedule();
    var exportBtn = $("exportPayments");
    if (exportBtn) exportBtn.addEventListener("click", exportPaymentsCsv);
    updateHeaderButtons();
    personalise();
    activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
    load();
  });

  /* -------------------------------- api --------------------------------- */

  async function call(path, options) {
    var opts = options || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    var res = await fetch("/api/portal" + path, opts);
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) {
      if (res.status === 401) {
        // Expired or forged token: drop the session and start again rather than
        // looping on a 401 for every panel.
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "signin.html";
        throw new Error("Session expired");
      }
      var err = new Error((data && data.message) || "Something went wrong on our side. Please try again.");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* -------------------------------- data -------------------------------- */

  async function load() {
    try {
      var data = await call("/summary");
      state.bookings = data.bookings || [];
      state.enquiries = data.enquiries || [];
      state.payments = data.payments || [];
      state.profile = data.profile || null;
      hideOffline();
      renderAll();
    } catch (e) {
      showOffline(e.message || "Your portal is unavailable right now. Please try again shortly.");
    }
  }

  function renderAll() {
    renderOverview();
    renderBookings();
    renderEnquiries();
    renderPayments();
    renderProfile();
    $("tabBookingsCount").textContent = state.bookings.length;
    $("tabEnquiriesCount").textContent = state.enquiries.length;
    $("tabPaymentsCount").textContent = state.payments.length;
  }

  /* ------------------------------ overview ------------------------------ */

  function renderOverview() {
    var outstanding = state.bookings.filter(function (b) { return b.canPay; })
                                    .reduce(function (a, b) { return a + money(b.fee); }, 0);
    var paid = state.payments.filter(function (p) { return p.paid; })
                             .reduce(function (a, p) { return a + money(p.amount); }, 0);
    var openEnquiries = state.enquiries.filter(function (e) { return e.status !== "resolved"; }).length;
    var upcoming = state.bookings.filter(function (b) {
      return b.status !== "cancelled" && b.status !== "completed";
    }).length;

    $("ovBookings").textContent = state.bookings.length;
    $("ovBookingsSub").textContent = upcoming + " still open";
    $("ovOutstanding").textContent = fmt(outstanding);
    $("ovOutstandingSub").textContent = outstanding > 0
      ? state.bookings.filter(function (b) { return b.canPay; }).length + " booking(s) awaiting payment"
      : "Nothing to pay";
    $("ovPaid").textContent = fmt(paid);
    $("ovPaidSub").textContent = paid > 0 ? "Across " + state.payments.filter(function (p) { return p.paid; }).length + " payment(s)" : "No payments yet";
    $("ovEnquiries").textContent = openEnquiries;
    $("ovEnquiriesSub").textContent = openEnquiries > 0 ? "Awaiting our reply" : "All caught up";

    var recent = state.bookings.slice(0, 5);
    $("ovRecentBookings").innerHTML = recent.length
      ? tableWrap(
          head(["Booking", "Service", "Status", "Fee", ""]),
          recent.map(function (b) {
            return "<tr>" +
              cell("#" + esc(b.bookingId) + (b.bookingDate ? "<br><small>" + esc(b.bookingDate) + "</small>" : "")) +
              cell(esc(b.service)) +
              cell(badge(b.status)) +
              cell(fmt(money(b.fee))) +
              cell('<div class="portal-actions">' + bookingButtons(b) + "</div>") +
              "</tr>";
          }).join(""))
      : empty("You have not made a booking yet. <a href='booking.html'>Book a consultation</a>.");
  }

  /* ------------------------------ bookings ------------------------------ */

  function renderBookings() {
    var rows = state.bookings.map(function (b) {
      return "<tr>" +
        cell("#" + esc(b.bookingId) + (b.bookingDate ? "<br><small>" + esc(b.bookingDate) + "</small>" : "")) +
        cell(esc(b.service)) +
        cell(badge(b.status) + timeline(b)) +
        cell(badge(b.paymentStatus) + (b.paymentReference ? "<br><small>" + esc(b.paymentReference) + "</small>" : "")) +
        cell(fmt(money(b.fee))) +
        cell('<div class="portal-actions">' + bookingButtons(b) + "</div>") +
        "</tr>";
    }).join("");

    $("bookingsBody").innerHTML = state.bookings.length
      ? tableWrap(head(["Booking", "Service", "Status", "Payment", "Fee", ""]), rows)
      : empty("You have not made a booking yet. <a href='booking.html'>Book a consultation</a>.");
  }

  // little progress pills: received -> fee logged -> confirmed -> completed
  function timeline(b) {
    if (b.status === "cancelled") {
      return '<div class="portal-timeline"><span class="t-dot off">Cancelled</span></div>';
    }
    var steps = ["Received", "Fee logged", "Confirmed", "Completed"];
    var done = 1; // everyone gets received, they are in the list after all
    if (b.paymentStatus === "pending" || b.paymentStatus === "completed") done = 2;
    if (b.status === "confirmed") done = 3;
    if (b.status === "completed") done = 4;
    var html = steps.map(function (label, i) {
      return '<span class="t-dot' + (i < done ? " on" : "") + '">' + label + "</span>";
    }).join("");
    return '<div class="portal-timeline">' + html + "</div>";
  }

  function bookingButtons(b) {
    var out = "";
    if (b.canPay) {
      out += '<button class="btn-mini primary" data-pay="' + esc(b.bookingId) + '">Pay ' + fmt(money(b.fee)) + "</button>";
    }
    if (b.canCancel) {
      out += '<button class="btn-mini danger" data-cancel="' + esc(b.bookingId) + '">Cancel</button>';
    }
    // can move it themselves while its still open
    if (b.status === "pending" || b.status === "confirmed") {
      out += '<button class="btn-mini" data-reschedule="' + esc(b.bookingId) + '">Reschedule</button>';
    }
    return out || '<span style="color:var(--muted);font-size:.8rem">—</span>';
  }

  /* ----------------------------- enquiries ------------------------------ */

  /* --------------------------- reschedule dialog ------------------------- */

  var rescheduleId = null;

  var reschedOpener = null; // button that opened the dialog, so focus can go back

  function openReschedule(id) {
    rescheduleId = id;
    reschedOpener = document.activeElement;
    var b = state.bookings.filter(function (x) { return String(x.bookingId) === String(id); })[0];
    if (b && b.bookingDate) $("reschedDate").value = b.bookingDate;
    if (b && b.preferredSlot) $("reschedSlot").value = b.preferredSlot;
    $("reschedNote").className = "portal-note";
    $("reschedBackdrop").classList.add("open");
    $("reschedDate").focus();
  }

  function closeReschedule() {
    $("reschedBackdrop").classList.remove("open");
    if (reschedOpener && reschedOpener.focus) reschedOpener.focus();
  }

  function bindReschedule() {
    $("reschedCancel").addEventListener("click", closeReschedule);
    // click on the dark part behind the dialog closes it too
    $("reschedBackdrop").addEventListener("click", function (e) {
      if (e.target === $("reschedBackdrop")) closeReschedule();
    });
    // escape closes, and tab stays inside the dialog while its open
    document.addEventListener("keydown", function (e) {
      if (!$("reschedBackdrop").classList.contains("open")) return;
      if (e.key === "Escape") { closeReschedule(); return; }
      if (e.key === "Tab") {
        var focusables = $("reschedBackdrop").querySelectorAll('input, select, button, [href]');
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    $("reschedSave").addEventListener("click", async function () {
      if (!rescheduleId) return;
      var note = noteEl($("reschedNote"));
      note.clear();
      try {
        await call("/bookings/" + encodeURIComponent(rescheduleId) + "/reschedule", {
          method: "POST",
          body: JSON.stringify({
            preferredDate: $("reschedDate").value,
            preferredSlot: $("reschedSlot").value
          })
        });
        closeReschedule();
        if (window.showToast) window.showToast("Booking moved - we emailed you the new details.", "ok");
        await load();
      } catch (e) {
        note.err(e.message);
      }
    });
  }

  /* ------------------------- payments csv export ------------------------- */
  // builds the csv in the browser, no server round trip needed
  function exportPaymentsCsv() {
    if (!state.payments.length) {
      if (window.showToast) window.showToast("No payments to export yet.");
      return;
    }
    var lines = ["Reference,Booking,Name,Amount,Status,Date"];
    state.payments.forEach(function (p) {
      lines.push([p.reference, p.bookingId || "", p.customerName, p.amount, p.status, (p.paymentDate || "").slice(0, 10)]
        .map(function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; })
        .join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "esa-payments.csv";
    a.click();
    if (window.showToast) window.showToast("CSV downloaded (" + state.payments.length + " payments).", "ok");
  }

  function renderEnquiries() {
    var rows = state.enquiries.map(function (e) {
      return "<tr>" +
        cell("#" + esc(e.id) + (e.createdAt ? "<br><small>" + esc(e.createdAt.slice(0, 10)) + "</small>" : "")) +
        cell(esc(e.service)) +
        cell('<div>' + esc(trunc(e.message, 90)) + "</div>" +
             (e.reply ? '<div class="portal-reply"><strong>Our reply:</strong> ' + esc(e.reply) + "</div>" : "")) +
        cell(badge(e.status)) +
        cell('<div class="portal-actions">' +
             (e.status === "resolved"
               ? '<button class="btn-mini" data-reopen="' + esc(e.id) + '">Reopen</button>'
               : '<span style="color:var(--muted);font-size:.8rem">With our team</span>') +
             "</div>") +
        "</tr>";
    }).join("");

    $("enquiriesBody").innerHTML = state.enquiries.length
      ? tableWrap(head(["Enquiry", "Service", "Message", "Status", ""]), rows)
      : empty("You have not sent an enquiry yet. <a href='contact.html'>Send an enquiry</a>.");
  }

  /* ------------------------------ payments ------------------------------ */

  function renderPayments() {
    var rows = state.payments.map(function (p) {
      return "<tr>" +
        cell(esc(p.reference) || "—") +
        cell(p.bookingId ? "#" + esc(p.bookingId) : "—") +
        cell(esc(p.customerName)) +
        cell(fmt(money(p.amount))) +
        cell(badge(p.status)) +
        cell(p.paymentDate ? esc(p.paymentDate.slice(0, 10)) : "—") +
        cell('<div class="portal-actions">' +
             (p.status === "pending" || p.status === "completed"
               ? '<a class="btn-mini" href="receipt.html?payment=' + esc(p.id) + '">Receipt</a>'
               : '<span style="color:var(--muted);font-size:.8rem">—</span>') +
             "</div>") +
        "</tr>";
    }).join("");

    $("paymentsBody").innerHTML = state.payments.length
      ? tableWrap(head(["Reference", "Booking", "Name", "Amount", "Status", "Date", ""]), rows)
      : empty("No payments yet. A payment appears here once you pay a consultation fee.");
  }

  /* ------------------------------- profile ------------------------------ */

  function renderProfile() {
    var p = state.profile || {};
    $("profileName").value = p.fullName || "";
    $("profilePhone").value = p.phoneNumber || "";
    $("profileCompany").value = p.companyName || "";
    $("profileEmail").value = p.email || "";
  }

  /* -------------------------------- tabs -------------------------------- */

  function bindTabs() {
    var tabs = document.querySelectorAll(".portal-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var panels = document.querySelectorAll(".portal-panel");
        panels.forEach(function (p) { p.classList.remove("active"); });
        $("panel-" + tab.getAttribute("data-tab")).classList.add("active");
        // keep the URL shareable/bookmarkable (#bookings, #payments ...)
        if (window.history && history.replaceState) {
          history.replaceState(null, "", "#" + tab.getAttribute("data-tab"));
        }
      });
    });
  }

  /* Greet the signed-in customer and show their initials in the hero. */
  function personalise() {
    var user = (typeof getUser === "function") ? getUser() : null;
    var greet = $("portalGreeting");
    if (greet && user && user.firstName) {
      greet.textContent = "Welcome back, " + user.firstName + ".";
    }
    var avatar = $("portalAvatar");
    if (avatar) {
      var initials = user
        ? (String(user.firstName || "").charAt(0) + String(user.lastName || "").charAt(0)).toUpperCase()
        : "";
      avatar.textContent = initials || "ESA";
    }
  }

  /* Open the tab the URL points at, e.g. portal.html#bookings from the
     header account menu. */
  function activateFromHash() {
    var hash = (window.location.hash || "").replace("#", "");
    if (!hash) return;
    var tab = document.querySelector('.portal-tab[data-tab="' + hash + '"]');
    if (tab) tab.click();
  }

  /* -------------------------------- forms ------------------------------- */

  function bindForms() {
    $("profileForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var note = noteEl($("profileNote"));
      note.clear();
      try {
        var data = await call("/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: $("profileName").value,
            phoneNumber: $("profilePhone").value,
            companyName: $("profileCompany").value
          })
        });
        state.profile = data.profile;
        // Keep the header greeting and localStorage copy in step with the edit.
        if (typeof getUser === "function" && getUser()) {
          var user = getUser();
          user.name = data.profile.fullName;
          user.firstName = (data.profile.fullName || "").split(" ")[0];
          user.phone = data.profile.phoneNumber;
          user.company = data.profile.companyName;
          localStorage.setItem("user", JSON.stringify(user));
          updateHeaderButtons();
        }
        note.ok("Your details have been saved.");
      } catch (err) {
        note.err(err.message);
      }
    });

    $("passwordForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var note = noteEl($("passwordNote"));
      note.clear();
      var next = $("newPassword").value;
      if (next !== $("confirmPassword").value) {
        note.err("The new passwords do not match.");
        return;
      }
      if (next.length < 8) {
        note.err("Your new password must be at least 8 characters long.");
        return;
      }
      if (!/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
        note.err("Your new password needs an uppercase letter, a lowercase letter and a number.");
        return;
      }
      try {
        await call("/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: $("currentPassword").value,
            newPassword: next
          })
        });
        note.ok("Your password has been changed.");
        $("passwordForm").reset();
      } catch (err) {
        note.err(err.message);
      }
    });

    // Delegated actions for the booking and enquiry tables.
    document.addEventListener("click", function (e) {
      var pay = e.target.closest("[data-pay]");
      if (pay) { window.location.href = "payment.html?booking=" + encodeURIComponent(pay.getAttribute("data-pay")); return; }

      var cancel = e.target.closest("[data-cancel]");
      if (cancel) { askCancel(cancel.getAttribute("data-cancel")); return; }

      var resched = e.target.closest("[data-reschedule]");
      if (resched) { openReschedule(resched.getAttribute("data-reschedule")); return; }

      var reopen = e.target.closest("[data-reopen]");
      if (reopen) { doReopen(reopen.getAttribute("data-reopen")); return; }
    });
  }

  async function askCancel(bookingId) {
    var booking = state.bookings.find(function (b) { return String(b.bookingId) === String(bookingId); });
    var ok = await confirmDialog(
      "Cancel this booking?",
      "Booking #" + bookingId + (booking ? " (" + booking.service + ")" : "") +
        " will be cancelled. You can make a new booking at any time from the booking page."
    );
    if (!ok) return;
    try {
      await call("/bookings/" + encodeURIComponent(bookingId) + "/cancel", { method: "POST" });
      await load();
    } catch (err) {
      showOffline(err.message);
    }
  }

  async function doReopen(enquiryId) {
    try {
      await call("/enquiries/" + encodeURIComponent(enquiryId) + "/reopen", { method: "POST" });
      await load();
    } catch (err) {
      showOffline(err.message);
    }
  }

  /* ------------------------------- confirm ------------------------------ */

  // The resolver for the dialog that is currently open. Kept at module scope so
  // every way of dismissing it (button, backdrop, Escape) resolves the promise -
  // otherwise a backdrop click would leave the caller awaiting forever.
  var pendingConfirm = null;

  function bindConfirm() {
    $("confirmCancel").addEventListener("click", function () { closeConfirm(false); });
    $("confirmOk").addEventListener("click", function () { closeConfirm(true); });
    $("confirmBackdrop").addEventListener("click", function (e) {
      if (e.target === $("confirmBackdrop")) closeConfirm(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pendingConfirm) closeConfirm(false);
    });
  }

  function closeConfirm(value) {
    $("confirmBackdrop").classList.remove("open");
    var resolve = pendingConfirm;
    pendingConfirm = null;
    if (resolve) resolve(value);
  }

  function confirmDialog(title, body) {
    $("confirmTitle").textContent = title;
    $("confirmBody").textContent = body;
    $("confirmBackdrop").classList.add("open");
    return new Promise(function (resolve) {
      pendingConfirm = resolve;
    });
  }

  /* ------------------------------- helpers ------------------------------ */

  function noteEl(el) {
    return {
      clear: function () { el.className = "portal-note"; el.textContent = ""; },
      ok: function (msg) { el.className = "portal-note ok"; el.textContent = msg; },
      err: function (msg) { el.className = "portal-note err"; el.textContent = msg; }
    };
  }

  function showOffline(msg) {
    var el = $("portalOffline");
    el.textContent = msg;
    el.className = "portal-note err";
  }

  function hideOffline() {
    var el = $("portalOffline");
    el.className = "portal-note";
    el.textContent = "";
  }

  function $(id) { return document.getElementById(id); }

  function money(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  function fmt(n) { return "$" + money(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function trunc(s, n) {
    s = String(s == null ? "" : s);
    return s.length > n ? esc(s.slice(0, n)) + "…" : esc(s);
  }

  function badge(status) {
    var s = String(status || "unknown").toLowerCase();
    var cls = /pending|unpaid|new/.test(s) ? "pending"
      : /confirmed|in-progress/.test(s) ? "confirmed"
      : /completed|paid|resolved/.test(s) ? "completed"
      : /cancelled/.test(s) ? "cancelled"
      : "incomplete";
    return '<span class="portal-badge ' + cls + '">' + esc(s.replace(/-/g, " ")) + "</span>";
  }

  function head(cols) {
    return "<tr>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>";
  }

  function cell(html) { return "<td>" + html + "</td>"; }

  function tableWrap(headRow, bodyRows) {
    return '<div class="portal-table-wrap"><table class="portal-table"><thead>' + headRow +
      "</thead><tbody>" + bodyRows + "</tbody></table></div>";
  }

  function empty(msg) { return '<div class="portal-table-wrap"><div class="portal-empty">' + msg + "</div></div>"; }
})();
