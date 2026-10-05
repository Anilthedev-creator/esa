package com.esaengineering.api;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.model.User;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Everything the customer portal needs, scoped to a single email address.
 *
 * The portal is read-mostly with two write actions the customer owns: cancelling
 * a booking that has not been paid, and reopening an enquiry that was closed.
 * Every lookup takes the caller's email first, so a customer can only reach rows
 * they submitted - a request for someone else's booking id returns 404 rather
 * than 403, so the portal never confirms that other customers' bookings exist.
 */
@Service
public class PortalService {

    private static final Logger log = LoggerFactory.getLogger(PortalService.class);

    private final UserRepository userRepository;
    private final BookingRepository bookingRepository;
    private final ContactRepository contactRepository;
    private final PaymentRepository paymentRepository;

    public PortalService(UserRepository userRepository,
                         BookingRepository bookingRepository,
                         ContactRepository contactRepository,
                         PaymentRepository paymentRepository) {
        this.userRepository = userRepository;
        this.bookingRepository = bookingRepository;
        this.contactRepository = contactRepository;
        this.paymentRepository = paymentRepository;
    }

    /* ------------------------------- profile ------------------------------- */

    /** The signed-in customer's own account details. */
    public Map<String, Object> profile(String email) {
        return describe(user(email));
    }

    /**
     * Updates the editable profile fields. Email, role and password are
     * excluded: email is the identity the whole portal is scoped by, so
     * changing it would silently orphan the customer's own bookings.
     */
    @Transactional
    public Map<String, Object> updateProfile(String email, Map<String, Object> body) {
        User user = user(email);
        Object name = body.get("fullName");
        if (name != null && !String.valueOf(name).trim().isEmpty()) {
            user.setFullName(String.valueOf(name).trim());
        }
        user.setPhoneNumber(str(body.get("phoneNumber")));
        user.setCompanyName(str(body.get("companyName")));
        return describe(userRepository.save(user));
    }

    /* ------------------------------ bookings ------------------------------- */

    /** Every booking made with this email address, newest first. */
    public List<Map<String, Object>> bookings(String email) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Booking b : bookingRepository.findByEmail(email)) {
            out.add(summary(b, paymentRepository.findFirstByBookingId(b.getBookingID()).orElse(null)));
        }
        out.sort((a, b) -> Long.compare(toLong(b.get("bookingId")), toLong(a.get("bookingId"))));
        return out;
    }

    /** One of this customer's own bookings, with its payment state. */
    public Map<String, Object> booking(String email, Long bookingId) {
        Booking booking = ownBooking(email, bookingId);
        Payment payment = paymentRepository.findFirstByBookingId(booking.getBookingID()).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>(summary(booking, payment));
        out.put("email", booking.getEmail());
        out.put("phone", booking.getPhone());
        out.put("notes", booking.getDescription());
        out.put("payment", payment == null ? null : describePayment(payment));
        return out;
    }

    /**
     * Cancels a booking that is still pending or confirmed and unpaid.
     *
     * Already-paid bookings are refused outright - cancelling one would mean a
     * refund, which is a human decision, not a button. Completed and cancelled
     * bookings are refused too so the customer gets an explanation instead of a
     * silent success.
     */
    @Transactional
    public Map<String, Object> cancelBooking(String email, Long bookingId) {
        Booking booking = ownBooking(email, bookingId);
        String status = booking.getStatus() == null ? "pending" : booking.getStatus();

        if ("cancelled".equals(status)) {
            throw ApiException.badRequest("This booking is already cancelled");
        }
        if ("completed".equals(status)) {
            throw ApiException.badRequest("This booking is already completed and can no longer be cancelled");
        }

        Payment payment = paymentRepository.findFirstByBookingId(booking.getBookingID()).orElse(null);
        if (payment != null && "completed".equals(payment.getStatus())) {
            throw ApiException.badRequest(
                    "This booking is already paid - contact us on 0402 464 823 to arrange a refund");
        }

        booking.setStatus("cancelled");
        Booking saved = bookingRepository.save(booking);
        if (payment != null) {
            payment.setStatus("cancelled");
            paymentRepository.save(payment);
        }
        log.info("Portal: booking {} cancelled by {}", saved.getBookingID(), email);
        return summary(saved, payment);
    }

    /* ------------------------------ enquiries ------------------------------ */

    /** Every enquiry submitted with this email address. */
    public List<Map<String, Object>> enquiries(String email) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Contact c : contactRepository.findByEmail(email)) {
            out.add(row(
                    "id", c.getContactId(),
                    "name", c.getFullName(),
                    "service", c.getServiceName(),
                    "message", c.getDescription(),
                    "status", c.getStatus(),
                    "createdAt", c.getCreatedAt() == null ? null : c.getCreatedAt().toString(),
                    "reply", c.getReply()));
        }
        out.sort((a, b) -> Long.compare(toLong(b.get("id")), toLong(a.get("id"))));
        return out;
    }

    /**
     * Reopens an enquiry the team marked resolved. Only resolved enquiries can be
     * reopened - an open one already needs nothing further from the customer.
     */
    @Transactional
    public Map<String, Object> reopenEnquiry(String email, Long enquiryId) {
        Contact contact = ownEnquiry(email, enquiryId);
        if (!"resolved".equals(contact.getStatus())) {
            throw ApiException.badRequest("Only a resolved enquiry can be reopened");
        }
        contact.setStatus("in-progress");
        Contact saved = contactRepository.save(contact);
        log.info("Portal: enquiry {} reopened by {}", saved.getContactId(), email);
        return row(
                "id", saved.getContactId(),
                "name", saved.getFullName(),
                "service", saved.getServiceName(),
                "message", saved.getDescription(),
                "status", saved.getStatus(),
                "createdAt", saved.getCreatedAt() == null ? null : saved.getCreatedAt().toString(),
                "reply", saved.getReply());
    }

    /* ------------------------------- payments ------------------------------ */

    /**
     * Every payment belonging to this customer, resolved through their booking
     * ids. {@code Payment} carries no email column, so joining on the customer's
     * bookings is the only correct way to scope this - matching on
     * {@code customerName} would leak payments made by anyone with a similar name.
     */
    public List<Map<String, Object>> payments(String email) {
        List<Long> bookingIds = new ArrayList<>();
        for (Booking b : bookingRepository.findByEmail(email)) {
            bookingIds.add(b.getBookingID());
        }
        if (bookingIds.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Payment p : paymentRepository.findByBookingIdIn(bookingIds)) {
            out.add(describePayment(p));
        }
        out.sort((a, b) -> Long.compare(toLong(b.get("id")), toLong(a.get("id"))));
        return out;
    }

    /* -------------------------------- helpers ------------------------------ */

    private Map<String, Object> summary(Booking b, Payment payment) {
        BigDecimal amount = payment != null && payment.getAmount() != null
                ? payment.getAmount()
                : BigDecimal.ZERO;
        String paymentStatus = payment == null || payment.getStatus() == null
                ? "unpaid"
                : payment.getStatus();
        return row(
                "bookingId", b.getBookingID(),
                "name", b.getFullName(),
                "service", b.getServiceName(),
                "status", b.getStatus(),
                "bookingDate", b.getBookingDate() == null ? null : b.getBookingDate().toString(),
                "createdAt", b.getCreatedAt() == null ? null : b.getCreatedAt().toString(),
                "fee", amount,
                "paymentStatus", paymentStatus,
                "paid", "completed".equals(paymentStatus),
                "paymentReference", payment == null ? null : payment.getTransactionId(),
                "canCancel", canCancel(b.getStatus(), paymentStatus),
                "canPay", canPay(b.getStatus(), paymentStatus));
    }

    private static boolean canCancel(String bookingStatus, String paymentStatus) {
        String bs = bookingStatus == null ? "pending" : bookingStatus;
        return ("pending".equals(bs) || "confirmed".equals(bs))
                && !"completed".equals(paymentStatus);
    }

    private static boolean canPay(String bookingStatus, String paymentStatus) {
        String bs = bookingStatus == null ? "pending" : bookingStatus;
        return ("pending".equals(bs) || "confirmed".equals(bs))
                && !"completed".equals(paymentStatus)
                && !"cancelled".equals(paymentStatus);
    }

    private Map<String, Object> describePayment(Payment p) {
        String status = p.getStatus() == null ? "incomplete" : p.getStatus();
        return row(
                "id", p.getPaymentId(),
                "reference", p.getTransactionId(),
                "amount", p.getAmount(),
                "status", status,
                "paid", "completed".equals(status),
                "bookingId", p.getBookingId(),
                "customerName", p.getCustomerName(),
                "paymentDate", p.getPaymentDate() == null ? null : p.getPaymentDate().toString());
    }

    private Map<String, Object> describe(User u) {
        return row(
                "fullName", u.getFullName(),
                "email", u.getEmail(),
                "role", u.getRole() == null ? null : u.getRole().name(),
                "phoneNumber", u.getPhoneNumber(),
                "companyName", u.getCompanyName());
    }

    /**
     * Loads a booking only if it belongs to the caller. Throws 404 (not 403) so
     * that guessing ids reveals nothing about other customers' data.
     */
    private Booking ownBooking(String email, Long bookingId) {
        if (bookingId == null) {
            throw ApiException.notFound("Booking not found");
        }
        return bookingRepository.findByBookingId(bookingId)
                .filter(b -> Objects.equals(email, b.getEmail()))
                .orElseThrow(() -> ApiException.notFound("Booking not found"));
    }

    private Contact ownEnquiry(String email, Long enquiryId) {
        if (enquiryId == null) {
            throw ApiException.notFound("Enquiry not found");
        }
        return contactRepository.findById(enquiryId)
                .filter(c -> Objects.equals(email, c.getEmail()))
                .orElseThrow(() -> ApiException.notFound("Enquiry not found"));
    }

    private User user(String email) {
        return userRepository.findByEmail(email == null ? "" : email)
                .orElseThrow(() -> ApiException.unauthorized("Your session has expired - please sign in again"));
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }

    private static long toLong(Object o) {
        return o instanceof Number ? ((Number) o).longValue() : 0L;
    }

    private static Map<String, Object> row(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }
}
