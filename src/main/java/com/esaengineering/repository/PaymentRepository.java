package com.esaengineering.repository;

import com.esaengineering.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByTransactionId(String transactionId);

    /** Replaces a full table scan + in-Java filter on every booking lookup. */
    Optional<Payment> findFirstByBookingId(Long bookingId);

    /** Customer portal: every payment tied to this customer's bookings. */
    List<Payment> findByBookingIdIn(Collection<Long> bookingIds);
}
