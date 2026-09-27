package com.esaengineering.api;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

import com.esaengineering.model.Role;
import com.esaengineering.model.User;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.security.PasswordHasher;
import com.esaengineering.web.ApiException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Accounts for the portal: register, sign in, admin creation.
 * Uses the existing users table as-is (no new columns), hashes passwords,
 * and upgrades legacy plain-text rows on first successful login.
 */
@Service
public class ApiAuthService {

    private static final Logger log = LoggerFactory.getLogger(ApiAuthService.class);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    /** Same rule signup.html enforces: 8+, upper, lower, digit. */
    private static final Pattern PASSWORD = Pattern.compile("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$");

    private final UserRepository userRepository;

    public ApiAuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User register(String fullName, String companyName, String email, String password, String phone) {
        User user = new User();
        user.setFullName(require(fullName, "Full name is required"));
        user.setCompanyName(orEmpty(companyName));
        user.setEmail(normaliseEmail(email));
        // signup.html has no phone field and phone_number is NOT NULL in the schema.
        user.setPhoneNumber(orEmpty(phone));
        user.setRole(Role.CUSTOMER);
        user.setPasswordResetRequired(false);
        user.setActive(true);
        user.setPassword(PasswordHasher.hash(requirePassword(password)));
        return saveUnique(user);
    }

    @Transactional
    public User createAdmin(String fullName, String email, String password, String phone) {
        User user = new User();
        user.setFullName(require(fullName, "Full name is required"));
        user.setCompanyName("ESA");
        user.setEmail(normaliseEmail(email));
        user.setPhoneNumber(orEmpty(phone));
        user.setRole(Role.ADMIN);
        user.setPasswordResetRequired(false);
        user.setActive(true);
        user.setPassword(PasswordHasher.hash(requirePassword(password)));
        return saveUnique(user);
    }

    @Transactional
    public User authenticate(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isEmpty()) {
            throw ApiException.unauthorized("Email and password are required");
        }
        Optional<User> found = userRepository.findByEmail(email.trim().toLowerCase());
        if (found.isEmpty()) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        User user = found.get();
        String stored = user.getPassword();
        if (!PasswordHasher.matches(password, stored, true)) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        if (PasswordHasher.needsUpgrade(stored)) {
            user.setPassword(PasswordHasher.hash(password));
            userRepository.save(user);
            log.info("Upgraded legacy plain-text password for {}", user.getEmail());
        }
        return user;
    }

    public Optional<User> findByEmail(String email) {
        return email == null ? Optional.empty() : userRepository.findByEmail(email.trim().toLowerCase());
    }

    /**
     * Changes the password for an already-authenticated customer.
     *
     * The caller's email comes from the verified token, never from the request
     * body, so a customer can only ever change their own password. The current
     * password must verify first - otherwise a stolen session token would be
     * enough to lock the real owner out. Legacy plaintext rows are accepted here
     * so those accounts can still be migrated, exactly as in {@link #authenticate}.
     */
    @Transactional
    public void changePassword(String email, String currentPassword, String newPassword) {
        User user = findByEmail(email)
                .orElseThrow(() -> ApiException.unauthorized("Your session has expired - please sign in again"));
        if (currentPassword == null || !PasswordHasher.matches(currentPassword, user.getPassword(), true)) {
            throw ApiException.badRequest("Your current password is incorrect");
        }
        user.setPassword(PasswordHasher.hash(requirePassword(newPassword)));
        userRepository.save(user);
    }

    /**
     * Shape static/auth.js keeps in localStorage and static/admin-data.js reads
     * for its guard. role is lower-cased on purpose: the guard tests
     * user.role !== 'admin'.
     */
    public Map<String, Object> toAuthUser(User user) {
        String fullName = user.getFullName() == null ? "" : user.getFullName();
        String firstName = fullName.isEmpty() ? user.getEmail() : fullName.split(" ")[0];
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", user.getUserId());
        map.put("name", fullName);
        map.put("firstName", firstName);
        map.put("lastName", fullName.contains(" ") ? fullName.substring(fullName.indexOf(' ') + 1) : "");
        map.put("email", user.getEmail());
        map.put("phone", user.getPhoneNumber());
        map.put("company", user.getCompanyName());
        map.put("companyName", user.getCompanyName());
        map.put("role", user.getRole() == null ? "customer" : user.getRole().name().toLowerCase());
        return map;
    }

    private User saveUnique(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw ApiException.conflict("That email already has an account. Try signing in instead.");
        }
        try {
            return userRepository.save(user);
        } catch (DataIntegrityViolationException e) {
            throw ApiException.conflict("That email already has an account. Try signing in instead.");
        }
    }

    private static String normaliseEmail(String email) {
        String value = email == null ? "" : email.trim().toLowerCase();
        if (!EMAIL.matcher(value).matches()) {
            throw ApiException.badRequest("Enter a valid email address");
        }
        return value;
    }

    private static String requirePassword(String password) {
        if (password == null || !PASSWORD.matcher(password).matches()) {
            throw ApiException.badRequest("Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number");
        }
        return password;
    }

    private static String require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw ApiException.badRequest(message);
        }
        return value.trim();
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value.trim();
    }
}
