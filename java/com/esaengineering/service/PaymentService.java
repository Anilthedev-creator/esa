package com.esaengineering.service;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Payment;
import com.esaengineering.model.PaymentStatus;
import com.esaengineering.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    // Create payment, fills in the date and ids when they are missing
    public Payment createPayment(Payment payment) {

        if (payment.getAmount() == null) {
            throw new IllegalArgumentException("Payment amount is required");
        }
        if (payment.getStatus() == null) {
            payment.setStatus(PaymentStatus.PENDING);
        }
        if (payment.getPaymentDate() == null) {
            payment.setPaymentDate(LocalDateTime.now());
        }
        if (payment.getTransactionId() == null || payment.getTransactionId().isBlank()) {
            payment.setTransactionId(UUID.randomUUID().toString());
        }

        Payment saved = paymentRepository.save(payment);

        // reference needs the id, so it is made after the first save
        if (saved.getReference() == null || saved.getReference().isBlank()) {
            saved.setReference("ESA-" + LocalDate.now().getYear() + "-" + saved.getPaymentId());
            saved = paymentRepository.save(saved);
        }

        return saved;
    }

    // Makes the pending payment row that goes with a new booking
    public Payment createPaymentForBooking(Booking booking, BigDecimal fee) {
        // do not make a second payment row for the same booking
        Optional<Payment> existing = paymentRepository.findByBookingId(booking.getBookingId());
        if (existing.isPresent()) {
            return existing.get();
        }

        Payment payment = new Payment();
        payment.setAmount(fee);
        payment.setBookingId(booking.getBookingId());
        payment.setStatus(PaymentStatus.PENDING);

        return createPayment(payment);
    }

    // Marks a payment as paid after the card is accepted
    public Payment confirmPayment(Long paymentId) {
        Optional<Payment> found = paymentRepository.findById(paymentId);
        if (found.isEmpty()) {
            return null;
        }
        Payment payment = found.get();
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaymentDate(LocalDateTime.now());
        return paymentRepository.save(payment);
    }

    // Get payment by ID
    public Optional<Payment> getPaymentById(Long paymentId) {
        return paymentRepository.findById(paymentId);
    }

    // Get all payments
    public List<Payment> getAllPayments() {
        return paymentRepository.findAll();
    }

    // Find payment by transaction ID
    public Optional<Payment> getPaymentByTransactionId(String transactionId) {
        return paymentRepository.findByTransactionId(transactionId);
    }

    public Optional<Payment> getPaymentByBookingId(Long bookingId) {
        return paymentRepository.findByBookingId(bookingId);
    }

    // Delete payment, returns false when there is nothing to delete
    public boolean deletePayment(Long paymentId) {
        if (!paymentRepository.existsById(paymentId)) {
            return false;
        }
        paymentRepository.deleteById(paymentId);
        return true;
    }
}
