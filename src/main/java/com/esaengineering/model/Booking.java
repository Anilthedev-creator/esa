package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long bookingId;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private LocalDate bookingDate;

    @Column
    private String abnNumber;

    @Column(nullable = false)
    private String serviceName;

    @Column(nullable = false)
    private String email;

    @Column
    private String phone;

    @Column(length = 1000)
    private String description;

    @Column
    private String status = "pending"; // pending, confirmed, completed, cancelled

    // time slot they asked for on the booking form, e.g. "10:00"
    private String preferredSlot;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (bookingDate == null) bookingDate = LocalDate.now();
        if (status == null) status = "pending";
    }

    public Booking() {}

    public long getBookingID() { return bookingId; }
    public void setBookingID(long bookingId) { this.bookingId = bookingId; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public LocalDate getBookingDate() { return bookingDate; }
    public void setBookingDate(LocalDate bookingDate) { this.bookingDate = bookingDate; }

    public String getAbnNumber() { return abnNumber; }
    public void setAbnNumber(String abnNumber) { this.abnNumber = abnNumber; }

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getPreferredSlot() { return preferredSlot; }
    public void setPreferredSlot(String preferredSlot) { this.preferredSlot = preferredSlot; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
