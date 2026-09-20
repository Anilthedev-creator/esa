package com.esaengineering.controller;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.model.Role;
import com.esaengineering.model.User;
import com.esaengineering.service.AuthService;

// Login and signup for the website pages (auth.js calls these).
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/auth")
public class ApiAuthController {

    private final AuthService authService;

    public ApiAuthController(AuthService authService) {
        this.authService = authService;
    }

    // turns a user row into the json the frontend wants
    private Map<String, Object> userJson(User user) {
        Map<String, Object> json = new HashMap<>();
        json.put("id", user.getUserId());
        json.put("name", user.getFullName());
        json.put("email", user.getEmail());
        json.put("companyName", user.getCompanyName());
        json.put("phone", user.getPhoneNumber());

        // "John Citizen" -> firstName "John", lastName "Citizen"
        String firstName = "";
        String lastName = "";
        if (user.getFullName() != null) {
            String[] parts = user.getFullName().trim().split("\\s+", 2);
            firstName = parts[0];
            if (parts.length > 1) {
                lastName = parts[1];
            }
        }
        json.put("firstName", firstName);
        json.put("lastName", lastName);

        // frontend checks for lowercase "admin" / "customer"
        if (user.getRole() == Role.ADMIN) {
            json.put("role", "admin");
        } else {
            json.put("role", "customer");
        }
        return json;
    }

    private Map<String, Object> errorJson(String message) {
        Map<String, Object> json = new HashMap<>();
        json.put("message", message);
        return json;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody Map<String, String> body) {
        String firstName = body.get("firstName");
        String lastName = body.get("lastName");
        String companyName = body.get("companyName");
        String email = body.get("email");
        String password = body.get("password");

        if (firstName == null || firstName.isBlank()
                || lastName == null || lastName.isBlank()
                || companyName == null || companyName.isBlank()
                || email == null || email.isBlank()
                || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("All fields are required"));
        }

        String passwordError = authService.checkPasswordRule(password);
        if (passwordError != null) {
            return ResponseEntity.badRequest().body(errorJson(passwordError));
        }

        String fullName = firstName.trim() + " " + lastName.trim();
        boolean success = authService.registerUser(
                fullName, companyName.trim(), email.trim(), password, null);

        if (!success) {
            return ResponseEntity.status(409).body(errorJson("An account with this email already exists"));
        }

        User user = authService.login(email.trim(), password);
        String token = authService.createSession(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("token", token);
        response.put("user", userJson(user));

        return ResponseEntity.status(201).body(response);
    }

    @PostMapping("/signin")
    public ResponseEntity<Map<String, Object>> signin(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Email and password are required"));
        }

        User user = authService.login(email.trim(), password);

        if (user == null) {
            return ResponseEntity.status(401).body(errorJson("Invalid email or password"));
        }

        String token = authService.createSession(user);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("token", token);
        response.put("user", userJson(user));

        return ResponseEntity.ok(response);
    }

    // checks the login token and returns the current user
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        String token = authService.readBearerToken(authHeader);
        Optional<User> user = authService.getUserByToken(token);

        if (user.isEmpty()) {
            return ResponseEntity.status(401).body(errorJson("Session expired, please sign in again"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("user", userJson(user.get()));

        return ResponseEntity.ok(response);
    }

    // forgot password page, always says the email was sent
    // so nobody can find out which emails have accounts
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");

        Map<String, Object> response = new HashMap<>();
        response.put("message", "If an account exists for that email, a password reset link has been sent.");

        if (email != null && !email.isBlank()) {
            String token = authService.createResetToken(email.trim());
            if (token != null) {
                // dev mode: there is no email server in this project,
                // so the reset link is sent back and shown on the page
                response.put("devResetLink", "reset-password.html?token=" + token);
            }
        }

        return ResponseEntity.ok(response);
    }

    // sets the new password using the token from the reset link
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String password = body.get("password");

        if (token == null || token.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("A reset token and new password are required"));
        }

        String passwordError = authService.checkPasswordRule(password);
        if (passwordError != null) {
            return ResponseEntity.badRequest().body(errorJson(passwordError));
        }

        boolean success = authService.resetPasswordWithToken(token.trim(), password);

        if (!success) {
            return ResponseEntity.badRequest()
                    .body(errorJson("This reset link is invalid or expired, please request a new one"));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Password updated");

        return ResponseEntity.ok(response);
    }
}
