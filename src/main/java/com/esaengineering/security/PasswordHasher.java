package com.esaengineering.security;

import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * PBKDF2-HMAC-SHA256, 120k iterations, 16 byte salt, stored as
 * pbkdf2$<iterations>$<saltB64>$<hashB64>. No new dependency.
 *
 * Rows written before this existed hold plain text. Those are still accepted
 * on login and re-hashed immediately (needsUpgrade), so nobody is locked out.
 */
public final class PasswordHasher {

    private static final String PREFIX = "pbkdf2";
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 120_000;
    private static final int KEY_LENGTH = 256;
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordHasher() {
    }

    public static String hash(String raw) {
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        byte[] hash = pbkdf2(raw, salt, ITERATIONS);
        Base64.Encoder enc = Base64.getEncoder();
        return PREFIX + "$" + ITERATIONS + "$"
                + enc.encodeToString(salt) + "$" + enc.encodeToString(hash);
    }

    public static boolean matches(String raw, String stored, boolean legacyPlainTextAllowed) {
        if (raw == null || stored == null || stored.isBlank()) {
            return false;
        }
        if (!isHashed(stored)) {
            return legacyPlainTextAllowed && raw.equals(stored);
        }
        String[] parts = stored.split("\\$");
        if (parts.length != 4) {
            return false;
        }
        try {
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            return constantTimeEquals(expected, pbkdf2(raw, salt, iterations));
        } catch (RuntimeException e) {
            return false;
        }
    }

    public static boolean needsUpgrade(String stored) {
        return stored != null && !isHashed(stored);
    }

    public static boolean isHashed(String stored) {
        return stored != null && stored.startsWith(PREFIX + "$");
    }

    public static String randomToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] pbkdf2(String raw, byte[] salt, int iterations) {
        try {
            KeySpec spec = new PBEKeySpec(raw.toCharArray(), salt, iterations, KEY_LENGTH);
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("Unable to hash password", e);
        }
    }

    private static boolean constantTimeEquals(byte[] a, byte[] b) {
        if (a.length != b.length) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < a.length; i++) {
            diff |= a[i] ^ b[i];
        }
        return diff == 0;
    }
}
