/*
 * main.js
 * shared code for all the public pages.
 * handles the mobile menu, the dropdown menus in the nav,
 * the contact/booking forms and the buttons in the header.
 */

document.addEventListener("DOMContentLoaded", function () {
  setupMobileMenu();
  setupDropdowns();
  setupForms();
  updateHeaderButtons();
  preselectBookingService();
  showBookingAuthNotice();
});


/* ================= MOBILE MENU ================= */
// the hamburger button shows/hides the nav on small screens

function setupMobileMenu() {
  var toggle = document.getElementById("mobileMenuToggle");
  var menu = document.getElementById("mobileMenu");

  if (!toggle || !menu) return;

  function openMenu() {
    toggle.classList.add("active");
    menu.classList.add("active");
    document.documentElement.classList.add("no-scroll");
    document.body.classList.add("no-scroll");
  }

  function closeMenu() {
    toggle.classList.remove("active");
    menu.classList.remove("active");
    document.documentElement.classList.remove("no-scroll");
    document.body.classList.remove("no-scroll");
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    if (menu.classList.contains("active")) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // close the menu when someone clicks a link inside it
  var links = menu.querySelectorAll("a");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", closeMenu);
  }

  // close when clicking anywhere else on the page
  document.addEventListener("click", function (e) {
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    closeMenu();
  });

  // close on the escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // if the window gets bigger again (e.g. rotate phone) just close it
  window.addEventListener("resize", function () {
    if (window.innerWidth > 640) closeMenu();
  });
}


/* ================= DROPDOWNS ================= */
// "Projects" and "Services" in the nav have a little dropdown menu.
// the css only shows them on hover which doesn't work on phones,
// so here we also toggle them when clicked.

function closeDropdown(dd) {
  dd.classList.remove("open");
  var content = dd.querySelector(".dropdown-content");
  var trigger = dd.querySelector(".dropdown-trigger");
  if (content) content.style.display = "";
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

function closeAllDropdowns() {
  var openOnes = document.querySelectorAll(".dropdown.open");
  for (var i = 0; i < openOnes.length; i++) {
    closeDropdown(openOnes[i]);
  }
}

function setupDropdowns() {
  var dropdowns = document.querySelectorAll(".dropdown");
  for (var i = 0; i < dropdowns.length; i++) {
    setupOneDropdown(dropdowns[i]);
  }

  // clicking outside closes any open dropdown
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".dropdown")) {
      closeAllDropdowns();
    }
  });
}

function setupOneDropdown(dd) {
  var trigger = dd.querySelector(".dropdown-trigger");
  var content = dd.querySelector(".dropdown-content");
  if (!trigger || !content) return;

  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");

  // check if the trigger is a real link (Projects is, Services isn't)
  var href = trigger.getAttribute("href");
  var isRealLink = trigger.tagName === "A" && href && href !== "#" && href.indexOf("javascript") !== 0;

  // if it's an anchor with an empty href the click would reload the page, fix that
  if (trigger.tagName === "A" && (!href || href === "" || href === "#")) {
    trigger.setAttribute("href", "javascript:void(0)");
  }

  trigger.addEventListener("click", function (e) {
    // the Projects link should just go to the projects page
    if (isRealLink) {
      closeAllDropdowns();
      return;
    }

    e.preventDefault();

    // close any other open dropdowns first (but not this one)
    var others = document.querySelectorAll(".dropdown.open");
    for (var i = 0; i < others.length; i++) {
      if (others[i] !== dd) closeDropdown(others[i]);
    }

    if (dd.classList.contains("open")) {
      closeDropdown(dd);
    } else {
      dd.classList.add("open");
      content.style.display = "block";
      trigger.setAttribute("aria-expanded", "true");
    }
  });

  // basic keyboard support (enter / space opens it like a click)
  trigger.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger.click();
    }
  });
}


/* ================= FORMS ================= */
// the contact and booking forms have data-local-submit on them.
// if they also have a data-api attribute we send the data to the
// backend, otherwise we just show a message (e.g. backend offline)

function showFormNote(form, text, isError) {
  var note = form.querySelector(".form-submitted-note");
  if (!note) {
    note = document.createElement("p");
    note.className = "form-submitted-note";
    form.appendChild(note);
  }
  note.textContent = text;
  note.style.marginTop = "15px";
  note.style.fontWeight = "600";
  note.style.color = isError ? "#e63946" : "#06a77d";
}

function onFormSubmit(e) {
  e.preventDefault();
  var form = e.target;
  // Require customers to sign in before booking
  if (form.getAttribute("data-api") === "/api/bookings") {
  if (typeof isLoggedIn !== "function" || !isLoggedIn()) {
    window.location.href =
      "signin.html?next=" + encodeURIComponent("booking.html" + window.location.search);
    return;
  }
} 

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  var btn = form.querySelector("button[type=submit]");
  var originalText = "";
  if (btn) {
    originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending...";
  }

  // build a plain object from the form fields
  var data = {};
  var fields = form.querySelectorAll("input, select, textarea");
  for (var i = 0; i < fields.length; i++) {
    if (fields[i].name) {
      data[fields[i].name] = fields[i].value;
    }
  }

  var api = form.getAttribute("data-api");

  if (!api) {
    // no backend connected, just show a local message
    showFormNote(form, "Thanks - we've received your request and will be in touch shortly.", false);
    form.reset();
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
    return;
  }

  fetch(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(function (res) {
      return res.json();
    })
    .then(function (result) {
      console.log("form submitted ok");

      // A booking is step 1 of 2: hand the customer straight to the payment
      // page for the consultation fee. Without this the booking was created
      // but payment.html was never reachable, so no fee was ever collected.
      if (api === "/api/bookings" && result && result.booking && result.booking.id) {
        showFormNote(form, "Booking received - taking you to payment...", false);
        window.location.href =
          "payment.html?booking=" + encodeURIComponent(result.booking.id);
        return;
      }

      showFormNote(form, result.message || "Thanks - we've received your request and will be in touch shortly.", false);
      form.reset();
    })
    .catch(function () {
      // something went wrong (server not running etc)
      showFormNote(form, "Sorry, we couldn't send your request right now. Please try again later or call us on 0402 464 823.", true);
    })
    .finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
}

function setupForms() {
  var forms = document.querySelectorAll("form[data-local-submit]");
  for (var i = 0; i < forms.length; i++) {
    forms[i].addEventListener("submit", onFormSubmit);
  }
}


/* ================= HEADER BUTTONS ================= */
// if the user is logged in (auth.js needs to be loaded for this
// to work) we swap the "Sign in / Sign up" buttons for
// "Dashboard / Sign out"
//
// The link target is role-aware: an administrator goes to dashboard.html
// (the admin console), a customer goes to portal.html (their own bookings
// and payments). Sending a customer to dashboard.html previously left them
// staring at an admin page they had no access to.

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function userInitials(user) {
  if (!user) return "ESA";
  var initials =
    String(user.firstName || "").charAt(0) + String(user.lastName || "").charAt(0);
  initials = initials.toUpperCase();
  return initials || String(user.firstName || "E").charAt(0).toUpperCase() || "ESA";
}

function updateHeaderButtons() {
  if (typeof isLoggedIn !== "function") return; // auth.js not loaded on this page

  var actions = document.querySelector(".header-actions");
  if (!actions) return;

  // Signed-out visitors see a single "Sign in" pill. Signing up is offered
  // from the sign-in page itself ("Don't have an account? Sign up"), which
  // keeps the header calm on every page of the public site.
  if (!isLoggedIn()) return;

  // Signed-in visitors get an avatar chip (initials) that opens a small
  // account menu: everything the customer manages lives behind it.
  var user = (typeof getUser === "function") ? getUser() : null;
  var admin = (typeof isAdmin === "function") && isAdmin();
  var first = (user && user.firstName) ? user.firstName : "My account";

  var links = "";
  if (admin) {
    links +=
      '<a role="menuitem" href="dashboard.html">Admin dashboard</a>' +
      '<a role="menuitem" href="content.html">Content manager</a>' +
      '<a role="menuitem" href="settings.html">Site settings</a>';
  } else {
    links +=
      '<a role="menuitem" href="portal.html">My portal</a>' +
      '<a role="menuitem" href="portal.html#bookings">My bookings</a>' +
      '<a role="menuitem" href="portal.html#payments">Payments</a>' +
      '<a role="menuitem" href="portal.html#profile">Account settings</a>' +
      '<a role="menuitem" href="booking.html">New booking</a>';
  }

  actions.innerHTML =
    '<div class="account-menu" id="accountMenu">' +
      '<button type="button" class="account-chip" id="accountChip" ' +
        'aria-haspopup="true" aria-expanded="false" title="Account menu">' +
        '<span class="account-avatar" aria-hidden="true">' + userInitials(user) + "</span>" +
        '<span class="account-name">' + escapeHtml(first) + "</span>" +
        '<span class="arrow" aria-hidden="true">&#8250;</span>' +
      "</button>" +
      '<div class="account-dropdown" id="accountDropdown" role="menu" aria-label="Account">' +
        (user && user.email
          ? '<p class="account-email">' + escapeHtml(user.email) + "</p>"
          : "") +
        links +
        '<button type="button" role="menuitem" class="account-signout" id="headerSignOut">Sign out</button>' +
      "</div>" +
    "</div>";

  var menu = document.getElementById("accountMenu");
  var chip = document.getElementById("accountChip");

  function closeMenu() {
    menu.classList.remove("open");
    chip.setAttribute("aria-expanded", "false");
  }

  chip.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = menu.classList.toggle("open");
    chip.setAttribute("aria-expanded", open ? "true" : "false");
  });

  document.addEventListener("click", function (e) {
    if (menu.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  document.getElementById("headerSignOut").addEventListener("click", function (e) {
    e.preventDefault();
    if (typeof signOut === "function") signOut();
  });
}

/* ============== BOOKING: PRESELECT THE SERVICE ============== */
// Booking links from the service pages carry ?service=<name> so the form
// opens on the service the customer was actually reading about, instead of
// always defaulting to Plant Commissioning.

function preselectBookingService() {
  var select = document.getElementById("service");
  if (!select || typeof URLSearchParams !== "function") return;

  var wanted = new URLSearchParams(window.location.search).get("service");
  if (!wanted) return;

  var norm = wanted.toLowerCase().replace(/\s+/g, " ").trim();
  for (var i = 0; i < select.options.length; i++) {
    var label = select.options[i].text.toLowerCase().replace(/\s+/g, " ").trim();
    if (label === norm) {
      select.selectedIndex = i;
      return;
    }
  }
}

function showBookingAuthNotice() {
    var notice = document.getElementById("bookingAuthNotice");

    if (!notice) return;

    var loggedIn =
        typeof isLoggedIn === "function" && isLoggedIn();

    // keep ?service=... so the customer lands back on the same booking
    var signinLink = notice.querySelector('a[href^="signin.html"]');
    if (signinLink) {
      signinLink.href =
        "signin.html?next=" +
        encodeURIComponent("booking.html" + window.location.search);
    }

    notice.hidden = loggedIn;
    document.body.classList.toggle(
        "booking-auth-open",
        !loggedIn
    );
}