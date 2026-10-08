/*
 * payment.js
 * the payment page (step 2 of the booking).
 * shows the booking summary, takes the card details,
 * and confirms the booking once the consultation fee is paid.
 */

/** Email on the booking, so the paid card can name the address to sign in with. */
var bookedEmail = "";

document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("paymentForm");
  if (!form) return;

  // the booking id comes from the url: payment.html?booking=...
  var params = new URLSearchParams(window.location.search);
  var bookingId = params.get("booking");

  if (!bookingId) {
    showError("We could not find your booking. Please go back and fill in the booking form first.");
    form.style.display = "none";
    return;
  }

  // load the booking details
  fetch("/api/bookings/" + encodeURIComponent(bookingId))
    .then(function (res) {
      if (!res.ok) throw new Error("not found");
      return res.json();
    })
    .then(function (data) {
      bookedEmail = data.booking.email || "";
      renderSummary(data.booking);
      if (data.payment && data.payment.reference) {
        document.getElementById("payReference").textContent = data.payment.reference;
      }

      // if it is already paid just show the success card
      if (data.payment && data.payment.status === "completed") {
        showPaid(data.payment.reference);
        return;
      }
      if (data.booking.status === "cancelled") {
        showError("This booking was cancelled. Please make a new booking.");
        form.style.display = "none";
        return;
      }

      document.getElementById("feeAmount").textContent = "$" + data.booking.fee;
      document.getElementById("payBtn").textContent = "I've banked the $" + data.booking.fee + " fee";

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        pay(data.payment);
      });
    })
    .catch(function () {
      showError("We could not load your booking. Please check the link and try again.");
      form.style.display = "none";
    });
});

/** Escapes text for safe interpolation into innerHTML. */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function showError(text) {
  var box = document.getElementById("paymentError");
  box.textContent = text;
  box.style.display = "block";
}

function clearError() {
  document.getElementById("paymentError").style.display = "none";
}

function renderSummary(b) {
  var when = new Date(b.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
  var rows =
    row("Name", b.name) +
    row("Service", b.service) +
    row("Phone", b.phone) +
    row("Booked on", when);
  // show the preferred date they picked on the booking form if there is one
  if (b.bookingDate) {
    var pref = new Date(b.bookingDate + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
    rows += row("Preferred date", pref);
  }
  document.getElementById("summaryRows").innerHTML = rows;
}

function row(label, value) {
  return '<div style="display:flex;justify-content:space-between;gap:16px;">' +
    '<span style="color:var(--muted)">' + label + '</span>' +
    '<span style="font-weight:600; color:var(--navy); text-align:right">' + value + '</span></div>';
}

function showPaid(reference) {
  document.getElementById("paymentCard").style.display = "none";
  var paid = document.getElementById("paidCard");
  paid.style.display = "block";
  if (reference) {
    document.getElementById("paidRef").textContent = "Payment reference: " + reference;
  }

  // A customer who booked through the public form has no account, so the
  // portal is not an option for them - offer to create one instead. Both
  // routes let them see this booking later.
  var actions = document.getElementById("paidActions");
  if (!actions) return;
  var signedIn = typeof isLoggedIn === "function" && isLoggedIn();
  actions.innerHTML =
    '<a href="portal.html" class="btn btn-navy">' +
      (signedIn ? "View my portal" : "Track this booking") + "</a>" +
    '<a href="index.html" class="btn">Back to home</a>' +
    (signedIn
      ? ""
      : '<p style="flex-basis:100%; font-size:.8rem; color:var(--muted); margin:14px 0 0;">' +
        "You will be asked to sign in. Use the same email you booked with " +
        "(<strong>" + esc(bookedEmail || "") + "</strong>) so this booking appears.</p>");
}

// same as showPaid but for "we logged it, waiting for the bank"
function showPending(reference) {
  document.getElementById("paymentCard").style.display = "none";
  var pending = document.getElementById("pendingCard");
  pending.style.display = "block";
  if (reference) {
    document.getElementById("pendingRef").textContent = "Payment reference: " + reference;
  }
}

function pay(payment) {
  if (!payment) return;
  clearError();

  var btn = document.getElementById("payBtn");
  btn.disabled = true;
  btn.textContent = "Processing payment...";

  var ref = document.getElementById("transferReference").value.trim();
  var paidDate = document.getElementById("paidDate").value;
  if (!ref) { showError("Please put in the transfer reference from your bank receipt."); btn.disabled = false; btn.textContent = "I've banked the fee"; return; }
  if (!paidDate) { showError("Please put in the date you banked the transfer."); btn.disabled = false; btn.textContent = "I've banked the fee"; return; }

  fetch("/api/payments/" + payment.id + "/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transferReference: ref, paidDate: paidDate })
  })
    .then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, data: data };
      });
    })
    .then(function (result) {
      if (!result.ok) {
        showError(result.data.message || "The payment could not be processed. Please try again.");
        btn.disabled = false;
        btn.textContent = "I've banked the fee";
        return;
      }
      // pending = transfer logged, waiting on the office to see it in the bank
      if (result.data.status === "pending") {
        showPending(result.data.reference);
      } else {
        showPaid(result.data.reference);
      }
    })
    .catch(function () {
      showError("Could not reach the server. Please try again.");
      btn.disabled = false;
      btn.textContent = "I've banked the fee";
    });
}
