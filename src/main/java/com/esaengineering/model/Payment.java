package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;

@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long paymentId;

    private BigDecimal amount;

    private String transactionId;

    private LocalDateTime paymentDate;

    @Column
    private String customerName;

    @Column
    private String status = "completed"; // completed, incomplete

    @Column
    private Long bookingId;

    public Payment() {}

    public Long getPaymentId() { return paymentId; }
    public BigDecimal getAmount() { return amount; }
    public String getTransactionId() { return transactionId; }
    public LocalDateTime getPaymentDate() { return paymentDate; }

    public void setPaymentId(Long paymentId) { this.paymentId = paymentId; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public void setTransactionId(String transactionId) { this.transactionId = transactionId; }
    public void setPaymentDate(LocalDateTime paymentDate) { this.paymentDate = paymentDate; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getBookingId() { return bookingId; }
    public void setBookingId(Long bookingId) { this.bookingId = bookingId; }
}
