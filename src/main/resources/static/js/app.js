console.log("app.js loaded - ESA portal");

document.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById("signupForm");
  if (form) form.addEventListener("submit", register);
});

async function register(event) {
  event.preventDefault();

  var nameEl = document.getElementById("name");
  var companyEl = document.getElementById("companyName");
  var emailEl = document.getElementById("email");
  var passEl = document.getElementById("password");
  var phoneEl = document.getElementById("phone");
  var msgEl = document.getElementById("message");

  var name = nameEl ? nameEl.value.trim() : "";
  var companyName = companyEl ? companyEl.value.trim() : "";
  var email = emailEl ? emailEl.value.trim() : "";
  var password = passEl ? passEl.value : "";
  var phone = phoneEl ? phoneEl.value.trim() : "";

  if (!name || !email || !password) {
    if (msgEl) msgEl.innerText = "All fields are required";
    return;
  }

  try {
    // Use relative API - works both with Spring Boot and Node fallback
    var response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: name,
        companyName: companyName,
        email: email,
        password: password,
        phone: phone
      })
    });

    var result = await response.json().catch(async () => {
      // Fallback if server returns plain text (legacy)
      var txt = await response.text();
      return { message: txt, success: response.ok };
    });

    if (msgEl) msgEl.innerText = result.message || (result.success ? "Registration successful" : "Registration failed");

    if (response.ok && (result.success || (result.message && result.message.toLowerCase().includes("successful")))) {
      // store session if provided
      if (result.token) localStorage.setItem("token", result.token);
      if (result.user) localStorage.setItem("user", JSON.stringify(result.user));
      window.location.href = "signin.html";
    }
  } catch (e) {
    if (msgEl) msgEl.innerText = "Could not reach server: " + e.message;
  }
}
