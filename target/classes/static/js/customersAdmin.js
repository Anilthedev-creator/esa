

document.addEventListener("DOMContentLoaded", loadCustomers);

async function loadCustomers() {

    try {

        const response = await fetch("http://localhost:8080/admin/customers");

        const customers = await response.json();

        const table = document.getElementById("customerTable");

        customers.forEach(customer => {

            const row = document.createElement("tr");

            row.innerHTML = `
               
                <td>${customer.fullName}</td>
                <td>${customer.email}</td>
                <td>${customer.phoneNumber}</td>
                <td>${customer.bookingDate}</td>
                <td>${customer.companyName}</td>
                <td>${customer.description}</td>

            `;

            table.appendChild(row);

        });

    } catch(error) {

        console.log(error);

    }

}