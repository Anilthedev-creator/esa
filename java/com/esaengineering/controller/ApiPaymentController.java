package com.esaengineering.controller;

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

// Card payments from the payment page (payment.html calls this).
// This is a demo checkout, no real money is charged.
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/payments")
public class ApiPaymentController {

    private final PaymentService paymentService;
    private final BookingService bookingService;

    public ApiPaymentController(PaymentService paymentService, BookingService bookingService) {
        this.paymentService = paymentService;
        this.bookingService = bookingService;
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<Map<String, Object>> confirmPayment(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {

        Optional<Payment> found = paymentService.getPaymentById(id);

        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Payment not found"));
        }

        Payment payment = found.get();

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "This payment was already completed");
            response.put("reference", payment.getReference());
            response.put("status", "completed");
            return ResponseEntity.ok(response);
        }

        // basic card checks (a real shop would use Stripe or similar here)
        String cardError = checkCard(body);
        if (cardError != null) {
            return ResponseEntity.badRequest().body(errorJson(cardError));
        }

        Payment paid = paymentService.confirmPayment(payment.getPaymentId());

        // the booking is confirmed once the fee is paid
        if (paid.getBookingId() != null) {
            Optional<Booking> booking = bookingService.getBookingsById(paid.getBookingId());
            if (booking.isPresent()) {
                Booking b = booking.get();
                b.setStatus("confirmed");
                bookingService.saveBooking(b);
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Payment successful");
        response.put("reference", paid.getReference());
        response.put("status", "completed");

        return ResponseEntity.ok(response);
    }

    // checks the card fields from the payment form
    private String checkCard(Map<String, String> body) {
        String cardNumber = body.get("cardNumber");
        String cardName = body.get("cardName");
        String expiry = body.get("expiry");
        String cvc = body.get("cvc");

        if (cardNumber == null || cardName == null || expiry == null || cvc == null) {
            return "Please fill in all card details";
        }

        String digits = cardNumber.replaceAll("[^0-9]", "");
        if (digits.length() < 12 || digits.length() > 19) {
            return "Card number looks wrong, please check it";
        }
        if (cardName.isBlank()) {
            return "Please enter the name on the card";
        }
        // MM/YY or MM/YYYY
        if (!expiry.trim().matches("\\d{2}/\\d{2}(\\d{2})?")) {
            return "Expiry date must look like MM/YY";
        }
        if (!cvc.trim().matches("\\d{3,4}")) {
            return "CVC must be 3 or 4 numbers";
        }

        return null;
    }

    private Map<String, Object> errorJson(String message) {
        Map<String, Object> json = new HashMap<>();
        json.put("message", message);
        return json;
    }
}
