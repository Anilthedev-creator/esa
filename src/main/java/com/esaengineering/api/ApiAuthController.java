package com.esaengineering.api;

import java.util.LinkedHashMap;
import java.util.Map;

import com.esaengineering.model.User;
import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session API used by static/auth.js and the admin-data.js guard:
 *   POST /api/auth/signup     POST /api/auth/signin
 *   GET  /api/auth/me         POST /api/auth/logout
 *   POST /api/auth/create/admin
 * JSON in and out, so the forms can show the real reason for a failure.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class ApiAuthController {

    private final ApiAuthService authService;
    private final TokenService tokenService;
    private final AdminAccess adminAccess;

    public ApiAuthController(ApiAuthService authService, TokenService tokenService, AdminAccess adminAccess) {
        this.authService = authService;
        this.tokenService = tokenService;
        this.adminAccess = adminAccess;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> signup(@RequestBody Map<String, Object> body) {
        String first = text(body, "firstName");
        String last = text(body, "lastName");
        String fullName = text(body, "fullName");
        if (fullName == null) {
            fullName = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        }

        User user = authService.register(fullName, text(body, "companyName"),
                text(body, "email"), text(body, "password"),
                text(body, "phone") != null ? text(body, "phone") : text(body, "phoneNumber"));

        return session("Account created successfully", user);
    }

    @PostMapping("/signin")
    public Map<String, Object> signin(@RequestBody Map<String, Object> body) {
        User user = authService.authenticate(text(body, "email"), text(body, "password"));
        String message = "ADMIN".equalsIgnoreCase(String.valueOf(user.getRole()))
                ? "Admin Login Successful"
                : "Customer Login Successful";
        return session(message, user);
    }

    // forgot password: step 1, hand out a reset link
    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody Map<String, Object> body) {
        String email = text(body, "email");
        if (email == null) throw ApiException.badRequest("Please put in your email address.");
        String token = authService.startPasswordReset(email);
        if (token != null) {
            // no mail server wired up yet (TODO) so same trick as server.js:
            // the "email" is written to data/outbox as a txt file
            writeOutbox(email, "Reset your ESA portal password",
                    "Someone asked to reset your ESA portal password.\n"
                    + "Open reset-password.html?token=" + token + " to pick a new one.\n"
                    + "The link works for 1 hour. If it was not you, ignore this email.");
        }
        // same answer either way so the form cant be used to probe for accounts
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "If that email is in our system a reset link is on its way.");
        resp.put("success", true);
        return resp;
    }

    // forgot password: step 2, the reset page posts token + new password
    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@RequestBody Map<String, Object> body) {
        authService.finishPasswordReset(text(body, "token"), text(body, "password"));
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("message", "Password updated, you can sign in with it now.");
        resp.put("success", true);
        return resp;
    }

    // super basic mail stand-in, mirrors sendMail() in server.js
    private void writeOutbox(String to, String subject, String bodyText) {
        try {
            java.nio.file.Path dir = java.nio.file.Paths.get("data", "outbox");
            java.nio.file.Files.createDirectories(dir);
            String fname = System.currentTimeMillis() + "-" + to.replaceAll("[^a-z0-9]", "_") + ".txt";
            String txt = "To: " + to + "\nSubject: " + subject + "\n\n" + bodyText + "\n";
            java.nio.file.Files.write(dir.resolve(fname), txt.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            System.out.println("[mail] outbox write failed: " + e.getMessage());
        }
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        TokenService.TokenPayload payload = tokenService.verify(authorization);
        if (payload == null) {
            throw ApiException.unauthorized("Your session has expired, please sign in again");
        }
        User user = authService.findByEmail(payload.getEmail())
                .orElseThrow(() -> ApiException.unauthorized("Your session has expired, please sign in again"));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", authService.toAuthUser(user));
        return response;
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        // Token is stateless; the client drops it. Kept so the UI has one
        // place to call once revocation exists.
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Signed out");
        response.put("success", true);
        return response;
    }

    /**
     * Creating an administrator is itself an admin-only action. Without this
     * check a single unauthenticated POST handed out full admin rights.
     */
    @PostMapping("/create/admin")
    public Map<String, Object> createAdmin(@RequestBody Map<String, Object> body,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        String phone = text(body, "phoneNumber") != null ? text(body, "phoneNumber") : text(body, "phone");
        authService.createAdmin(text(body, "fullName"), text(body, "email"),
                text(body, "password"), phone);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Administrator account created");
        response.put("success", true);
        return response;
    }

    private Map<String, Object> session(String message, User user) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", message);
        response.put("success", true);
        response.put("token", tokenService.issue(user.getUserId(), user.getEmail(), user.getRole().name()));
        response.put("user", authService.toAuthUser(user));
        return response;
    }

    private static String text(Map<String, Object> body, String key) {
        if (body == null) {
            return null;
        }
        Object value = body.get(key);
        if (value == null) {
            return null;
        }
        String s = String.valueOf(value).trim();
        return s.isEmpty() ? null : s;
    }
}
