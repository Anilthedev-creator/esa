package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

// Payments table. One payment row is made for every booking
// so the customer can pay the consultation fee online.
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long paymentId;

    private BigDecimal amount;

    @Column(unique = true)
    private String transactionId;

    // short reference shown to the customer, eg ESA-2026-0001
    @Column(unique = true)
    private String reference;

    // the booking this payment belongs to
    private Long bookingId;

    @Enumerated(EnumType.STRING)
    private PaymentStatus status = PaymentStatus.PENDING;

    private LocalDateTime paymentDate;

    public Payment() {
    }

    public Long getPaymentId() {
        return paymentId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public String getReference() {
        return reference;
    }

    public Long getBookingId() {
        return bookingId;
    }

    public PaymentStatus getStatus() {
        return status;
    }

    public LocalDateTime getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentId(Long paymentId) {
        this.paymentId = paymentId;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public void setReference(String reference) {
        this.reference = reference;
    }

    public void setBookingId(Long bookingId) {
        this.bookingId = bookingId;
    }

    public void setStatus(PaymentStatus status) {
        this.status = status;
    }

    public void setPaymentDate(LocalDateTime paymentDate) {
        this.paymentDate = paymentDate;
    }
}
