/*
 * payment.js
 * the payment page (step 2 of the booking).
 * shows the booking summary, takes the card details,
 * and confirms the booking once the consultation fee is paid.
 */

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
      renderSummary(data.booking);

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
      document.getElementById("payBtn").textContent = "Pay $" + data.booking.fee + " consultation fee";

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
  document.getElementById("summaryRows").innerHTML =
    row("Name", b.name) +
    row("Service", b.service) +
    row("Phone", b.phone) +
    row("Booked on", when);
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
}

function pay(payment) {
  if (!payment) return;
  clearError();

  var btn = document.getElementById("payBtn");
  btn.disabled = true;
  btn.textContent = "Processing payment...";

  fetch("/api/payments/" + payment.id + "/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardNumber: document.getElementById("cardNumber").value,
      cardName: document.getElementById("cardName").value,
      expiry: document.getElementById("cardExpiry").value,
      cvc: document.getElementById("cardCvc").value
    })
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
        btn.textContent = "Pay consultation fee";
        return;
      }
      showPaid(result.data.reference);
    })
    .catch(function () {
      showError("Could not reach the server. Please try again.");
      btn.disabled = false;
      btn.textContent = "Pay consultation fee";
    });
}
