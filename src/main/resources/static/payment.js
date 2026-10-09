/*
 * payment.js
 * the payment page (step 2 of the booking).
 * shows the booking summary and takes the fee either by card (sandbox mode,
 * settles instantly) or by bank transfer (logged, confirmed when it clears).
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
        showPaid(data.payment.reference, methodText(data.payment));
        return;
      }
      if (data.booking.status === "cancelled") {
        showError("This booking was cancelled. Please make a new booking.");
        form.style.display = "none";
        return;
      }

      document.getElementById("feeAmount").textContent = "$" + data.booking.fee;
      document.getElementById("payBtn").textContent = "I've banked the $" + data.booking.fee + " fee";
      document.getElementById("cardPayBtn").textContent = "Pay $" + data.booking.fee + " by card";

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        pay(data.payment);
      });

      setupMethodTabs();
      setupCardInputs();
      document.getElementById("cardPayBtn").addEventListener("click", function () {
        payByCard(data.payment);
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

/** "Card ending 4242" / "Bank transfer" / "" - for the success + receipt bits */
function methodText(payment) {
  if (!payment) return "";
  if (payment.method === "card" && payment.cardLast4) return "Card ending " + payment.cardLast4;
  if (payment.method === "transfer") return "Bank transfer";
  return "";
}

function showPaid(reference, paidBy) {
  document.getElementById("paymentCard").style.display = "none";
  var paid = document.getElementById("paidCard");
  paid.style.display = "block";
  if (reference) {
    document.getElementById("paidRef").textContent =
      "Payment reference: " + reference + (paidBy ? "  ·  Paid by " + paidBy : "");
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


/* ------------------------- card payments (sandbox) ------------------------- */

// tabs: card pane vs transfer pane, only one visible at a time
function setupMethodTabs() {
  var tabCard = document.getElementById("tabCard");
  var tabTransfer = document.getElementById("tabTransfer");
  var cardPane = document.getElementById("cardPane");
  var transferPane = document.getElementById("transferPane");
  function select(which) {
    var card = which === "card";
    tabCard.classList.toggle("active", card);
    tabTransfer.classList.toggle("active", !card);
    tabCard.setAttribute("aria-selected", card ? "true" : "false");
    tabTransfer.setAttribute("aria-selected", card ? "false" : "true");
    cardPane.style.display = card ? "" : "none";
    transferPane.style.display = card ? "none" : "";
    clearError();
  }
  tabCard.addEventListener("click", function () { select("card"); });
  tabTransfer.addEventListener("click", function () { select("transfer"); });
}

// nice-to-type inputs: spaces in the card number, auto slash in the expiry,
// digits only in both. purely cosmetic, the server checks the real rules.
function setupCardInputs() {
  var num = document.getElementById("cardNumber");
  num.addEventListener("input", function () {
    var digits = num.value.replace(/\D/g, "").slice(0, 19);
    num.value = digits.replace(/(.{4})/g, "$1 ").trim();
  });
  var exp = document.getElementById("cardExpiry");
  exp.addEventListener("input", function () {
    var digits = exp.value.replace(/\D/g, "").slice(0, 4);
    exp.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });
  var cvv = document.getElementById("cardCvv");
  cvv.addEventListener("input", function () {
    cvv.value = cvv.value.replace(/\D/g, "").slice(0, 4);
  });
}

// the checksum every real card number passes (same as server.js)
function luhnOk(value) {
  var digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  var sum = 0;
  var alt = false;
  for (var i = digits.length - 1; i >= 0; i--) {
    var d = Number(digits[i]);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function payByCard(payment) {
  if (!payment) return;
  clearError();

  var name = document.getElementById("cardName").value.trim();
  var number = document.getElementById("cardNumber").value;
  var expiry = document.getElementById("cardExpiry").value.trim();
  var cvv = document.getElementById("cardCvv").value.trim();

  // check the obvious stuff here first so people get instant feedback,
  // the server checks it all again properly
  if (!name) { showError("Please put the name as it appears on the card."); return; }
  if (!luhnOk(number)) { showError("That card number does not look right, please check it."); return; }
  var m = expiry.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/);
  if (!m) { showError("Expiry should look like MM/YY, e.g. 08/28."); return; }
  var now = new Date();
  var endOfMonth = new Date(2000 + Number(m[2]), Number(m[1]), 0, 23, 59, 59);
  if (endOfMonth < now) { showError("That card has expired, please use a different one."); return; }
  if (!/^[0-9]{3,4}$/.test(cvv)) { showError("The CVV is the 3 or 4 digit number on the back of the card."); return; }

  var btn = document.getElementById("cardPayBtn");
  btn.disabled = true;
  btn.textContent = "Processing payment...";

  // tiny delay so it feels like a payment instead of a light switch
  setTimeout(function () {
    fetch("/api/payments/" + payment.id + "/card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardName: name, cardNumber: number, cardExpiry: expiry, cardCvv: cvv })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) {
          showError(result.data.message || "The payment could not be processed. Please try again.");
          btn.disabled = false;
          btn.textContent = "Pay by card";
          return;
        }
        showPaid(result.data.reference, result.data.cardLast4 ? "Card ending " + result.data.cardLast4 : "");
      })
      .catch(function () {
        showError("Could not reach the server. Please try again.");
        btn.disabled = false;
        btn.textContent = "Pay by card";
      });
  }, 700);
}
