package com.esaengineering.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.service.BookingService;
import com.esaengineering.model.Booking;

/**
 * Legacy booking endpoints kept for backwards compatibility.
 *
 * Reads and deletes now require an administrator token, because they expose
 * and can destroy other people's bookings. Prefer /api/bookings (POST) for the
 * public booking form and /api/admin/** for administration.
 */
@RestController
@RequestMapping("/bookings")
@CrossOrigin(origins = "*")
public class BookingController {

    private final BookingService bookingService;
    private final AdminAccess adminAccess;

    public BookingController(BookingService bookingService, AdminAccess adminAccess) {
        this.bookingService = bookingService;
        this.adminAccess = adminAccess;
    }

    @PostMapping("/create")
    public Booking createBooking(@RequestBody Booking booking,
                                 @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return bookingService.saveBooking(booking);
    }

    @GetMapping("/get")
    public List<Booking> getAllBookings(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return bookingService.getAllBookings();
    }

    @GetMapping("/Id/{Id}")
    public Optional<Booking> GetBookingById(@PathVariable("Id") Long id,
                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return bookingService.getBookingsById(id);
    }

    @GetMapping("/id/{id}")
    public Optional<Booking> getBookingByIdLower(@PathVariable Long id,
                                                 @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return bookingService.getBookingsById(id);
    }

    @GetMapping("/email/{email}")
    public List<Booking> GetBookingsByEmailId(@PathVariable String email,
                                              @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return bookingService.getBookingsByEmail(email);
    }

    @DeleteMapping("/Id/{Id}")
    public String deleteBooking(@PathVariable("Id") Long Id,
                                @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        boolean deleted = bookingService.deleteBooking(Id);
        return deleted ? "Booking deleted successfully" : "Booking not found";
    }

    @DeleteMapping("/{id}")
    public String deleteBookingLower(@PathVariable Long id,
                                     @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        boolean deleted = bookingService.deleteBooking(id);
        return deleted ? "Booking deleted successfully" : "Booking not found";
    }
}
