package com.esaengineering.service;

import java.util.Optional;
import java.util.List;
import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.esaengineering.model.Booking;

import com.esaengineering.repository.BookingRepository;

@Service
public class BookingService {

    private final BookingRepository bookingRepository;

    public BookingService(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    /*
    save booking, fills in the missing bits and checks the required fields
    */
    public Booking saveBooking(Booking booking) {

        if (booking.getFullName() == null || booking.getFullName().isBlank()) {
            throw new IllegalArgumentException("Full name is required");
        }
        if (booking.getEmail() == null || booking.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        if (booking.getServiceName() == null || booking.getServiceName().isBlank()) {
            throw new IllegalArgumentException("Service name is required");
        }

        // booking forms do not have a date picker, so use today
        if (booking.getBookingDate() == null) {
            booking.setBookingDate(LocalDate.now());
        }
        if (booking.getStatus() == null || booking.getStatus().isBlank()) {
            booking.setStatus("pending");
        }
        if (booking.getCreatedAt() == null) {
            booking.setCreatedAt(LocalDateTime.now());
        }

        return bookingRepository.save(booking);
    }

    public List<Booking> getAllBookings() {
        return bookingRepository.findAll();
    }

    //new added
    public List<Booking> getBookingsByEmail(String email) {
        return bookingRepository.findByEmail(email);
    }

    ///new added
    public boolean checkBookingByEmail(String email) {
        return bookingRepository.existsByEmail(email);
    }

    //new added
    public Long countBookingByService(String serviceName) {
        return bookingRepository.countByServiceName(serviceName);
    }

    public Optional<Booking> getBookingsById(Long id) {
        return bookingRepository.findByBookingId(id);
    }

    public boolean deleteBooking(Long bookingId) {
        if (!bookingRepository.existsById(bookingId)) {
            return false;
        }

        bookingRepository.deleteById(bookingId);
        return true;
    }
}
