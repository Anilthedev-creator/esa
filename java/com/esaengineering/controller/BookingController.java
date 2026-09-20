package com.esaengineering.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.BookingService;
import com.esaengineering.model.Booking;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    /*
    create a new booking
    */
    @PostMapping("/create")
    public ResponseEntity<Booking> createBooking(@RequestBody Booking booking) {
        Booking saved = bookingService.saveBooking(booking);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/get")
    public List<Booking> getAllBookings() {
        return bookingService.getAllBookings();
    }

    @GetMapping("/id/{id}")
    public ResponseEntity<Booking> getBookingById(@PathVariable("id") Long id) {
        Optional<Booking> booking = bookingService.getBookingsById(id);
        if (booking.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(booking.get());
    }

    @GetMapping("/email/{email}")
    public List<Booking> getBookingsByEmail(@PathVariable("email") String email) {
        return bookingService.getBookingsByEmail(email);
    }

    @DeleteMapping("/id/{id}")
    public ResponseEntity<String> deleteBooking(@PathVariable("id") Long id) {
        boolean deleted = bookingService.deleteBooking(id);

        if (deleted) {
            return ResponseEntity.ok("Booking deleted successfully");
        }

        return ResponseEntity.status(404).body("Booking not found");
    }
}
