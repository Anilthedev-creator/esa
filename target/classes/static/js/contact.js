document.addEventListener("DOMContentLoaded", function(){
    const form = document.querySelector("form");
    form.addEventListener("submit", submitContact);

});
async function submitContact(event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
    const serviceName = document.getElementById("serviceName").value;
    const description = document.getElementById("description").value;

    if (fullName === ""){
        alert("Please enter your full name")
        document.getElementById("fullName").focus();
        return;
    }
    if (email == ""){
        alert("Please enter your email")
        document.getElementById("email").focus();
        return;
    }
    if(description === ""){
        alert("Please enter a description. ");
        document.getElementById("description").focus();
        return;
    }
    const contact = {
        fullName:fullName,
        email:email,
        serviceName: serviceName,
        description: description
    };
    try{
        const response = await fetch("http://localhost:8080/contact/create", 
            {
                /**
                 * 
                 */
                method: "POST",
                headers:{
                    "Content-Type" : "application/json"

                }, body: JSON.stringify(contact)
                    
                
            }

        );
        if (response.ok){
            alert("Message sent sucessfully!");
            form.reset();
        } else{
            const error = await response.text();
            alert(error);
        }
    } catch(error){
        console.error(error);
        alert("Unable to connect server")
    }
}


