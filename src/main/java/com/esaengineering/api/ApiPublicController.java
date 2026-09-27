package com.esaengineering.api;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.web.ApiException;

import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiPublicController {

    private final BookingRepository bookingRepo;
    private final ContactRepository contactRepo;
    private final PaymentRepository paymentRepo;
    private final AdminAccess adminAccess;

    public ApiPublicController(BookingRepository bookingRepo, ContactRepository contactRepo,
                                PaymentRepository paymentRepo, AdminAccess adminAccess) {
        this.bookingRepo = bookingRepo;
        this.contactRepo = contactRepo;
        this.paymentRepo = paymentRepo;
        this.adminAccess = adminAccess;
    }

    // ---- bookings ----

    @PostMapping("/bookings")
    public Map<String, Object> createBooking(@RequestBody Map<String, Object> body) {
        String name = text(body, "name");
        if (name == null) name = text(body, "fullName");
        String email = text(body, "email");
        String phone = text(body, "phone");
        String service = text(body, "service");
        if (service == null) service = text(body, "serviceName");
        String notes = text(body, "notes");
        if (notes == null) notes = text(body, "description");
        if (notes == null) notes = text(body, "message");

        if (name == null || email == null) throw ApiException.badRequest("Name and email are required");

        Booking b = new Booking();
        b.setFullName(name);
        b.setEmail(email);
        b.setPhone(phone != null ? phone : "");
        b.setServiceName(service != null ? service : "General Inquiry");
        b.setDescription(notes != null ? notes : "");
        b.setAbnNumber("");
        b.setBookingDate(LocalDate.now());
        b.setStatus("pending");
        b = bookingRepo.save(b);

        // Create a pending payment for the booking flow (consultation fee)
        Payment p = new Payment();
        p.setAmount(new BigDecimal("250"));
        p.setTransactionId("ESA-" + b.getBookingID() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        p.setCustomerName(name);
        p.setStatus("incomplete");
        p.setBookingId(b.getBookingID());
        p = paymentRepo.save(p);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "Booking received — we'll be in touch shortly.");
        resp.put("success", true);
        resp.put("booking", Map.of(
                "id", b.getBookingID(),
                "name", b.getFullName(),
                "service", b.getServiceName(),
                "status", b.getStatus(),
                "fee", p.getAmount()
        ));
        resp.put("payment", Map.of(
                "id", p.getPaymentId(),
                "reference", p.getTransactionId(),
                "status", p.getStatus()
        ));
        return resp;
    }

    @GetMapping("/bookings/{id}")
    public Map<String, Object> getBooking(@PathVariable Long id) {
        Booking b = bookingRepo.findByBookingId(id).orElseThrow(() -> ApiException.notFound("Booking not found"));
        // Was: paymentRepo.findAll().stream().filter(...) - a full table scan per request.
        Optional<Payment> paymentOpt = paymentRepo.findFirstByBookingId(b.getBookingID());
        Map<String, Object> bookingMap = new LinkedHashMap<>();
        bookingMap.put("id", b.getBookingID());
        bookingMap.put("name", b.getFullName());
        bookingMap.put("email", b.getEmail());
        bookingMap.put("phone", b.getPhone());
        bookingMap.put("service", b.getServiceName());
        bookingMap.put("notes", b.getDescription());
        bookingMap.put("status", b.getStatus());
        bookingMap.put("fee", paymentOpt.map(Payment::getAmount).orElse(new BigDecimal("250")));
        bookingMap.put("createdAt", b.getCreatedAt());

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("booking", bookingMap);
        if (paymentOpt.isPresent()) {
            Payment p = paymentOpt.get();
            resp.put("payment", Map.of(
                    "id", p.getPaymentId(),
                    "reference", p.getTransactionId(),
                    "status", p.getStatus(),
                    "amount", p.getAmount()
            ));
        }
        return resp;
    }

    /**
     * Every booking, including names, emails, phones and ABNs. Nothing in the
     * frontend calls this (the booking form POSTs, payment.js reads
     * /api/bookings/{id}), so it is admin-only rather than a public dump.
     */
    @GetMapping("/bookings")
    public Map<String, Object> listBookings(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return Map.of("bookings", bookingRepo.findAll());
    }

    // ---- enquiries / contact ----

    @PostMapping("/enquiries")
    public Map<String, Object> createEnquiry(@RequestBody Map<String, Object> body) {
        String name = text(body, "name");
        if (name == null) name = text(body, "fullName");
        String email = text(body, "email");
        String type = text(body, "type");
        if (type == null) type = text(body, "serviceName");
        if (type == null) type = text(body, "subject");
        if (type == null) type = "General Inquiry";
        String message = text(body, "message");
        if (message == null) message = text(body, "description");
        if (message == null) message = "";

        if (name == null || email == null) throw ApiException.badRequest("Name and email are required");

        Contact c = new Contact();
        c.setFullName(name);
        c.setEmail(email);
        c.setServiceName(type);
        c.setDescription(message);
        c.setStatus("new");
        c = contactRepo.save(c);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "Thanks — we've received your request and will be in touch shortly.");
        resp.put("success", true);
        resp.put("enquiry", Map.of("id", c.getContactId()));
        return resp;
    }

    @GetMapping("/enquiries/{id}")
    public Map<String, Object> getEnquiryPublic(@PathVariable Long id) {
        Contact c = contactRepo.findById(id).orElseThrow(() -> ApiException.notFound("Enquiry not found"));
        return Map.of("enquiry", c);
    }

    // ---- payments confirm ----

    @PostMapping("/payments/{id}/confirm")
    public Map<String, Object> confirmPayment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Payment p = paymentRepo.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        // Simulate validation
        String cardNumber = text(body, "cardNumber");
        if (cardNumber == null || cardNumber.replaceAll("\\s+", "").length() < 12) {
            throw ApiException.badRequest("Invalid card number");
        }
        p.setStatus("completed");
        p.setPaymentDate(LocalDateTime.now());
        paymentRepo.save(p);

        // Also update booking status if linked
        if (p.getBookingId() != null) {
            bookingRepo.findByBookingId(p.getBookingId()).ifPresent(b -> {
                b.setStatus("confirmed");
                bookingRepo.save(b);
            });
        }

        return Map.of(
                "message", "Payment confirmed",
                "reference", p.getTransactionId(),
                "status", "completed",
                "success", true
        );
    }

    @GetMapping("/payments/{id}")
    public Map<String, Object> getPayment(@PathVariable Long id) {
        Payment p = paymentRepo.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        return Map.of("payment", p);
    }

    private static String text(Map<String, Object> body, String key) {
        if (body == null) return null;
        Object v = body.get(key);
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
}
