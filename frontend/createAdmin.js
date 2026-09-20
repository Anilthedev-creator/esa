document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("createAdminForm");

    if (form) {
        form.addEventListener("submit", createAdmin);
    }

});



async function createAdmin(event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phoneNumber = document.getElementById("phoneNumber").value.trim();
    const password = document.getElementById("password").value;


    if (fullName === "") {

        alert("Please enter the administrator's full name.");
        document.getElementById("fullName").focus();
        return;

    }

    if (email === "") {

        alert("Please enter the administrator's email.");
        document.getElementById("email").focus();
        return;

    }

    if (phoneNumber === "") {

        alert("Please enter the administrator's phone number.");
        document.getElementById("phoneNumber").focus();
        return;

    }

    if (password === "" || password.length < 8) {

        alert("Please enter a password with at least 8 characters.");
        document.getElementById("password").focus();
        return;

    }



    const admin = {

        fullName: fullName,
        email: email,
        phoneNumber: phoneNumber,
        password: password

    };



    try {

        const response = await fetch("/auth/create/admin", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(admin)

        });

        if (response.ok) {

            alert("Administrator account created successfully.");

            document.getElementById("createAdminForm").reset();

        }
        else {

            const error = await response.text();

            alert(error);

        }

    }
    catch (error) {

        console.error(error);

        alert("Unable to connect to the server.");

    }

}
