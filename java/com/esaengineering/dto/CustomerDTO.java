package com.esaengineering.dto;

import java.time.LocalDate;

import com.esaengineering.model.Booking;

/*
 * CustomerDTO
 * This class is made for sending booking data to admin users.
 * The Booking class does not have every field the admin page
 * wants to show, so this DTO collects them in one place.
 */
public class CustomerDTO {

    private Long bookingId;
    private String fullName;
    private String phoneNumber;
    private String email;
    private String serviceName;
    private String description;
    private LocalDate bookingDate;
    private String status;

    public CustomerDTO() {
    }

    public CustomerDTO(Booking booking) {
        this.bookingId = booking.getBookingId();
        this.fullName = booking.getFullName();
        this.phoneNumber = booking.getPhone();
        this.email = booking.getEmail();
        this.serviceName = booking.getServiceName();
        this.description = booking.getDescription();
        this.bookingDate = booking.getBookingDate();
        this.status = booking.getStatus();
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDate getBookingDate() {
        return bookingDate;
    }

    public void setBookingDate(LocalDate bookingDate) {
        this.bookingDate = bookingDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
