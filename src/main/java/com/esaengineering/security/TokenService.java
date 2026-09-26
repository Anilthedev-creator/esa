package com.esaengineering.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Signed session token: base64url(userId|email|role|expiresMillis).base64url(hmacSha256)
 * Sent by the UI as "Authorization: Bearer ...". Not a full JWT - no refresh
 * or revocation - just signature + expiry, which is what the admin guard needs.
 */
public class TokenService {

    private static final String ALGORITHM = "HmacSHA256";

    private final byte[] secret;
    private final long ttlMillis;

    public TokenService(String secret, long ttlHours) {
        this.secret = (secret == null || secret.isBlank()
                ? "esa-dev-secret-change-me" : secret).getBytes(StandardCharsets.UTF_8);
        this.ttlMillis = Math.max(1, ttlHours) * 3600_000L;
    }

    public String issue(Long userId, String email, String role) {
        long expiresAt = System.currentTimeMillis() + ttlMillis;
        String payload = userId + "|" + email + "|" + role + "|" + expiresAt;
        Base64.Encoder enc = Base64.getUrlEncoder().withoutPadding();
        String body = enc.encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return body + "." + enc.encodeToString(sign(body));
    }

    /** @return the verified payload, or null when missing / tampered / expired. */
    public TokenPayload verify(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String candidate = token.startsWith("Bearer ") ? token.substring(7).trim() : token.trim();
        int dot = candidate.indexOf('.');
        if (dot <= 0 || dot == candidate.length() - 1) {
            return null;
        }
        String body = candidate.substring(0, dot);
        byte[] actual;
        try {
            actual = Base64.getUrlDecoder().decode(candidate.substring(dot + 1));
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (!MessageDigest.isEqual(sign(body), actual)) {
            return null;
        }

        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(body), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
        String[] parts = payload.split("\\|");
        if (parts.length != 4) {
            return null;
        }
        try {
            if (Long.parseLong(parts[3]) < System.currentTimeMillis()) {
                return null;
            }
            Long userId = parts[0].isEmpty() || "null".equals(parts[0]) ? null : Long.parseLong(parts[0]);
            return new TokenPayload(userId, parts[1], parts[2]);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private byte[] sign(String body) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret, ALGORITHM));
            return mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Unable to sign token", e);
        }
    }

    public static class TokenPayload {
        private final Long userId;
        private final String email;
        private final String role;

        public TokenPayload(Long userId, String email, String role) {
            this.userId = userId;
            this.email = email;
            this.role = role;
        }

        public Long getUserId() {
            return userId;
        }

        public String getEmail() {
            return email;
        }

        public String getRole() {
            return role;
        }

        public boolean isAdmin() {
            return "ADMIN".equalsIgnoreCase(role);
        }
    }
}
