package com.esaengineering.api;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.time.ZoneId;
import org.springframework.transaction.annotation.Transactional;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiPublicController {

    private final BookingRepository bookingRepo;
    private final ContactRepository contactRepo;
    private final PaymentRepository paymentRepo;
    private final AdminAccess adminAccess;
    private final PortalAccess portalAccess;
    private final BigDecimal consultationFee;
    private final boolean demoEmailPreview;
    private final boolean demoCardPaymentsEnabled;
    private final EnquiryEmailService enquiryEmailService;

    public ApiPublicController(BookingRepository bookingRepo, ContactRepository contactRepo,
                                PaymentRepository paymentRepo, AdminAccess adminAccess, PortalAccess portalAccess,
                                @Value("${app.booking.consultation-fee:50}") BigDecimal consultationFee,
                                @Value("${app.demo-email-preview:false}") boolean demoEmailPreview,
                                @Value("${app.payment.demo-card-enabled:true}") boolean demoCardPaymentsEnabled,
                                EnquiryEmailService enquiryEmailService) {
        this.bookingRepo = bookingRepo;
        this.contactRepo = contactRepo;
        this.paymentRepo = paymentRepo;
        this.adminAccess = adminAccess;
        this.portalAccess = portalAccess;
        this.consultationFee = consultationFee;
        this.demoEmailPreview = demoEmailPreview;
        this.demoCardPaymentsEnabled = demoCardPaymentsEnabled;
        this.enquiryEmailService = enquiryEmailService;
    }

    // ---- bookings ----

    @PostMapping("/bookings")
    @Transactional
    public Map<String, Object> createBooking(@RequestBody Map<String, Object> body,
                                             @RequestHeader(value = "Authorization", required = false) String auth) {
        TokenService.TokenPayload identity = portalAccess.requireCustomer(auth);
        String email = identity.getEmail().trim().toLowerCase(Locale.ROOT);
        String name = text(body, "name");
        if (name == null) name = text(body, "fullName");
        String phone = text(body, "phone");
        String service = text(body, "service");
        if (service == null) service = text(body, "serviceName");
        String notes = text(body, "notes");
        if (notes == null) notes = text(body, "description");
        if (notes == null) notes = text(body, "message");
        name = name == null ? null : name.trim();
        phone = phone == null ? "" : phone.trim();
        service = service == null ? "General Inquiry" : service.trim();
        notes = notes == null ? "" : notes.trim();

        if (name == null || name.isEmpty()) throw ApiException.badRequest("Name is required");
        if (name.length() > 100) throw ApiException.badRequest("Name must be 100 characters or fewer");
        if (phone.length() > 40) throw ApiException.badRequest("Phone must be 40 characters or fewer");
        if (service.length() > 100) throw ApiException.badRequest("Service must be 100 characters or fewer");
        if (notes.length() > 1000) throw ApiException.badRequest("Please keep your notes to 1,000 characters or fewer");
        String slot = text(body, "preferredSlot");
        if (!BookingSchedule.isAllowedSlot(slot)) {
            throw ApiException.badRequest("Choose a time between 9:00 am and 4:30 pm.");
        }
        String preferred = text(body, "preferredDate");
        if (preferred == null || preferred.isBlank()) {
            throw ApiException.badRequest("Please choose a booking date.");
        }
        LocalDate bookingDate = parseDate(preferred.length() >= 10 ? preferred.substring(0, 10) : preferred,
                "Please choose a valid booking date.");
        LocalDate today = LocalDate.now(BookingSchedule.ZONE);
        if (bookingDate.isBefore(today)) {
            throw ApiException.badRequest("Please choose today or a future booking date.");
        }
        if (!BookingSchedule.slotTime(bookingDate, slot).isAfter(java.time.Instant.now())) {
            throw ApiException.badRequest("Choose a time that has not passed.");
        }

        Booking b = new Booking();
        b.setFullName(name);
        b.setEmail(email);
        b.setPhone(phone != null ? phone : "");
        b.setServiceName(service != null ? service : "General Inquiry");
        b.setDescription(notes != null ? notes : "");
        b.setAbnNumber("");
        // if they picked a preferred date on the booking form use that one
        b.setPreferredSlot(slot);
        b.setBookingDate(bookingDate);
        b.setStatus("pending");
        b = bookingRepo.save(b);

        // Create a pending payment for the booking flow (consultation fee)
        Payment p = new Payment();
        p.setAmount(consultationFee);
        p.setTransactionId("ESA-" + b.getBookingID() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        p.setCustomerName(name);
        p.setStatus("incomplete");
        p.setBookingId(b.getBookingID());
        p = paymentRepo.save(p);

        String emailSubject = "We got your booking - " + b.getServiceName();
        String emailBody = "Hi " + name + ",\n\nThanks for booking " + b.getServiceName() + " with ESA Engineering.\n"
                + "Your booking reference is #" + b.getBookingID() + " and the consultation fee is $" + p.getAmount() + ".\n"
                + "The next step is the payment page (payment.html?booking=" + b.getBookingID() + ") where you can pay by card or log a bank transfer.\n\n- ESA Engineering";
        boolean includeDemoEmail = demoEmailPreview && "CUSTOMER".equalsIgnoreCase(identity.getRole())
                && email.endsWith("@example.com");
        if (includeDemoEmail) writeOutbox(email, emailSubject, emailBody);

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
        if (includeDemoEmail) {
            Map<String, Object> preview = new LinkedHashMap<>();
            preview.put("subject", emailSubject);
            preview.put("body", emailBody);
            preview.put("bookingId", b.getBookingID());
            resp.put("demoEmailPreview", preview);
        }
        return resp;
    }

    @GetMapping("/bookings/{id}")
    public Map<String, Object> getBooking(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Booking b = ownBooking(id, email);
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
        bookingMap.put("fee", paymentOpt.map(Payment::getAmount).orElse(consultationFee));
        bookingMap.put("createdAt", b.getCreatedAt());
        bookingMap.put("bookingDate", b.getBookingDate() != null ? b.getBookingDate().toString() : null);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("booking", bookingMap);
        if (paymentOpt.isPresent()) {
            Payment p = paymentOpt.get();
            resp.put("payment", paymentSummary(p));
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
    @Transactional
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
        if (message.isBlank()) throw ApiException.badRequest("Please add a short message so we know how to help.");
        email = email.toLowerCase(Locale.ROOT);
        if (name.length() > 100) throw ApiException.badRequest("Name must be 100 characters or fewer");
        if (email.length() > 100 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw ApiException.badRequest("Enter a valid email address");
        }
        if (type.length() > 100) throw ApiException.badRequest("Inquiry type must be 100 characters or fewer");
        if (message.length() > 2000) throw ApiException.badRequest("Please keep your message to 2,000 characters or fewer");

        // attachment arrives as base64 from the contact form. Check the size,
        // type and file signature before saving it, the same as server.js.
        String attachName = text(body, "attachmentName");
        String attachData = text(body, "attachmentData");
        String attachType = text(body, "attachmentType");
        if ((attachName == null) != (attachData == null)) {
            throw ApiException.badRequest("Please choose the attachment again and try once more.");
        }
        if (attachName != null) {
            if (attachName.length() > 120 || attachType == null
                    || !("application/pdf".equalsIgnoreCase(attachType)
                    || "image/jpeg".equalsIgnoreCase(attachType)
                    || "image/png".equalsIgnoreCase(attachType))) {
                throw ApiException.badRequest("Attachments must be a PDF, JPG or PNG file under 3MB.");
            }
            if (attachData.length() > 4 * 1024 * 1024
                    || !attachData.matches("^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$")) {
                throw ApiException.badRequest("That attachment could not be read. Please choose it again.");
            }
            byte[] bytes;
            try {
                bytes = java.util.Base64.getDecoder().decode(attachData);
            } catch (IllegalArgumentException e) {
                throw ApiException.badRequest("That attachment could not be read. Please choose it again.");
            }
            if (bytes.length == 0 || bytes.length > 3 * 1024 * 1024) {
                throw ApiException.badRequest("Attachments must be under 3MB.");
            }
            boolean looksLikeFile = "application/pdf".equalsIgnoreCase(attachType)
                    ? bytes.length >= 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F' && bytes[4] == '-'
                    : "image/jpeg".equalsIgnoreCase(attachType)
                    ? bytes.length > 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff
                    : bytes.length > 8 && (bytes[0] & 0xff) == 137 && bytes[1] == 'P' && bytes[2] == 'N' && bytes[3] == 'G'
                    && bytes[4] == 13 && bytes[5] == 10 && bytes[6] == 26 && bytes[7] == 10;
            if (!looksLikeFile) throw ApiException.badRequest("The attachment does not match its file type.");

            String safeName = attachName.replaceAll("[^a-zA-Z0-9._-]", "_");
            String attachNote = "\n[attachment saved as " + safeName + "]";
            if (message.length() + attachNote.length() > 2000) {
                throw ApiException.badRequest("Please shorten the message a little to include the attachment name.");
            }
            try {
                java.nio.file.Path dir = java.nio.file.Paths.get("data", "uploads");
                java.nio.file.Files.createDirectories(dir);
                try {
                    java.nio.file.Files.setPosixFilePermissions(dir,
                            java.nio.file.attribute.PosixFilePermissions.fromString("rwx------"));
                } catch (UnsupportedOperationException ignored) {
                    // Some file systems do not support POSIX permissions.
                }
                String storedName = System.currentTimeMillis() + "-" + java.util.UUID.randomUUID() + "-" + safeName;
                java.nio.file.Path storedFile = dir.resolve(storedName);
                try {
                    java.nio.file.Files.createFile(storedFile,
                            java.nio.file.attribute.PosixFilePermissions.asFileAttribute(
                                    java.nio.file.attribute.PosixFilePermissions.fromString("rw-------")));
                } catch (UnsupportedOperationException ignored) {
                    java.nio.file.Files.createFile(storedFile);
                }
                java.nio.file.Files.write(storedFile, bytes, java.nio.file.StandardOpenOption.WRITE);
                message = message + attachNote;
            } catch (java.io.IOException e) {
                throw ApiException.unavailable("We could not save that attachment. Please try again or send it by email.");
            }
        }

        Contact c = new Contact();
        c.setFullName(name);
        c.setEmail(email);
        c.setServiceName(type);
        c.setDescription(message);
        c.setStatus("new");
        c = contactRepo.save(c);

        Map<String, Object> emailDelivery = enquiryEmailService.notifyEnquiry(c);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", emailDelivery.get("message"));
        resp.put("success", true);
        resp.put("enquiry", Map.of("id", c.getContactId()));
        resp.put("emailDelivery", emailDelivery);
        return resp;
    }

    @GetMapping("/enquiries/{id}")
    public Map<String, Object> getEnquiryPublic(@PathVariable Long id,
                                                @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Contact c = contactRepo.findById(id)
                .filter(row -> sameEmail(email, row.getEmail()))
                .orElseThrow(() -> ApiException.notFound("Enquiry not found"));
        Map<String, Object> enquiry = new LinkedHashMap<>();
        enquiry.put("id", c.getContactId());
        enquiry.put("name", c.getFullName());
        enquiry.put("email", c.getEmail());
        enquiry.put("service", c.getServiceName());
        enquiry.put("message", c.getDescription());
        enquiry.put("status", c.getStatus());
        enquiry.put("createdAt", c.getCreatedAt());
        enquiry.put("reply", c.getReply());
        return Map.of("enquiry", enquiry);
    }

    // ---- payments ----

    @PostMapping("/payments/{id}/confirm")
    public Map<String, Object> confirmPayment(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, Object> body,
                                              @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Payment p = paymentRepo.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        Booking booking = bookingForPayment(p, email);
        if ("cancelled".equals(booking.getStatus()) || "cancelled".equals(p.getStatus())) {
            throw ApiException.badRequest("This booking was cancelled and can no longer be paid.");
        }
        if ("completed".equals(p.getStatus())) {
            return paymentResult("This fee is already paid, thanks!", p, "completed");
        }
        // A logged transfer is a single outstanding payment, not permission to
        // log another transfer or switch to card while it is clearing.
        if ("pending".equals(p.getStatus())) {
            return paymentResult("This transfer is already logged and is waiting to clear.", p, "pending");
        }
        String ref = text(body, "transferReference");
        if (ref == null || ref.length() > 120) {
            throw ApiException.badRequest("Please put in a valid transfer reference from your bank receipt.");
        }
        LocalDate paidDate = parseDate(text(body, "paidDate"), "Please choose a valid date on or before today.");
        if (paidDate.isAfter(LocalDate.now())) {
            throw ApiException.badRequest("Please choose a valid date on or before today.");
        }

        p.setStatus("pending");
        p.setMethod("transfer");
        p.setTransferReference(ref);
        p.setPaidDate(paidDate);
        p.setPaymentDate(LocalDateTime.now());
        paymentRepo.save(p);
        System.out.println("[mail] bank transfer logged: " + p.getTransactionId() + " ref " + ref);
        return paymentResult("Thanks! We logged your transfer and will confirm once it clears, usually within 1 business day.", p, "pending");
    }

    /**
     * Card payment (demo/sandbox, mirrors POST /api/payments/{id}/card in
     * server.js). Validates properly - luhn, expiry, cvv - then approves.
     * No real gateway is behind this, so no real money moves and only the
     * last 4 digits are kept. TODO: stripe/adyen when this goes live.
     */
    @PostMapping("/payments/{id}/card")
    public Map<String, Object> cardPayment(@PathVariable Long id,
                                           @RequestBody Map<String, Object> body,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        if (!demoCardPaymentsEnabled) {
            throw ApiException.unavailable("Demo card payments are turned off. Please use the bank transfer option or contact ESA.");
        }
        String email = portalAccess.requireCustomer(auth).getEmail();
        Payment p = paymentRepo.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        Booking booking = bookingForPayment(p, email);
        if ("cancelled".equals(booking.getStatus()) || "cancelled".equals(p.getStatus())) {
            throw ApiException.badRequest("This booking was cancelled and can no longer be paid.");
        }
        if ("completed".equals(p.getStatus())) {
            Map<String, Object> out = paymentResult("This fee is already paid, thanks!", p, "completed");
            out.put("cardLast4", p.getCardLast4());
            return out;
        }
        if ("pending".equals(p.getStatus())) {
            throw ApiException.conflict("A bank transfer is already logged. Please contact us before paying by card.");
        }
        String name = text(body, "cardName");
        String number = text(body, "cardNumber");
        String expiry = text(body, "cardExpiry");
        String cvv = text(body, "cardCvv");
        if (name == null) throw ApiException.badRequest("Please put the name as it appears on the card.");
        if (number == null) number = "";
        String digits = number.replaceAll("\\s+", "");
        if (!luhnOk(digits)) throw ApiException.badRequest("That card number does not look right, please check it.");
        if (expiry == null || !expiry.matches("^(0[1-9]|1[0-2])\\s*/\\s*([0-9]{2})$")) {
            throw ApiException.badRequest("Expiry should look like MM/YY, e.g. 08/28.");
        }
        int mm = Integer.parseInt(expiry.substring(0, 2));
        int yy = Integer.parseInt(expiry.replaceAll("[^0-9]", "").substring(2));
        // a card is valid to the END of its expiry month
        java.time.YearMonth exp = java.time.YearMonth.of(2000 + yy, mm);
        if (exp.isBefore(java.time.YearMonth.now())) throw ApiException.badRequest("That card has expired, please use a different one.");
        if (cvv == null || !cvv.matches("^[0-9]{3,4}$")) {
            throw ApiException.badRequest("The CVV is the 3 or 4 digit number on the back of the card.");
        }

        // approved - cards settle straight away, so the booking is confirmed now
        p.setStatus("completed");
        p.setMethod("card");
        p.setCardLast4(digits.substring(digits.length() - 4));
        p.setPaidDate(LocalDate.now());
        p.setPaymentDate(LocalDateTime.now());
        paymentRepo.save(p);
        booking.setStatus("confirmed");
        bookingRepo.save(booking);
        System.out.println("[mail] card payment approved: " + p.getTransactionId()
                + " ($" + p.getAmount() + ", card ending " + p.getCardLast4() + ")");
        return Map.of(
                "message", "Payment approved - your booking is confirmed.",
                "reference", p.getTransactionId(),
                "status", "completed",
                "cardLast4", p.getCardLast4(),
                "success", true
        );
    }

    /** the checksum every real card number passes, same as server.js */
    private static boolean luhnOk(String digits) {
        if (digits == null || digits.length() < 13 || digits.length() > 19) return false;
        int sum = 0;
        boolean alt = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            char c = digits.charAt(i);
            if (c < '0' || c > '9') return false;
            int d = c - '0';
            if (alt) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
            alt = !alt;
        }
        return sum % 10 == 0;
    }

    @GetMapping("/payments/{id}")
    public Map<String, Object> getPayment(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Payment p = paymentRepo.findById(id).orElseThrow(() -> ApiException.notFound("Payment not found"));
        bookingForPayment(p, email);
        return Map.of("payment", paymentSummary(p));
    }

    private Booking ownBooking(Long id, String email) {
        return bookingRepo.findByBookingId(id)
                .filter(booking -> sameEmail(email, booking.getEmail()))
                .orElseThrow(() -> ApiException.notFound("Booking not found"));
    }

    private Booking bookingForPayment(Payment payment, String email) {
        if (payment.getBookingId() == null) throw ApiException.notFound("Payment not found");
        return bookingRepo.findByBookingId(payment.getBookingId())
                .filter(booking -> sameEmail(email, booking.getEmail()))
                .orElseThrow(() -> ApiException.notFound("Payment not found"));
    }

    private static boolean sameEmail(String first, String second) {
        return first != null && second != null && first.trim().equalsIgnoreCase(second.trim());
    }

    private static LocalDate parseDate(String value, String message) {
        try {
            if (value == null || value.isBlank()) throw new IllegalArgumentException();
            return LocalDate.parse(value);
        } catch (RuntimeException e) {
            throw ApiException.badRequest(message);
        }
    }

    private static Map<String, Object> paymentSummary(Payment p) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", p.getPaymentId());
        out.put("reference", p.getTransactionId());
        out.put("amount", p.getAmount());
        out.put("status", p.getStatus() == null ? "incomplete" : p.getStatus());
        out.put("bookingId", p.getBookingId());
        out.put("customerName", p.getCustomerName());
        out.put("paymentDate", p.getPaymentDate());
        out.put("paidDate", p.getPaidDate());
        out.put("method", p.getMethod() != null ? p.getMethod()
                : (p.getTransferReference() != null ? "transfer" : null));
        out.put("cardLast4", p.getCardLast4());
        out.put("paid", "completed".equals(p.getStatus()));
        return out;
    }

    private static Map<String, Object> paymentResult(String message, Payment p, String status) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", message);
        out.put("reference", p.getTransactionId());
        out.put("status", status);
        out.put("success", true);
        if (p.getCardLast4() != null) out.put("cardLast4", p.getCardLast4());
        return out;
    }

    private void writeOutbox(String to, String subject, String bodyText) {
        try {
            java.nio.file.Path dir = java.nio.file.Paths.get("data", "outbox");
            java.nio.file.Files.createDirectories(dir);
            String safeEmail = to.replaceAll("[^a-zA-Z0-9._-]", "_");
            String filename = System.currentTimeMillis() + "-" + System.nanoTime() + "-" + safeEmail + ".txt";
            String contents = "To: " + to + "\nSubject: " + subject + "\n\n" + bodyText + "\n";
            java.nio.file.Files.write(dir.resolve(filename), contents.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            System.out.println("[mail] booking confirmation could not be written to demo outbox");
        }
    }

    private static String text(Map<String, Object> body, String key) {
        if (body == null) return null;
        Object v = body.get(key);
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

}
