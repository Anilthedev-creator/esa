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

    /** how it was paid: "card" or "transfer" (null until its paid) */
    @Column(length = 20)
    private String method;

    /** last 4 digits when paid by card - the full number is NEVER stored */
    @Column(length = 4)
    private String cardLast4;

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getCardLast4() { return cardLast4; }
    public void setCardLast4(String cardLast4) { this.cardLast4 = cardLast4; }
}
