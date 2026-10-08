/*
 * auth.js - the session layer for the public site and the admin portal.
 * Same-origin Spring Boot API:
 *   POST /api/auth/signup     POST /api/auth/signin      POST /api/auth/logout
 *   GET  /api/auth/me         POST /api/auth/create/admin
 * The server answers { message, token, user }; admin-data.js replays the
 * token as "Authorization: Bearer <token>".
 */

var API_URL = "/api/auth";
if (typeof window !== "undefined" && window.ESA_API_URL) {
  API_URL = window.ESA_API_URL.replace(/\/$/, "") + "/api/auth";
}

async function api(path, options) {
  options = options || {};
  options.headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});

  var response;
  try {
    response = await fetch(API_URL + path, options);
  } catch (error) {
    throw new Error("Could not reach the server, is it running?");
  }

  var text = await response.text();
  var data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (error) { data = { message: text }; }
  }

  if (!response.ok) {
    var message = "Request failed (" + response.status + ")";
    if (data && data.message) message = data.message;
    var error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data || {};
}

/* --------------------------------- sign up -------------------------------- */

async function signup(formData) {
  if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.companyName) {
    throw new Error("All fields are required");
  }
  var data = await api("/signup", {
    method: "POST",
    body: JSON.stringify({
      firstName: formData.firstName,
      lastName: formData.lastName,
      companyName: formData.companyName,
      email: formData.email,
      password: formData.password,
      phone: formData.phone || ""
    })
  });
  storeSession(data);
  return data;
}

/* --------------------------------- sign in -------------------------------- */

async function signin(email, password) {
  if (!email || !password) throw new Error("Email and password are required");
  var data = await api("/signin", {
    method: "POST",
    body: JSON.stringify({ email: email, password: password })
  });
  storeSession(data);
  return data;
}

/* ----------------------------- passwords / misc ---------------------------- */

async function requestPasswordReset(email) {
  if (!email) throw new Error("Email is required");
  // server always answers ok (so nobody can probe for accounts), the mail
  // goes to the inbox or to data/outbox while SMTP is not hooked up
  return api("/forgot-password", { method: "POST", body: JSON.stringify({ email: email }) });
}

async function resetPassword(token, password) {
  if (!token) throw new Error("That reset link is missing its token, please request a new one");
  if (!password) throw new Error("Password is required");
  return api("/reset-password", { method: "POST", body: JSON.stringify({ token: token, password: password }) });
}

async function createAdminAccount(data) {
  return api("/create/admin", {
    method: "POST",
    body: JSON.stringify({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      phoneNumber: data.phoneNumber || ""
    })
  });
}

/* --------------------------------- session -------------------------------- */

function storeSession(data) {
  if (!data) return;
  if (data.token) localStorage.setItem("token", data.token);
  if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
}

function authHeaders() {
  var token = getToken();
  return token ? { Authorization: "Bearer " + token } : {};
}

async function logout() {
  try { await api("/logout", { method: "POST", headers: authHeaders() }); } catch (e) { /* local clear is what matters */ }
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

async function signOut() {
  await logout();
  window.location.href = "index.html";
}

function getToken() { return localStorage.getItem("token"); }

function getUser() {
  try {
    var user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error("Error parsing user data:", e);
    return null;
  }
}

function isLoggedIn() { return !!getToken(); }

function isAdmin() {
  var user = getUser();
  return !!user && String(user.role).toLowerCase() === "admin";
}

/** Revalidates the stored token; clears an expired session. */
async function getCurrentUser() {
  if (!getToken()) return null;
  try {
    var data = await api("/me", { headers: authHeaders() });
    if (data && data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch (error) {
    if (error.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return null;
  }
}

function redirectIfNotLoggedIn(redirectTo) {
  if (!redirectTo) redirectTo = "signin.html";
  if (!isLoggedIn()) window.location.href = redirectTo;
}

/* ==========================================================================
   ui pass (oct 2026)
   ========================================================================== */

// toast notifications - small helper so we can stop using alert() everywhere.
// every page loads auth.js so this is available site-wide.
window.showToast = function (msg, kind) {
  var box = document.getElementById('toastBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  var t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : '');
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(function () {
    t.classList.add('hide');
    setTimeout(function () { t.remove(); }, 350);
  }, 3500);
};

// highlight the header nav link for the page we are on. dropdown parents get
// highlighted too when one of their children is the current page.
document.addEventListener('DOMContentLoaded', function () {
  var here = window.location.pathname.split('/').pop();
  if (!here || here === '') here = 'index.html';
  document.querySelectorAll('.main-nav-box .nav-link').forEach(function (link) {
    var href = (link.getAttribute('href') || '').split('?')[0];
    if (!href) return;
    // "index.html" and "/" are the same page
    var target = href.split('/').pop();
    if (target === here || (here === 'index.html' && href === 'index.html')) {
      link.classList.add('current');
      // also light up the dropdown trigger this link lives under
      var dd = link.closest('.dropdown');
      if (dd) {
        var trigger = dd.querySelector('.dropdown-trigger');
        if (trigger) trigger.classList.add('current');
      }
    }
  });
  // dropdown children dont all carry .nav-link, so check them separately and
  // highlight their parent trigger (e.g. commissioning.html -> Services)
  document.querySelectorAll('.main-nav-box .dropdown-content a').forEach(function (child) {
    var href = (child.getAttribute('href') || '').split('?')[0].split('/').pop();
    if (href && href === here) {
      var dd = child.closest('.dropdown');
      if (dd) {
        var trigger = dd.querySelector('.dropdown-trigger');
        if (trigger) trigger.classList.add('current');
      }
    }
  });
});
