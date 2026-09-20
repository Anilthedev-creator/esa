/*
 * auth.js
 * handles sign in, sign up, forgot password and the session.
 * the api runs on the same server as the site so we can use
 * relative paths like /api/auth/signin.
 */

var API_URL = "/api/auth";
// optional override, eg if the site and api are on different servers
if (typeof window !== "undefined" && window.ESA_API_URL) {
  API_URL = window.ESA_API_URL.replace(/\/$/, "");
}


/* ================= SIGN UP ================= */

async function signup(formData) {
  if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.companyName) {
    throw new Error("All fields are required");
  }

  try {
    var response = await fetch(API_URL + "/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData)
    });
    var data = await response.json();

    if (!response.ok) {
      // the backend sends back { message } or { errors: [{message}] }
      var msg = "Signup failed";
      if (data && data.message) msg = data.message;
      if (data && data.errors && data.errors.length > 0) msg = data.errors[0].message;
      throw new Error(msg);
    }

    // store the session so we know who is logged in
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  } catch (error) {
    if (error.name === "TypeError") {
      // fetch itself failed, most likely the server is not running
      throw new Error("Could not reach the server, is it running?");
    }
    throw error;
  }
}


/* ================= SIGN IN ================= */

async function signin(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  try {
    var response = await fetch(API_URL + "/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    });
    var data = await response.json();

    if (!response.ok) {
      var msg = "Sign in failed";
      if (data && data.message) msg = data.message;
      if (data && data.errors && data.errors.length > 0) msg = data.errors[0].message;
      throw new Error(msg);
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    console.log("signed in as " + data.user.name);
    return data;
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Could not reach the server, is it running?");
    }
    throw error;
  }
}


/* ================= FORGOT PASSWORD ================= */

async function requestPasswordReset(email) {
  try {
    var response = await fetch(API_URL + "/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });
    var data = await response.json();

    if (!response.ok) {
      throw new Error((data && data.message) || "Failed to send reset link");
    }
    return data;
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Could not reach the server, is it running?");
    }
    throw error;
  }
}


/* ================= RESET PASSWORD ================= */

async function resetPassword(token, password) {
  if (!token || !password) {
    throw new Error("A reset token and new password are required");
  }

  try {
    var response = await fetch(API_URL + "/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token, password: password })
    });
    var data = await response.json();

    if (!response.ok) {
      throw new Error((data && data.message) || "Password reset failed");
    }
    return data;
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Could not reach the server, is it running?");
    }
    throw error;
  }
}


/* ================= LOGOUT ================= */

async function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

// logs out and takes the user back to the home page
async function signOut() {
  await logout();
  window.location.href = "index.html";
}


/* ================= SESSION HELPERS ================= */

function getToken() {
  return localStorage.getItem("token");
}

function getUser() {
  try {
    var user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error("Error parsing user data:", e);
    return null;
  }
}

function isLoggedIn() {
  return !!getToken();
}

// asks the server for the current user (checks the token is still valid)
async function getCurrentUser() {
  var token = getToken();
  if (!token) return null;

  try {
    var response = await fetch(API_URL + "/me", {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!response.ok) {
      if (response.status === 401) {
        // the token is no longer valid, log out
        await logout();
      }
      return null;
    }
    var data = await response.json();
    return data.user || data;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// use at the top of a page that needs the user to be signed in
function redirectIfNotLoggedIn(redirectTo) {
  if (!redirectTo) redirectTo = "signin.html";
  if (!isLoggedIn()) {
    window.location.href = redirectTo;
  }
}
