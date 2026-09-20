package com.esaengineering.controller;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.model.PaymentStatus;
import com.esaengineering.model.Role;
import com.esaengineering.model.SitePage;
import com.esaengineering.model.User;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.service.AdminService;
import com.esaengineering.service.AuthService;
import com.esaengineering.service.BookingService;
import com.esaengineering.service.ContactService;
import com.esaengineering.service.PaymentService;
import com.esaengineering.service.SiteService;

// Everything for the admin pages (admin-data.js calls these).
// Only users with the admin role can use them.
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/admin")
public class ApiAdminController {

    private final AdminService adminService;
    private final AuthService authService;
    private final UserRepository userRepository;
    private final ContactService contactService;
    private final PaymentService paymentService;
    private final BookingService bookingService;
    private final SiteService siteService;

    public ApiAdminController(
            AdminService adminService,
            AuthService authService,
            UserRepository userRepository,
            ContactService contactService,
            PaymentService paymentService,
            BookingService bookingService,
            SiteService siteService) {
        this.adminService = adminService;
        this.authService = authService;
        this.userRepository = userRepository;
        this.contactService = contactService;
        this.paymentService = paymentService;
        this.bookingService = bookingService;
        this.siteService = siteService;
    }

    // checks the login token, returns the admin user or null
    private User checkAdmin(String authHeader) {
        String token = authService.readBearerToken(authHeader);
        Optional<User> user = authService.getUserByToken(token);
        if (user.isEmpty()) {
            return null;
        }
        if (user.get().getRole() != Role.ADMIN) {
            return null;
        }
        return user.get();
    }

    private Map<String, Object> errorJson(String message) {
        Map<String, Object> json = new HashMap<>();
        json.put("message", message);
        return json;
    }

    private ResponseEntity<Map<String, Object>> needAdmin() {
        return ResponseEntity.status(401).body(errorJson("Please sign in as an admin"));
    }

    /* ---------------- dashboard ---------------- */

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    /* ---------------- customers ---------------- */

    private Map<String, Object> customerJson(User user) {
        Map<String, Object> json = new HashMap<>();
        json.put("id", user.getUserId());
        json.put("name", user.getFullName());
        json.put("email", user.getEmail());
        json.put("phone", user.getPhoneNumber());
        json.put("company", user.getCompanyName());
        json.put("status", user.isActive() ? "active" : "inactive");
        json.put("lastUpdated", user.getCreatedAt() == null ? null : user.getCreatedAt().toString());
        return json;
    }

    @GetMapping("/customers")
    public ResponseEntity<Map<String, Object>> customers(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        List<Map<String, Object>> list = new ArrayList<>();
        List<User> users = userRepository.findByRole(Role.CUSTOMER);
        for (User user : users) {
            list.add(customerJson(user));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("customers", list);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/customers/{id}")
    public ResponseEntity<Map<String, Object>> oneCustomer(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<User> user = userRepository.findById(id);
        if (user.isEmpty() || user.get().getRole() != Role.CUSTOMER) {
            return ResponseEntity.status(404).body(errorJson("Customer not found"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("customer", customerJson(user.get()));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/customers/{id}")
    public ResponseEntity<Map<String, Object>> updateCustomer(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<User> found = userRepository.findById(id);
        if (found.isEmpty() || found.get().getRole() != Role.CUSTOMER) {
            return ResponseEntity.status(404).body(errorJson("Customer not found"));
        }

        User user = found.get();

        String firstName = body.get("firstName");
        String lastName = body.get("lastName");
        if (firstName != null || lastName != null) {
            String name = ((firstName == null ? "" : firstName.trim()) + " "
                    + (lastName == null ? "" : lastName.trim())).trim();
            if (!name.isBlank()) {
                user.setFullName(name);
            }
        }
        if (body.get("phone") != null) {
            user.setPhoneNumber(body.get("phone").trim());
        }
        if (body.get("companyName") != null) {
            user.setCompanyName(body.get("companyName").trim());
        }
        if (body.get("status") != null) {
            user.setActive(!body.get("status").equals("inactive"));
        }

        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("customer", customerJson(user));
        return ResponseEntity.ok(response);
    }

    /* ---------------- enquiries ---------------- */

    private Map<String, Object> enquiryJson(Contact enquiry) {
        Map<String, Object> json = new HashMap<>();
        json.put("id", enquiry.getContactId());
        json.put("name", enquiry.getFullName());
        json.put("email", enquiry.getEmail());
        json.put("subject", enquiry.getServiceName());
        json.put("message", enquiry.getDescription());
        json.put("status", enquiry.getStatus());
        json.put("reply", enquiry.getReply());
        json.put("date", enquiry.getCreatedAt() == null ? null : enquiry.getCreatedAt().toString());
        return json;
    }

    @GetMapping("/enquiries")
    public ResponseEntity<Map<String, Object>> enquiries(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        List<Map<String, Object>> list = new ArrayList<>();
        List<Contact> all = contactService.getAllContacts();
        for (Contact enquiry : all) {
            list.add(enquiryJson(enquiry));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("enquiries", list);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/enquiries/{id}")
    public ResponseEntity<Map<String, Object>> oneEnquiry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<Contact> enquiry = contactService.getContactById(id);
        if (enquiry.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Enquiry not found"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("enquiry", enquiryJson(enquiry.get()));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/enquiries/{id}")
    public ResponseEntity<Map<String, Object>> updateEnquiry(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<Contact> found = contactService.getContactById(id);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Enquiry not found"));
        }

        Contact enquiry = found.get();

        if (body.get("status") != null) {
            String status = body.get("status").trim();
            if (status.equals("new") || status.equals("in-progress") || status.equals("resolved")) {
                enquiry.setStatus(status);
            }
        }
        if (body.get("reply") != null) {
            enquiry.setReply(body.get("reply").trim());
        }

        contactService.saveContact(enquiry);

        Map<String, Object> response = new HashMap<>();
        response.put("enquiry", enquiryJson(enquiry));
        return ResponseEntity.ok(response);
    }

    /* ---------------- payments ---------------- */

    private Map<String, Object> paymentJson(Payment payment) {
        Map<String, Object> json = new HashMap<>();
        json.put("id", payment.getPaymentId());

        String invoiceId = payment.getReference();
        if (invoiceId == null || invoiceId.isBlank()) {
            invoiceId = "INV-" + payment.getPaymentId();
        }
        json.put("invoiceId", invoiceId);
        json.put("amount", payment.getAmount());

        // find the customer name from the booking
        String customerName = "";
        String email = "";
        if (payment.getBookingId() != null) {
            Optional<Booking> booking = bookingService.getBookingsById(payment.getBookingId());
            if (booking.isPresent()) {
                customerName = booking.get().getFullName();
                email = booking.get().getEmail();
            }
        }
        json.put("customerName", customerName);
        json.put("email", email);

        if (payment.getStatus() == PaymentStatus.SUCCESS) {
            json.put("status", "completed");
            json.put("paidAt", payment.getPaymentDate() == null ? null : payment.getPaymentDate().toString());
        } else {
            json.put("status", "incomplete");
            json.put("paidAt", null);
        }
        return json;
    }

    @GetMapping("/payments")
    public ResponseEntity<Map<String, Object>> payments(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        List<Map<String, Object>> list = new ArrayList<>();
        List<Payment> all = paymentService.getAllPayments();
        for (Payment payment : all) {
            list.add(paymentJson(payment));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("payments", list);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/payments/{id}")
    public ResponseEntity<Map<String, Object>> onePayment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<Payment> payment = paymentService.getPaymentById(id);
        if (payment.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Payment not found"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("payment", paymentJson(payment.get()));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/payments/{id}")
    public ResponseEntity<Map<String, Object>> updatePayment(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<Payment> found = paymentService.getPaymentById(id);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Payment not found"));
        }

        Payment payment = found.get();

        if (body.get("status") != null) {
            if (body.get("status").equals("completed")) {
                payment.setStatus(PaymentStatus.SUCCESS);
                if (payment.getPaymentDate() == null) {
                    payment.setPaymentDate(java.time.LocalDateTime.now());
                }
            } else if (body.get("status").equals("incomplete")) {
                payment.setStatus(PaymentStatus.PENDING);
            }
        }
        if (body.get("amount") != null) {
            try {
                payment.setAmount(new BigDecimal(body.get("amount").trim()));
            } catch (Exception error) {
                return ResponseEntity.badRequest().body(errorJson("Amount must be a number"));
            }
        }

        paymentService.createPayment(payment);

        Map<String, Object> response = new HashMap<>();
        response.put("payment", paymentJson(payment));
        return ResponseEntity.ok(response);
    }

    /* ---------------- pages (CMS) ---------------- */

    private Map<String, Object> pageJson(SitePage page) {
        Map<String, Object> json = new HashMap<>();
        json.put("id", page.getId());
        json.put("title", page.getTitle());
        json.put("slug", page.getSlug());
        json.put("status", page.getStatus());
        json.put("updatedAt", page.getUpdatedAt() == null ? null : page.getUpdatedAt().toString());
        return json;
    }

    @GetMapping("/pages")
    public ResponseEntity<Map<String, Object>> pages(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        List<Map<String, Object>> list = new ArrayList<>();
        List<SitePage> all = siteService.getPages();
        for (SitePage page : all) {
            list.add(pageJson(page));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("pages", list);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/pages")
    public ResponseEntity<Map<String, Object>> createPage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        try {
            SitePage page = siteService.createPage(body.get("title"), body.get("slug"));
            Map<String, Object> response = new HashMap<>();
            response.put("page", pageJson(page));
            return ResponseEntity.status(201).body(response);
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().body(errorJson(error.getMessage()));
        }
    }

    @GetMapping("/pages/{id}")
    public ResponseEntity<Map<String, Object>> onePage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<SitePage> page = siteService.getPage(id);
        if (page.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Page not found"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("page", pageJson(page.get()));
        response.put("blocks", siteService.blocksForAdmin(page.get()));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/pages/{id}")
    public ResponseEntity<Map<String, Object>> updatePage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<SitePage> found = siteService.getPage(id);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Page not found"));
        }

        SitePage page = found.get();
        if (body.get("status") != null) {
            String status = body.get("status").trim();
            if (status.equals("published") || status.equals("draft")) {
                page.setStatus(status);
            }
        }
        siteService.savePage(page);

        Map<String, Object> response = new HashMap<>();
        response.put("page", pageJson(page));
        return ResponseEntity.ok(response);
    }

    @PutMapping("/pages/{id}/blocks")
    public ResponseEntity<Map<String, Object>> saveBlocks(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @RequestBody Map<String, Map<String, String>> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<SitePage> found = siteService.getPage(id);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Page not found"));
        }

        Map<String, String> blocks = body.get("blocks");
        if (blocks == null) {
            return ResponseEntity.badRequest().body(errorJson("No blocks to save"));
        }

        siteService.saveBlocks(found.get(), blocks);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Content saved");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/pages/{id}/blocks/{key}")
    public ResponseEntity<Map<String, Object>> deleteBlock(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("id") Long id,
            @PathVariable("key") String key) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Optional<SitePage> found = siteService.getPage(id);
        if (found.isEmpty()) {
            return ResponseEntity.status(404).body(errorJson("Page not found"));
        }

        boolean deleted = siteService.deleteBlock(found.get(), key);
        if (!deleted) {
            return ResponseEntity.status(404).body(errorJson("Block not found"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Block reset to default");
        return ResponseEntity.ok(response);
    }

    /* ---------------- settings ---------------- */

    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> settings(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("settings", siteService.getSettings());
        return ResponseEntity.ok(response);
    }

    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        siteService.saveSettings(body);

        Map<String, Object> response = new HashMap<>();
        response.put("settings", siteService.getSettings());
        return ResponseEntity.ok(response);
    }

    /* ---------------- analytics ---------------- */

    @GetMapping("/analytics/activity")
    public ResponseEntity<Map<String, Object>> activity(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "days", required = false, defaultValue = "7") int days) {
        if (checkAdmin(authHeader) == null) {
            return needAdmin();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("days", days);
        response.put("series", siteService.activitySeries(days));
        return ResponseEntity.ok(response);
    }
}
