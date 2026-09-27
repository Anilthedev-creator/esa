package com.esaengineering.controller;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.model.Payment;
import com.esaengineering.service.PaymentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Legacy payment endpoints kept for backwards compatibility.
 *
 * All of them now require an administrator token: they read payment records
 * and can create or delete them at an arbitrary amount. Prefer
 * /api/payments/{id}/confirm for the public payment flow and
 * /api/admin/** for administration.
 */
@RestController
@RequestMapping("/payments")
@CrossOrigin(origins = "*")
public class PaymentController {

    private final PaymentService paymentService;
    private final AdminAccess adminAccess;

    public PaymentController(PaymentService paymentService, AdminAccess adminAccess) {
        this.paymentService = paymentService;
        this.adminAccess = adminAccess;
    }

    @PostMapping
    public ResponseEntity<Payment> createPayment(
            @RequestBody Payment payment,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return ResponseEntity.ok(paymentService.createPayment(payment));
    }

    @GetMapping("/{paymentId}")
    public ResponseEntity<Payment> getPaymentById(
            @PathVariable Long paymentId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return paymentService.getPaymentById(paymentId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Payment>> getAllPayments(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return ResponseEntity.ok(paymentService.getAllPayments());
    }

    @GetMapping("/transaction/{transactionId}")
    public ResponseEntity<Payment> getPaymentByTransactionId(
            @PathVariable String transactionId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return paymentService.getPaymentByTransactionId(transactionId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{paymentId}")
    public ResponseEntity<Void> deletePayment(
            @PathVariable Long paymentId,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        paymentService.deletePayment(paymentId);
        return ResponseEntity.noContent().build();
    }
}
