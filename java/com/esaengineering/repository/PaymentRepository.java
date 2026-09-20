package com.esaengineering.repository;

import com.esaengineering.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByTransactionId(String transactionId);

    Optional<Payment> findByReference(String reference);

    // every booking gets one payment row for the consultation fee
    Optional<Payment> findByBookingId(Long bookingId);
}
