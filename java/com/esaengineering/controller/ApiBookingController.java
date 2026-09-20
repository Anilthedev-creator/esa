package com.esaengineering.controller;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Payment;
import com.esaengineering.model.PaymentStatus;
import com.esaengineering.service.BookingService;
import com.esaengineering.service.PaymentService;

// Bookings from the website booking page (booking.html calls these).
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/bookings")
public class ApiBookingController {

    // price of one consultation in AUD
    private static final BigDecimal CONSULTATION_FEE = new BigDecimal("150.00");

    private final BookingService bookingService;
    private final PaymentService paymentService;

    public ApiBookingController(BookingService bookingService, PaymentService paymentService) {
        this.bookingService = bookingService;
        this.paymentService = paymentService;
    }

    // reads a value that can have two different names, eg "name" or "fullName"
    private String pick(Map<String, String> body, String name1, String name2) {
        String value = body.get(name1);
        if (value == null || value.isBlank()) {
            value = body.get(name2);
        }
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    // saves a new booking from the booking page form
    @PostMapping
    public ResponseEntity<Map<String, Object>> createBooking(@RequestBody Map<String, String> body) {
        String name = pick(body, "name", "fullName");
        String email = body.get("email");
        String phone = body.get("phone");
        String service = pick(body, "service", "serviceName");
        String notes = pick(body, "notes", "description");

        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Full name is required"));
        }
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Email is required"));
        }
        if (service == null || service.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Please choose a service"));
        }

        Booking booking = new Booking();
        booking.setFullName(name);
        booking.setEmail(email.trim());
        booking.setServiceName(service);
        booking.setDescription(notes == null ? "" : notes);
        booking.setPhone(phone == null ? null : phone.trim());
        booking.setFee(CONSULTATION_FEE);

        Booking saved = bookingService.saveBooking(booking);

        // every booking gets a payment row for the consultation fee
        Payment payment = paymentService.createPaymentForBooking(saved, CONSULTATION_FEE);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Thanks - we've received your request and will be in touch shortly.");
        response.put("bookingId", saved.getBookingId());
        response.put("paymentId", payment.getPaymentId());

        return ResponseEntity.status(201).body(response);
    }

    // details for the payment page (payment.html?booking=...)
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getBooking(@PathVariable("id") Long id) {
        Optional<Booking> found = bookingService.getBookingsById(id);

        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Booking not found"));
        }

        Booking booking = found.get();

        Map<String, Object> bookingJson = new HashMap<>();
        bookingJson.put("id", booking.getBookingId());
        bookingJson.put("name", booking.getFullName());
        bookingJson.put("email", booking.getEmail());
        bookingJson.put("phone", booking.getPhone());
        bookingJson.put("service", booking.getServiceName());
        bookingJson.put("status", booking.getStatus());
        bookingJson.put("date", booking.getBookingDate() == null ? null : booking.getBookingDate().toString());
        bookingJson.put("createdAt", booking.getCreatedAt() == null ? null : booking.getCreatedAt().toString());
        bookingJson.put("fee", booking.getFee() == null ? CONSULTATION_FEE : booking.getFee());

        Optional<Payment> payment = paymentService.getPaymentByBookingId(booking.getBookingId());

        Map<String, Object> response = new HashMap<>();
        response.put("booking", bookingJson);

        if (payment.isPresent()) {
            Payment p = payment.get();
            Map<String, Object> paymentJson = new HashMap<>();
            paymentJson.put("id", p.getPaymentId());
            paymentJson.put("reference", p.getReference());
            paymentJson.put("amount", p.getAmount());
            if (p.getStatus() == PaymentStatus.SUCCESS) {
                paymentJson.put("status", "completed");
            } else {
                paymentJson.put("status", "pending");
            }
            response.put("payment", paymentJson);
        } else {
            response.put("payment", null);
        }

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> errorJson(String message) {
        Map<String, Object> json = new HashMap<>();
        json.put("message", message);
        return json;
    }
}
