package com.esaengineering.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.model.Role;
import com.esaengineering.model.User;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.web.ApiException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDataService {

    private static final int RECENT_LIMIT = 5;

    private final BookingRepository bookingRepository;
    private final ContactRepository contactRepository;
    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    public AdminDataService(BookingRepository bookingRepository,
                            ContactRepository contactRepository,
                            PaymentRepository paymentRepository,
                            UserRepository userRepository) {
        this.bookingRepository = bookingRepository;
        this.contactRepository = contactRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> stats() {
        List<Booking> bookings = newestFirst(bookingRepository.findAll());
        List<Contact> enquiries = contactRepository.findAll();

        LocalDate today = LocalDate.now();

        long activeBookings = 0;
        for (Booking booking : bookings) {
            if (booking.getBookingDate() != null && !booking.getBookingDate().isBefore(today)) {
                activeBookings++;
            }
        }

        BigDecimal revenue = BigDecimal.ZERO;
        for (Payment payment : paymentRepository.findAll()) {
            if (payment.getAmount() != null) {
                revenue = revenue.add(payment.getAmount());
            }
        }

        List<Map<String, Object>> recentRequests = new ArrayList<>();
        for (Booking booking : bookings.subList(0, Math.min(RECENT_LIMIT, bookings.size()))) {
            boolean upcoming = booking.getBookingDate() != null && !booking.getBookingDate().isBefore(today);
            String status = booking.getStatus() != null ? booking.getStatus() : (upcoming ? "confirmed" : "completed");
            recentRequests.add(row(
                    "id", booking.getBookingID(),
                    "customer", booking.getFullName(),
                    "service", booking.getServiceName(),
                    "date", booking.getBookingDate(),
                    "status", status));
        }

        List<Map<String, Object>> recentEnquiries = new ArrayList<>();
        List<Contact> reversed = new ArrayList<>(enquiries);
        java.util.Collections.reverse(reversed);
        for (Contact contact : reversed.subList(0, Math.min(RECENT_LIMIT, reversed.size()))) {
            recentEnquiries.add(row(
                    "id", contact.getContactId(),
                    "name", contact.getFullName(),
                    "preview", contact.getDescription(),
                    "status", contact.getStatus() != null ? contact.getStatus() : "new"));
        }

        return row(
                "stats", row(
                        "totalUsers", userRepository.count(),
                        "activeBookings", activeBookings,
                        "pendingEnquiries", (long) enquiries.size(),
                        "revenue", revenue),
                "recentRequests", recentRequests,
                "recentEnquiries", recentEnquiries);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> customers() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User user : userRepository.findAll()) {
            rows.add(row(
                    "id", user.getUserId(),
                    "name", user.getFullName(),
                    "email", user.getEmail(),
                    "phone", user.getPhoneNumber(),
                    "company", user.getCompanyName(),
                    "status", user.isActive() ? "active" : "inactive",
                    "lastUpdated", null,
                    "role", user.getRole() == null ? "customer" : user.getRole().name().toLowerCase()));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> customerById(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found"));
        return row(
                "id", user.getUserId(),
                "name", user.getFullName(),
                "email", user.getEmail(),
                "phone", user.getPhoneNumber(),
                "company", user.getCompanyName(),
                "status", user.isActive() ? "active" : "inactive",
                "role", user.getRole() == null ? "customer" : user.getRole().name().toLowerCase());
    }

    @Transactional
    public Map<String, Object> updateCustomer(Long id, Map<String, Object> body) {
        User user = userRepository.findById(id).orElseThrow(() -> ApiException.notFound("Customer not found"));
        if (body.containsKey("firstName") || body.containsKey("lastName")) {
            String first = body.get("firstName") != null ? body.get("firstName").toString().trim() : "";
            String last = body.get("lastName") != null ? body.get("lastName").toString().trim() : "";
            String full = (first + " " + last).trim();
            if (!full.isEmpty()) user.setFullName(full);
        }
        if (body.containsKey("phone")) user.setPhoneNumber(body.get("phone") != null ? body.get("phone").toString() : "");
        if (body.containsKey("companyName")) user.setCompanyName(body.get("companyName") != null ? body.get("companyName").toString() : "");
        if (body.containsKey("company")) user.setCompanyName(body.get("company") != null ? body.get("company").toString() : "");
        if (body.containsKey("status")) {
            String s = body.get("status").toString().toLowerCase();
            user.setActive(!"inactive".equals(s));
        }
        userRepository.save(user);
        return customerById(id);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> enquiries() {
        List<Map<String, Object>> rows = new ArrayList<>();
        List<Contact> reversed = new ArrayList<>(contactRepository.findAll());
        java.util.Collections.reverse(reversed);
        for (Contact contact : reversed) {
            rows.add(row(
                    "id", contact.getContactId(),
                    "name", contact.getFullName(),
                    "email", contact.getEmail(),
                    "subject", contact.getServiceName(),
                    "message", contact.getDescription(),
                    "status", contact.getStatus() != null ? contact.getStatus() : "new",
                    "reply", contact.getReply(),
                    "date", contact.getCreatedAt()));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> enquiryById(Long id) {
        Contact c = contactRepository.findById(id).orElseThrow(() -> ApiException.notFound("Enquiry not found"));
        return row(
                "id", c.getContactId(),
                "name", c.getFullName(),
                "email", c.getEmail(),
                "subject", c.getServiceName(),
                "message", c.getDescription(),
                "status", c.getStatus(),
                "reply", c.getReply(),
                "date", c.getCreatedAt());
    }

    @Transactional
    public Map<String, Object> updateEnquiry(Long id, Map<String, Object> body) {
        Contact c = contactRepository.findById(id).orElseThrow(() -> ApiException.notFound("Enquiry not found"));
        if (body.containsKey("status")) c.setStatus(body.get("status").toString());
        if (body.containsKey("reply")) c.setReply(body.get("reply") != null ? body.get("reply").toString() : null);
        contactRepository.save(c);
        return enquiryById(id);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> payments() {
        List<Payment> all = paymentRepository.findAll();
        all.sort((a, b) -> {
            Long x = a.getPaymentId();
            Long y = b.getPaymentId();
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            return Long.compare(y, x);
        });

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Payment payment : all) {
            rows.add(row(
                    "id", payment.getPaymentId(),
                    "invoiceId", payment.getTransactionId(),
                    "customerName", payment.getCustomerName(),
                    "amount", payment.getAmount(),
                    "status", payment.getStatus() != null ? payment.getStatus() : (payment.getPaymentDate() != null ? "completed" : "incomplete"),
                    "paidAt", payment.getPaymentDate()));
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> paymentById(Long id) {
        Payment p = paymentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        return row(
                "id", p.getPaymentId(),
                "invoiceId", p.getTransactionId(),
                "customerName", p.getCustomerName(),
                "amount", p.getAmount(),
                "status", p.getStatus(),
                "paidAt", p.getPaymentDate());
    }

    @Transactional
    public Map<String, Object> updatePayment(Long id, Map<String, Object> body) {
        Payment p = paymentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        if (body.containsKey("status")) p.setStatus(body.get("status").toString());
        if (body.containsKey("amount")) {
            try {
                BigDecimal amt = new BigDecimal(body.get("amount").toString());
                p.setAmount(amt);
            } catch (Exception ignored) {}
        }
        paymentRepository.save(p);
        return paymentById(id);
    }

    @Transactional(readOnly = true)
    public boolean hasAdministrator() {
        for (User user : userRepository.findAll()) {
            if (user.getRole() == Role.ADMIN) return true;
        }
        return false;
    }

    private List<Booking> newestFirst(List<Booking> bookings) {
        List<Booking> copy = new ArrayList<>(bookings);
        copy.sort((a, b) -> Long.compare(b.getBookingID(), a.getBookingID()));
        return copy;
    }

    private static Map<String, Object> row(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return map;
    }
}
