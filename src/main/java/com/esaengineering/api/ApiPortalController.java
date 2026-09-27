package com.esaengineering.api;

import com.esaengineering.service.ApiAuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Customer self-service portal ({@code /api/portal/**}).
 *
 * Every endpoint requires a bearer token, and every lookup is scoped to the
 * email address inside that token via {@link PortalAccess}. Nothing here takes a
 * customer identity from the request body - that is what previously made the
 * admin API open, and the same mistake on a customer endpoint would let anyone
 * read or edit anyone else's bookings.
 *
 * Deliberately separate from {@link ApiAdminController} so the two permission
 * models cannot drift: this controller never calls {@link AdminAccess}, and the
 * admin controller never reaches customer rows.
 */
@RestController
@RequestMapping("/api/portal")
public class ApiPortalController {

    private final PortalService portalService;
    private final ApiAuthService authService;
    private final PortalAccess portalAccess;

    public ApiPortalController(PortalService portalService,
                               ApiAuthService authService,
                               PortalAccess portalAccess) {
        this.portalService = portalService;
        this.authService = authService;
        this.portalAccess = portalAccess;
    }

    /** Profile of the signed-in customer. */
    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        return ok("profile", portalService.profile(email));
    }

    /** Update the editable profile fields (name, phone, company). */
    @PutMapping("/profile")
    public Map<String, Object> updateProfile(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody(required = false) Map<String, Object> body) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Map<String, Object> safe = body == null ? new LinkedHashMap<>() : body;
        return ok("profile", portalService.updateProfile(email, safe));
    }

    /** Change the customer's own password (current password required). */
    @PostMapping("/password")
    public Map<String, Object> changePassword(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody(required = false) Map<String, Object> body) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Map<String, Object> safe = body == null ? new LinkedHashMap<>() : body;
        authService.changePassword(email, str(safe.get("currentPassword")), str(safe.get("newPassword")));
        return ok("message", "Your password has been changed");
    }

    /** The customer's own bookings, newest first. */
    @GetMapping("/bookings")
    public Map<String, Object> bookings(@RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        return ok("bookings", portalService.bookings(email));
    }

    /** One of the customer's own bookings. 404 for anyone else's. */
    @GetMapping("/bookings/{bookingId}")
    public Map<String, Object> booking(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable("bookingId") Long bookingId) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        return ok("booking", portalService.booking(email, bookingId));
    }

    /** Cancel an own booking that is unpaid. */
    @PostMapping("/bookings/{bookingId}/cancel")
    public Map<String, Object> cancelBooking(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable("bookingId") Long bookingId) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Map<String, Object> booking = portalService.cancelBooking(email, bookingId);
        return ok("booking", booking, "message", "Booking cancelled");
    }

    /** The customer's own enquiries. */
    @GetMapping("/enquiries")
    public Map<String, Object> enquiries(@RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        return ok("enquiries", portalService.enquiries(email));
    }

    /** Reopen an own enquiry that was resolved. */
    @PostMapping("/enquiries/{enquiryId}/reopen")
    public Map<String, Object> reopenEnquiry(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable("enquiryId") Long enquiryId) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Map<String, Object> enquiry = portalService.reopenEnquiry(email, enquiryId);
        return ok("enquiry", enquiry, "message", "Enquiry reopened - our team will follow up");
    }

    /** The customer's own payments, resolved through their booking ids. */
    @GetMapping("/payments")
    public Map<String, Object> payments(@RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        return ok("payments", portalService.payments(email));
    }

    /** Small aggregate so the portal can render a header without three calls. */
    @GetMapping("/summary")
    public Map<String, Object> summary(@RequestHeader(value = "Authorization", required = false) String auth) {
        String email = portalAccess.requireCustomer(auth).getEmail();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("bookings", portalService.bookings(email));
        out.put("enquiries", portalService.enquiries(email));
        out.put("payments", portalService.payments(email));
        out.put("profile", portalService.profile(email));
        return out;
    }

    /** Health probe used by the portal's offline banner. */
    @GetMapping("/ping")
    public Map<String, Object> ping() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", true);
        out.put("message", "ok");
        return out;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Map<String, Object> ok(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("success", true);
        for (int i = 0; i < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }
}
