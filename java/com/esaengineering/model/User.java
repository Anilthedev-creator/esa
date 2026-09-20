/*Writter : Sobus das */
/* This User.java class is model class for database. User's data will be stored in the database */

package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * User entity representing application users.
 * Both customers and administrators are stored in the users table.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;

    private String fullName;

    private String companyName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role;

    private boolean passwordResetRequired;

    private boolean active;

    // phone is optional because the signup page does not ask for it
    @Column(nullable = true)
    private String phoneNumber;

    // when the account was created (used by the admin customers page)
    @Column(nullable = true)
    private LocalDateTime createdAt;

    // forgot password token, empty most of the time
    @Column(nullable = true)
    private String resetToken;

    @Column(nullable = true)
    private LocalDateTime resetTokenExpiry;

    /**
     * Required by JPA.
     */
    public User() {
    }

    public User(Long userId,
                String fullName,
                String companyName,
                String email,
                String password,
                Role role,
                boolean passwordResetRequired,
                boolean active,
                String phoneNumber) {

        this.userId = userId;
        this.fullName = fullName;
        this.companyName = companyName;
        this.email = email;
        this.password = password;
        this.role = role;
        this.passwordResetRequired = passwordResetRequired;
        this.active = active;
        this.phoneNumber = phoneNumber;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String company) {
        this.companyName = company;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public boolean isPasswordResetRequired() {
        return passwordResetRequired;
    }

    public void setPasswordResetRequired(boolean passwordResetRequired) {
        this.passwordResetRequired = passwordResetRequired;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public void setPhoneNumber(String phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getResetToken() {
        return resetToken;
    }

    public void setResetToken(String resetToken) {
        this.resetToken = resetToken;
    }

    public LocalDateTime getResetTokenExpiry() {
        return resetTokenExpiry;
    }

    public void setResetTokenExpiry(LocalDateTime resetTokenExpiry) {
        this.resetTokenExpiry = resetTokenExpiry;
    }
}
