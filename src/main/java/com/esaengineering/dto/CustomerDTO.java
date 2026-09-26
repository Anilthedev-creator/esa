package com.esaengineering.dto;

import java.time.LocalDate;

import com.esaengineering.model.Booking;

/**
 * Read model for the admin customer list: a Booking flattened into the fields
 * the portal displays.
 *
 * A booking carries no phone number and no company, so those stay null until
 * they are joined from the matching User (by email). Deliberately a plain DTO
 * - no JPA annotations, it is never persisted.
 */
public class CustomerDTO {

    private String fullName;
    private String phoneNumber;
    private String email;
    private String description;
    private LocalDate bookingDate;
    private String companyName;

    public CustomerDTO() {
    }

    public CustomerDTO(Booking booking) {
        this.fullName = booking.getFullName();
        this.email = booking.getEmail();
        this.description = booking.getDescription();
        this.bookingDate = booking.getBookingDate();
    }

    public String getFullName() { return fullName; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getEmail() { return email; }
    public String getDescription() { return description; }
    public LocalDate getBookingDate() { return bookingDate; }
    public String getCompanyName() { return companyName; }

    public void setFullName(String fullName) { this.fullName = fullName; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public void setEmail(String email) { this.email = email; }
    public void setDescription(String description) { this.description = description; }
    public void setBookingDate(LocalDate bookingDate) { this.bookingDate = bookingDate; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
}
