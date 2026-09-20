package com.esaengineering.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.dto.ChangePassword;
import com.esaengineering.dto.LoginRequest;
import com.esaengineering.dto.RegisterRequest;
import com.esaengineering.dto.RegisterRequestAdmin;
import com.esaengineering.model.User;
import com.esaengineering.service.AuthService;
import jakarta.validation.Valid;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<String> register(
            @Valid @RequestBody RegisterRequest registerRequest) {

        String passwordError = authService.checkPasswordRule(registerRequest.getPassword());
        if (passwordError != null) {
            return ResponseEntity.badRequest().body(passwordError);
        }

        boolean success =
                authService.registerUser(
                        registerRequest.getFullName(),
                        registerRequest.getCompanyName(),
                        registerRequest.getEmail(),
                        registerRequest.getPassword(),
                        registerRequest.getPhoneNumber()
                );

        if (success) {
            return ResponseEntity.ok("Registration successful");
        }

        return ResponseEntity.status(409).body("Email already exists");
    }

    @PostMapping("/create/admin")
    public ResponseEntity<String> registerUserAdmin(@Valid @RequestBody RegisterRequestAdmin register) {

        if (register.getPassword() == null || register.getPassword().length() < 8) {
            return ResponseEntity.badRequest().body("Password must be at least 8 characters");
        }

        boolean success = authService.registerUserAdmin(
            register.getFullName(),
            register.getEmail(),
            register.getPassword(),
            register.getPhoneNumber()
        );

        if (success) {
            return ResponseEntity.ok("Admin registration successful");
        }

        return ResponseEntity.status(409).body("Email already exists");
    }

    @PostMapping("/login")
    public ResponseEntity<String> login(
            @RequestBody LoginRequest loginRequest) {

        User user =
                authService.login(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()
                );

        if (user != null) {

            if (user.getRole() != null && user.getRole().name().equals("ADMIN")) {
                return ResponseEntity.ok("Admin Login Successful");
            }

            return ResponseEntity.ok("Customer Login Successful");
        }

        return ResponseEntity.status(401).body("Invalid Email or Password");
    }

    // change password when the user knows the current one
    @PutMapping("/change-password")
    public ResponseEntity<String> changePassword(@RequestBody ChangePassword changePassword) {

        String passwordError = authService.checkPasswordRule(changePassword.getNewPassword());
        if (passwordError != null) {
            return ResponseEntity.badRequest().body(passwordError);
        }

        boolean success = authService.changePassword(
                changePassword.getEmail(),
                changePassword.getCurrentPassword(),
                changePassword.getNewPassword()
        );

        if (success) {
            return ResponseEntity.ok("Password changed successfully");
        }

        return ResponseEntity.status(401).body("Current password is wrong");
    }
}
