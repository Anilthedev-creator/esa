package com.esaengineering.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.esaengineering.model.Booking;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findByServiceName(String serviceName);

    List<Booking> findByEmail(String email);

    Optional<Booking> findByBookingId(Long bookingId);

    boolean existsByEmail(String email);

    long countByServiceName(String serviceName);
}
