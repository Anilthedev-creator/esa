package com.esaengineering.model;





import javax.annotation.processing.Generated;

import jakarta.persistence.*;





@Entity
@Table( name = "contact")
public class Contact{

    @Id
    @GeneratedValue( strategy = GenerationType.IDENTITY)
    private Long contactId;


    @Column(nullable = false , length = 100)
    private String fullName;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false)
    private String serviceName;


    @Column(nullable = false)
    private String description;


    public Contact(long contactId, String fullName, String email, String serviceName, String description) {
        this.contactId = contactId;
        this.fullName = fullName;
        this.email = email;
        this.serviceName = serviceName;
        this.description = description;
    }


    public Contact() {
    }


    public long getContactId() {
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


    public void setContactId(long contactId) {
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
    


    



}