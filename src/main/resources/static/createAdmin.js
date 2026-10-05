/*
 * Creating an administrator is an admin-only action, so this page must send a
 * valid token and refuse to run without one. Previously it POSTed with no
 * Authorization header at all, which handed out admin rights to anyone.
 */
document.addEventListener("DOMContentLoaded", () => {
  if (!localStorage.getItem("token")) {
    window.location.replace("signin.html?next=accountAdmin.html");
    return;
  }
  const form = document.getElementById("createAdminForm");
  if (form) form.addEventListener("submit", createAdmin);
});

function authHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("signin.html?next=accountAdmin.html");
    throw new Error("Not signed in");
  }
  return { "Content-Type": "application/json", "Authorization": "Bearer " + token };
}

async function createAdmin(event) {
  event.preventDefault();

  const fullNameEl = document.getElementById("fullName");
  const emailEl = document.getElementById("email");
  const phoneEl = document.getElementById("phoneNumber");
  const passwordEl = document.getElementById("password") || document.getElementById("adminPassword");

  const fullName = fullNameEl ? fullNameEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const phoneNumber = phoneEl ? phoneEl.value.trim() : "";
  const password = passwordEl ? passwordEl.value.trim() : "";

  if (fullName === "") { alert("Please enter the administrator's full name."); if (fullNameEl) fullNameEl.focus(); return; }
  if (email === "") { alert("Please enter the administrator's email."); if (emailEl) emailEl.focus(); return; }
  if (phoneNumber === "") { alert("Please enter the administrator's phone number."); if (phoneEl) phoneEl.focus(); return; }

  try {
    const response = await fetch("/api/auth/create/admin", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ fullName, email, password, phoneNumber })
    });

    let data = null;
    const text = await response.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = { message: text }; } }

    if (response.ok) {
      alert((data && data.message) || "Administrator account created.");
      const form = document.getElementById("createAdminForm");
      if (form) form.reset();
    } else {
      alert((data && data.message) || "Could not create the administrator.");
    }
  } catch (error) {
    console.error(error);
    alert("Unable to connect to the server. Is it running on port 8080?");
  }
}
