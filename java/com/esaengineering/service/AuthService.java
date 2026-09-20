package com.esaengineering.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.esaengineering.model.Role;
import com.esaengineering.model.User;
import com.esaengineering.repository.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;

    // login tokens, token -> userId. This map is cleared
    // when the server restarts so everyone has to log in again.
    private final Map<String, Long> sessions = new ConcurrentHashMap<>();

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Register a new customer account.
     */
    public boolean registerUser(
            String fullName,
            String companyName,
            String email,
            String password,
            String phoneNumber) {

        Optional<User> existingUser =
                userRepository.findByEmail(email);

        if (existingUser.isPresent()) {
            return false;
        }

        User user = new User();

        user.setFullName(fullName);
        user.setCompanyName(companyName);
        user.setEmail(email);
        // never store the real password, only the hash
        user.setPassword(hashPassword(email, password));
        user.setPhoneNumber(phoneNumber);

        user.setRole(Role.CUSTOMER);

        user.setPasswordResetRequired(false);
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());

        userRepository.save(user);

        return true;
    }

    public boolean registerUserAdmin(
        String fullName,
        String email,
        String password,
        String phoneNumber) {

        Optional<User> existingUser = userRepository.findByEmail(email);

        if (existingUser.isPresent()) {
            return false;
        }

        User user = new User();

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPassword(hashPassword(email, password));
        user.setPhoneNumber(phoneNumber);
        user.setCompanyName("ESA");
        user.setRole(Role.ADMIN);
        user.setPasswordResetRequired(true);
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());

        userRepository.save(user);

        return true;
    }

    /**
     * Login validation, returns the user if email and password match.
     */
    public User login(
            String email,
            String password) {

        if (email == null || password == null) {
            return null;
        }

        Optional<User> userOptional =
                userRepository.findByEmail(email.trim());

        if (userOptional.isEmpty()) {
            return null;
        }

        User user = userOptional.get();

        if (!user.isActive()) {
            return null;
        }

        // normal check against the stored hash
        if (user.getPassword() != null
                && user.getPassword().equals(hashPassword(user.getEmail(), password))) {
            return user;
        }

        // some very old accounts still have plain text passwords,
        // let them in once and then save the hash instead
        if (user.getPassword() != null && user.getPassword().equals(password)) {
            user.setPassword(hashPassword(user.getEmail(), password));
            userRepository.save(user);
            return user;
        }

        return null;
    }

    /**
     * Change password without checking the old one
     * (used after a password reset link).
     */
    public boolean changePassword(
            String email,
            String newPassword) {

        Optional<User> userOptional =
                userRepository.findByEmail(email);

        if (userOptional.isEmpty()) {
            return false;
        }

        User user = userOptional.get();

        user.setPassword(hashPassword(user.getEmail(), newPassword));
        user.setPasswordResetRequired(false);

        userRepository.save(user);

        return true;
    }

    /**
     * Change password when the user knows the current one
     * (used on the settings page).
     */
    public boolean changePassword(
            String email,
            String currentPassword,
            String newPassword) {

        User user = login(email, currentPassword);

        if (user == null) {
            return false;
        }

        user.setPassword(hashPassword(user.getEmail(), newPassword));
        user.setPasswordResetRequired(false);

        userRepository.save(user);

        return true;
    }

    // Makes a random login token for a user and remembers it
    public String createSession(User user) {
        String token = UUID.randomUUID().toString() + UUID.randomUUID().toString();
        token = token.replace("-", "");
        sessions.put(token, user.getUserId());
        return token;
    }

    // Finds the logged in user from the token, empty if the token is wrong
    public Optional<User> getUserByToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        Long userId = sessions.get(token.trim());
        if (userId == null) {
            return Optional.empty();
        }
        return userRepository.findById(userId);
    }

    // Reads the "Bearer xxxxx" header value from a request
    public String readBearerToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring(7).trim();
    }

    public void removeSession(String token) {
        if (token != null) {
            sessions.remove(token.trim());
        }
    }

    // Makes a forgot-password token for this email, valid for 1 hour.
    // Returns null when nobody has this email address.
    public String createResetToken(String email) {
        Optional<User> userOptional = userRepository.findByEmail(email.trim());

        if (userOptional.isEmpty()) {
            return null;
        }

        User user = userOptional.get();
        String token = UUID.randomUUID().toString().replace("-", "");

        user.setResetToken(token);
        user.setResetTokenExpiry(LocalDateTime.now().plusHours(1));
        userRepository.save(user);

        return token;
    }

    // Sets a new password using a forgot-password token
    public boolean resetPasswordWithToken(String token, String newPassword) {
        if (token == null || token.isBlank()) {
            return false;
        }

        Optional<User> userOptional = userRepository.findByResetToken(token.trim());

        if (userOptional.isEmpty()) {
            return false;
        }

        User user = userOptional.get();

        // token expired or already used
        if (user.getResetTokenExpiry() == null
                || user.getResetTokenExpiry().isBefore(LocalDateTime.now())) {
            return false;
        }

        user.setPassword(hashPassword(user.getEmail(), newPassword));
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        user.setPasswordResetRequired(false);
        userRepository.save(user);

        return true;
    }

    // Checks the password rule from the signup page.
    // Returns null when the password is fine, otherwise the error message.
    public String checkPasswordRule(String password) {
        if (password == null || password.length() < 8) {
            return "Password must be at least 8 characters";
        }

        boolean hasUpper = false;
        boolean hasLower = false;
        boolean hasNumber = false;

        for (int i = 0; i < password.length(); i++) {
            char letter = password.charAt(i);
            if (letter >= 'A' && letter <= 'Z') {
                hasUpper = true;
            } else if (letter >= 'a' && letter <= 'z') {
                hasLower = true;
            } else if (letter >= '0' && letter <= '9') {
                hasNumber = true;
            }
        }

        if (!hasUpper || !hasLower || !hasNumber) {
            return "Password must contain: uppercase, lowercase, number, and be 8+ characters";
        }

        return null;
    }

    // SHA-256 hash of the password mixed with the email address,
    // so the same password looks different for every user.
    public String hashPassword(String email, String password) {
        try {
            String salted = email.trim().toLowerCase() + "|" + password;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(salted.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                String part = Integer.toHexString(b & 0xff);
                if (part.length() == 1) {
                    hex.append("0");
                }
                hex.append(part);
            }
            return hex.toString();
        } catch (Exception error) {
            throw new RuntimeException("Could not hash password", error);
        }
    }
}
