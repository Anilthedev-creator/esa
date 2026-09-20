document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("createAdminForm");

    form.addEventListener("submit", createAdmin);

});



async function createAdmin(event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phoneNumber").value.trim();


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

        alert("Please enter the administrator's email.");
        document.getElementById("phoneNumber").focus();
        return;

    }





    const admin = {

        fullName: fullName,
        email: email,
        phoneNumber : phoneNumber




    };


    
    try {

        const response = await fetch("auth/admin/create", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(admin)

        });

        if (response.ok) {

            alert("Administrator account created successfully. An email has been sent.");

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

