
console.log("app.js loaded");

document.getElementById("signupForm")
    .addEventListener("submit", register);

async function register(event) {

    event.preventDefault();

    const name = document.getElementById("name").value;
    const companyName = document.getElementById("companyName").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const phone  = document.getElementById("phone").value;

    const response = await fetch(
        "http://localhost:8080/auth/register",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                fullName: name,
                companyName: companyName,
                email: email,
                password: password,
                phone : phone
            })
        }
    );

    const result = await response.text();

    document.getElementById("message").innerText = result;

    if (result === "Registration successful") {
    window.location.href = "signin.html";

}
}




