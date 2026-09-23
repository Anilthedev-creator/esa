package com.esaengineering.controller;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.dto.LoginRequest;
import com.esaengineering.dto.RegisterRequest;
import com.esaengineering.dto.RegisterRequestAdmin;
import com.esaengineering.model.User;
import com.esaengineering.service.AuthService;
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

 
    @PostMapping("/register")
    public String register(
            @RequestBody RegisterRequest registerRequest) {

        boolean success =
                authService.registerUser(
                        registerRequest.getFullName(),
                        registerRequest.getCompanyName(),
                        registerRequest.getEmail(),
                        registerRequest.getPassword(),
                        registerRequest.getPhone()
                );

        if (success) {
            return "Registration successful";
        }

        return "Email already exists";
    }


    
    
    @PostMapping("create/admin")
    public String registerUserAdmin(@RequestBody RegisterRequestAdmin register ){

        boolean success = authService.registerUserAdmin(
            register.getFullName(),
            register.getEmail(),
            register.getPassword(),
            register.getPhoneNumber()


        );
        if (success){
            return "Admin registration successful";
        }

        return "Email already exits";

    }
    












    @PostMapping("/login")
    public String login(
            @RequestBody LoginRequest loginRequest) {

        User user =
                authService.login(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()
                );

        if (user != null) {

            if (user.getRole().name().equals("ADMIN")) {
                return "Admin Login Successful";
            }

            return "Customer Login Successful";
        }

        return "Invalid Email or Password";
    }

    
}





