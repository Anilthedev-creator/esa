








document.getElementById("bookingForm").addEventListener("submitButton", submitBooking)

async function submitBookinge(event) {

    event.preventDefault();

    const fullName = document.getElementById("fullName").value;
    const email = document.getElementById("email").value;
   

    const bookingDate = document.getElementById("bookingDate").value;
    const abnNumber = document.getElementById("abnNumber").value;
    const serviceType = document.getElementById("serviceType").value;
    const description = document.getElementById("description").value;

    try{ 
        const response = await fetch(
            "http://localhost:8080/booking/create",
            {
              method: "POST",
              headers: {
                "Content-Type" : "application/json"
              },
              body: JSON.stringify({

                fullName: fullName,
                email: email,
               
                bookingDate: bookingDate,
                abnNumber: abnNumber,
                serviceType: serviceType,
                description: description


              })
            }

        );
        const result = await response.text();

        if (response.ok) {

          window.location.href = "Booking_Success.html";
      
      } else {
      
          alert(result);
      
      }



    }
    
    catch(error){
        console.error(error);

        alert(
            "Unable to connect to server."
        );
        

    }
    
}














