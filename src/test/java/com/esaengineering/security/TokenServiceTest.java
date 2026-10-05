package com.esaengineering.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TokenService signs and expires the session token. If verify() ever returns
 * non-null for a tampered token, every admin endpoint is compromised.
 */
class TokenServiceTest {

    private static final String SECRET = "unit-test-secret-value-32chars-min";

    private TokenService service() {
        return new TokenService(SECRET, 12);
    }

    @Test
    @DisplayName("a freshly issued token round-trips")
    void roundTrip() {
        TokenService svc = service();
        String token = svc.issue(7L, "admin@esaengineering.com.au", "ADMIN");

        TokenService.TokenPayload payload = svc.verify(token);
        assertNotNull(payload);
        assertEquals(7L, payload.getUserId());
        assertEquals("admin@esaengineering.com.au", payload.getEmail());
        assertEquals("ADMIN", payload.getRole());
        assertTrue(payload.isAdmin());
    }

    @Test
    @DisplayName("accepts the Bearer prefix")
    void bearerPrefix() {
        TokenService svc = service();
        String token = svc.issue(1L, "a@b.com", "CUSTOMER");
        assertNotNull(svc.verify("Bearer " + token));
    }

    @Test
    @DisplayName("rejects a tampered payload")
    void tamperedPayload() {
        TokenService svc = service();
        String token = svc.issue(1L, "a@b.com", "CUSTOMER");
        // Flip the role in the body without re-signing.
        String[] parts = token.split("\\.");
        String forged = parts[0].substring(0, 2) + "X" + parts[0].substring(3);
        assertNull(svc.verify(forged + "." + parts[1]));
    }

    @Test
    @DisplayName("rejects a token signed with a different secret")
    void wrongSecret() {
        String token = service().issue(1L, "a@b.com", "ADMIN");
        TokenService other = new TokenService("a-completely-different-secret", 12);
        assertNull(other.verify(token));
    }

    @Test
    @DisplayName("rejects null, blank and structurally broken tokens")
    void brokenTokens() {
        TokenService svc = service();
        assertNull(svc.verify(null));
        assertNull(svc.verify(""));
        assertNull(svc.verify("   "));
        assertNull(svc.verify("nodot"));
        assertNull(svc.verify("leadingdot."));
        assertNull(svc.verify(".trailingdot"));
        assertNull(svc.verify("!!!notbase64!!!.alsonotbase64"));
    }

    @Test
    @DisplayName("rejects an expired token")
    void expired() {
        TokenService svc = new TokenService(SECRET, 1);
        String token = svc.issue(1L, "a@b.com", "ADMIN");
        // Re-sign the same body with an expiry far in the past.
        long past = System.currentTimeMillis() - 60_000L;
        String body = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("1|ADMIN|" + past + "|a@b.com").getBytes());
        assertNull(svc.verify(body + "." + java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(signWith(svc, body))));
    }

    @Test
    @DisplayName("an email containing the field separator still verifies")
    void emailContainingSeparator() {
        // Regression: the payload used to be userId|email|role|expires, so a
        // quoted local part containing '|' produced 5 fields and every verify()
        // failed. Email is now the final field and split() is bounded.
        TokenService svc = service();
        String weird = "a|b@example.com";
        String token = svc.issue(3L, weird, "ADMIN");

        TokenService.TokenPayload payload = svc.verify(token);
        assertNotNull(payload, "a '|' in the email must not break verification");
        assertEquals(weird, payload.getEmail());
        assertEquals(3L, payload.getUserId());
        assertEquals("ADMIN", payload.getRole());
    }

    @Test
    @DisplayName("a CUSTOMER token is not an admin")
    void customerIsNotAdmin() {
        TokenService.TokenPayload payload = service().verify(service().issue(9L, "c@d.com", "CUSTOMER"));
        assertNotNull(payload);
        assertFalse(payload.isAdmin());
    }

    private byte[] signWith(TokenService svc, String body) {
        // Build a correctly-signed but already-expired body by reaching the
        // same HMAC the service uses. Kept in the test so the production code
        // does not need a back door.
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(
                    SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
