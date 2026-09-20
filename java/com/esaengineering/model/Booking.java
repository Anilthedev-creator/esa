package com.esaengineering.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/*
This is a bookings table for database.
PostgreSql will receive table name called booking
*/
@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long bookingId;

    @Column(nullable = false)
    @NotBlank(message = "Full name is required")
    private String fullName;

    @Column(nullable = false)
    private LocalDate bookingDate;

    // ABN is optional, most booking forms do not ask for it
    @Column(nullable = true)
    private String abnNumber;

    @Column(nullable = false)
    @NotBlank(message = "Service name is required")
    private String serviceName;

    @Column(nullable = false)
    @NotBlank(message = "Email is required")
    @Email(message = "Email format is invalid")
    private String email;

    // phone number of the person who made the booking
    @Column(nullable = true)
    private String phone;

    @Column(length = 1000)
    private String description;

    // pending, confirmed or cancelled
    // nullable so old bookings made before this column existed still load
    @Column(nullable = true)
    private String status = "pending";

    // consultation fee for this booking in AUD
    @Column(nullable = true)
    private BigDecimal fee;

    // when the booking row was created
    @Column(nullable = true)
    private LocalDateTime createdAt;

    public Booking() {
    }

    public Long getBookingId() {
        return bookingId;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public LocalDate getBookingDate() {
        return bookingDate;
    }

    public void setBookingDate(LocalDate bookingDate) {
        this.bookingDate = bookingDate;
    }

    public String getAbnNumber() {
        return abnNumber;
    }

    public void setAbnNumber(String abnNumber) {
        this.abnNumber = abnNumber;
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

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getFee() {
        return fee;
    }

    public void setFee(BigDecimal fee) {
        this.fee = fee;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
