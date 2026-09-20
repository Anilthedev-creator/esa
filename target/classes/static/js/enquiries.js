async function loadEnquiries() {

    const tbody = document.getElementById("enquiryTableBody");

    const response = await fetch("http://localhost:8080/contact/get");

    const contacts = await response.json();

    contacts.forEach(contact => {

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${contact.contactId}</td>
            <td>${contact.fullName}</td>
            <td>${contact.email}</td>
            <td>${contact.serviceName}</td>
            <td>${contact.description}</td>
            <td>
                <a href="enquiryDetails.html?id=${contact.contactId}">
                    View
                </a>
            </td>
        `;

        tbody.appendChild(row);

    });

}
document.addEventListener("DOMContentLoaded", function(){

    loadEnquiries();

});