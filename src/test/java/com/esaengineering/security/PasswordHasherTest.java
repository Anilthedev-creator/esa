package com.esaengineering.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * PasswordHasher is the only thing standing between the users table and a
 * plaintext-password breach, so it gets the most coverage.
 */
class PasswordHasherTest {

    @Nested
    @DisplayName("hashing")
    class Hashing {

        @Test
        void producesThePrefixedFormat() {
            String hashed = PasswordHasher.hash("Admin123");
            assertTrue(hashed.startsWith("pbkdf2$"), "should be prefixed, was: " + hashed);
            assertEquals(4, hashed.split("\\$").length, "pbkdf2$iterations$salt$hash");
        }

        @Test
        void isNotDeterministicBecauseTheSaltIsRandom() {
            String a = PasswordHasher.hash("Admin123");
            String b = PasswordHasher.hash("Admin123");
            assertNotEquals(a, b, "same password must not produce the same hash");
        }

        @Test
        void neverStoresThePlainText() {
            String hashed = PasswordHasher.hash("Admin123");
            assertFalse(hashed.contains("Admin123"), "plain text must not appear in the hash");
        }
    }

    @Nested
    @DisplayName("verification")
    class Verification {

        @Test
        void acceptsTheCorrectPassword() {
            String hashed = PasswordHasher.hash("Admin123");
            assertTrue(PasswordHasher.matches("Admin123", hashed, false));
        }

        @Test
        void rejectsTheWrongPassword() {
            String hashed = PasswordHasher.hash("Admin123");
            assertFalse(PasswordHasher.matches("Admin124", hashed, false));
        }

        @Test
        void rejectsNullAndBlankInput() {
            String hashed = PasswordHasher.hash("Admin123");
            assertFalse(PasswordHasher.matches(null, hashed, true));
            assertFalse(PasswordHasher.matches("Admin123", null, true));
            assertFalse(PasswordHasher.matches("Admin123", "   ", true));
        }

        @Test
        void rejectsAMalformedStoredValue() {
            assertFalse(PasswordHasher.matches("Admin123", "pbkdf2$notanumber$xx$yy", false));
            assertFalse(PasswordHasher.matches("Admin123", "pbkdf2$120000$onlyonepart", false));
        }
    }

    @Nested
    @DisplayName("legacy plain-text rows")
    class Legacy {

        @Test
        void plainTextIsAcceptedOnlyWhenExplicitlyAllowed() {
            assertTrue(PasswordHasher.matches("Admin123", "Admin123", true));
            assertFalse(PasswordHasher.matches("Admin123", "Admin123", false));
        }

        @Test
        void plainTextRowsAreFlaggedForUpgrade() {
            assertTrue(PasswordHasher.needsUpgrade("Admin123"));
            assertFalse(PasswordHasher.needsUpgrade(PasswordHasher.hash("Admin123")));
        }

        @Test
        void isHashedDistinguishesTheTwoFormats() {
            assertFalse(PasswordHasher.isHashed("Admin123"));
            assertTrue(PasswordHasher.isHashed(PasswordHasher.hash("Admin123")));
        }
    }

    @Test
    void randomTokenIsUrlSafeAndReasonablyLong() {
        String token = PasswordHasher.randomToken();
        assertEquals(32, token.length(), "24 bytes base64url without padding");
        assertTrue(token.matches("[A-Za-z0-9_-]+"), "must be url-safe, was: " + token);
    }
}
