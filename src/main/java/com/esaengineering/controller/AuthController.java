package com.esaengineering.controller;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.dto.LoginRequest;
import com.esaengineering.dto.RegisterRequest;
import com.esaengineering.dto.RegisterRequestAdmin;
import com.esaengineering.model.User;
import com.esaengineering.service.AuthService;

/**
 * Legacy auth endpoints, kept so old callers keep working.
 *
 * Prefer /api/auth/signup, /api/auth/signin and /api/auth/create/admin, which
 * return JSON. The behaviour here is now identical to those: passwords are
 * hashed, never stored or compared in plain text.
 *
 * /register and /login stay public because that is what a login form needs.
 * /create/admin requires an administrator, because minting an administrator
 * must never be an anonymous action.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;
    private final AdminAccess adminAccess;

    public AuthController(AuthService authService, AdminAccess adminAccess) {
        this.authService = authService;
        this.adminAccess = adminAccess;
    }

    @PostMapping("/register")
    public String register(@RequestBody RegisterRequest registerRequest) {
        boolean success = authService.registerUser(
                registerRequest.getFullName(),
                registerRequest.getCompanyName(),
                registerRequest.getEmail(),
                registerRequest.getPassword(),
                registerRequest.getPhone());

        return success ? "Registration successful" : "Email already exists";
    }

    @PostMapping("/create/admin")
    public String registerUserAdmin(@RequestBody RegisterRequestAdmin register,
                                    @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        boolean success = authService.registerUserAdmin(
                register.getFullName(),
                register.getEmail(),
                register.getPassword(),
                register.getPhoneNumber());

        return success ? "Admin registration successful" : "Email already exits";
    }

    @PostMapping("/login")
    public String login(@RequestBody LoginRequest loginRequest) {
        User user = authService.login(
                loginRequest.getEmail(),
                loginRequest.getPassword());

        if (user == null) {
            return "Invalid Email or Password";
        }
        return user.getRole().name().equals("ADMIN") ? "Admin Login Successful" : "Customer Login Successful";
    }
}
