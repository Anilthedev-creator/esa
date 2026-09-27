package com.esaengineering.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.BookingService;
import com.esaengineering.model.Booking;

@RestController
@RequestMapping("/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/create")
    public Booking createBooking(@RequestBody Booking booking) {
        return bookingService.saveBooking(booking);
    }

    @GetMapping("/get")
    public List<Booking> getAllBookings() {
        return bookingService.getAllBookings();
    }

    @GetMapping("/Id/{Id}")
    public Optional<Booking> GetBookingById(@PathVariable("Id") Long id) {
        return bookingService.getBookingsById(id);
    }

    @GetMapping("/id/{id}")
    public Optional<Booking> getBookingByIdLower(@PathVariable Long id) {
        return bookingService.getBookingsById(id);
    }

    @GetMapping("/email/{email}")
    public List<Booking> GetBookingsByEmailId(@PathVariable String email) {
        return bookingService.getBookingsByEmail(email);
    }

    @DeleteMapping("/Id/{Id}")
    public String deleteBooking(@PathVariable("Id") Long Id) {
        boolean deleted = bookingService.deleteBooking(Id);
        if (deleted) {
            return "Booking deleted successfully";
        }
        return "Booking not found";
    }

    @DeleteMapping("/{id}")
    public String deleteBookingLower(@PathVariable Long id) {
        boolean deleted = bookingService.deleteBooking(id);
        return deleted ? "Booking deleted successfully" : "Booking not found";
    }
}
