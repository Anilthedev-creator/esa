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

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read models for static/admin-data.js.
 *
 * Keys here are exactly what the page renderers read (data.customers,
 * invoiceId, paidAt, stats.activeBookings ...) - not the entity property
 * names. Where a value has no column behind it yet it stays null so the UI
 * shows a dash rather than us inventing a number.
 */
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

    /* --------------------------------- stats --------------------------------- */

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

        // payments have no status column yet, so revenue is every recorded
        // payment - replace with a filtered sum once that column exists.
        BigDecimal revenue = BigDecimal.ZERO;
        for (Payment payment : paymentRepository.findAll()) {
            if (payment.getAmount() != null) {
                revenue = revenue.add(payment.getAmount());
            }
        }

        List<Map<String, Object>> recentRequests = new ArrayList<>();
        for (Booking booking : bookings.subList(0, Math.min(RECENT_LIMIT, bookings.size()))) {
            boolean upcoming = booking.getBookingDate() != null && !booking.getBookingDate().isBefore(today);
            recentRequests.add(row(
                    "id", booking.getBookingID(),
                    "customer", booking.getFullName(),
                    "service", booking.getServiceName(),
                    "date", booking.getBookingDate(),
                    // no status column on bookings: derived from the date
                    "status", upcoming ? "confirmed" : "completed"));
        }

        List<Map<String, Object>> recentEnquiries = new ArrayList<>();
        List<Contact> reversed = new ArrayList<>(enquiries);
        java.util.Collections.reverse(reversed);
        for (Contact contact : reversed.subList(0, Math.min(RECENT_LIMIT, reversed.size()))) {
            recentEnquiries.add(row(
                    "id", contact.getContactId(),
                    "name", contact.getFullName(),
                    "preview", contact.getDescription(),
                    "status", "new"));
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

    /* -------------------------------- customers ------------------------------ */

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
                    // users has no updated_at column yet
                    "lastUpdated", null,
                    "role", user.getRole() == null ? "customer" : user.getRole().name().toLowerCase()));
        }
        return rows;
    }

    /* -------------------------------- enquiries ------------------------------ */

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
                    // contact has no status / reply / date columns yet
                    "status", "new",
                    "reply", null,
                    "date", null));
        }
        return rows;
    }

    /* -------------------------------- payments ------------------------------- */

    @Transactional(readOnly = true)
    public List<Map<String, Object>> payments() {
        List<Payment> all = paymentRepository.findAll();
        all.sort((a, b) -> {
            Long x = a.getPaymentId();
            Long y = b.getPaymentId();
            if (x == null && y == null) {
                return 0;
            }
            if (x == null) {
                return 1;
            }
            if (y == null) {
                return -1;
            }
            return Long.compare(y, x);
        });

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Payment payment : all) {
            rows.add(row(
                    "id", payment.getPaymentId(),
                    "invoiceId", payment.getTransactionId(),
                    // payments are not linked to a booking/customer yet
                    "customerName", null,
                    "amount", payment.getAmount(),
                    "status", payment.getPaymentDate() != null ? "completed" : "incomplete",
                    "paidAt", payment.getPaymentDate()));
        }
        return rows;
    }

    /* --------------------------------- helpers ------------------------------- */

    /** Used by AdminBootstrap so it never creates a second administrator. */
    @Transactional(readOnly = true)
    public boolean hasAdministrator() {
        for (User user : userRepository.findAll()) {
            if (user.getRole() == Role.ADMIN) {
                return true;
            }
        }
        return false;
    }

    /** Bookings have no created_at column, so the numeric id is the recency. */
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
