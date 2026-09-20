package com.esaengineering.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

// Enquiry messages sent from the contact page.
// They are stored in the "contact" table.
@Entity
@Table(name = "contact")
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long contactId;

    @Column(nullable = false, length = 100)
    @NotBlank(message = "Full name is required")
    private String fullName;

    @Column(nullable = false, length = 100)
    @NotBlank(message = "Email is required")
    @Email(message = "Email format is invalid")
    private String email;

    @Column(nullable = false)
    private String serviceName;

    @Column(nullable = false, length = 2000)
    private String description;

    // new, in-progress or resolved (used by the admin enquiries page)
    // nullable so old enquiries made before this column existed still load
    @Column(nullable = true)
    private String status = "new";

    // reply written by an admin, can be empty
    @Column(length = 2000)
    private String reply;

    // when the enquiry was sent
    @Column(nullable = true)
    private LocalDateTime createdAt;

    public Contact(Long contactId, String fullName, String email, String serviceName, String description) {
        this.contactId = contactId;
        this.fullName = fullName;
        this.email = email;
        this.serviceName = serviceName;
        this.description = description;
    }

    public Contact() {
    }

    public Long getContactId() {
        return contactId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getEmail() {
        return email;
    }

    public String getServiceName() {
        return serviceName;
    }

    public String getDescription() {
        return description;
    }

    public void setContactId(Long contactId) {
        this.contactId = contactId;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getReply() {
        return reply;
    }

    public void setReply(String reply) {
        this.reply = reply;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
