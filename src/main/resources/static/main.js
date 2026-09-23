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

function updateHeaderButtons() {
  if (typeof isLoggedIn !== "function") return; // auth.js not loaded on this page
  if (!isLoggedIn()) return;

  var actions = document.querySelector(".header-actions");
  if (!actions) return;

  var user = (typeof getUser === "function") ? getUser() : null;
  var firstName = "Dashboard";
  if (user && user.firstName) {
    firstName = user.firstName;
  }

  actions.innerHTML =
    '<a href="dashboard.html" class="btn-pill btn-pill-red">' + firstName + "'s Dashboard</a>" +
    '<a href="#" id="headerSignOut" class="btn-pill btn-pill-cyan">Sign out</a>';

  var signOutLink = document.getElementById("headerSignOut");
  signOutLink.addEventListener("click", function (e) {
    e.preventDefault();
    if (typeof signOut === "function") signOut();
  });
}
