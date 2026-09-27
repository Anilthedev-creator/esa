package com.esaengineering.api;

import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * AdminAccess is the single gate in front of every admin endpoint. The
 * regression this pins down: the previous checkAdminIfTokenPresent() returned
 * early when no Authorization header was supplied, which left the entire
 * /api/admin/** surface open to anonymous callers.
 */
class AdminAccessTest {

    private static final String SECRET = "unit-test-secret-value-32chars-min";

    private final TokenService tokenService = new TokenService(SECRET, 12);
    private final AdminAccess adminAccess = new AdminAccess(tokenService);

    private String adminToken() {
        return tokenService.issue(1L, "admin@esaengineering.com.au", "ADMIN");
    }

    private String customerToken() {
        return tokenService.issue(2L, "customer@esaengineering.com.au", "CUSTOMER");
    }

    @Test
    @DisplayName("no Authorization header at all is rejected, not waved through")
    void missingHeaderIsRejected() {
        ApiException e = assertThrows(ApiException.class, () -> adminAccess.requireAdmin(null));
        assertEquals(401, e.getStatus().value());
    }

    @Test
    @DisplayName("a blank header is rejected too")
    void blankHeaderIsRejected() {
        ApiException e = assertThrows(ApiException.class, () -> adminAccess.requireAdmin("   "));
        assertEquals(401, e.getStatus().value());
    }

    @Test
    @DisplayName("garbage in the header is rejected")
    void garbageHeaderIsRejected() {
        ApiException e = assertThrows(ApiException.class, () -> adminAccess.requireAdmin("Bearer nonsense"));
        assertEquals(401, e.getStatus().value());
    }

    @Test
    @DisplayName("a valid admin token passes")
    void adminPasses() {
        assertDoesNotThrow(() -> adminAccess.requireAdmin("Bearer " + adminToken()));
    }

    @Test
    @DisplayName("a valid customer token is forbidden, not merely rejected")
    void customerIsForbidden() {
        ApiException e = assertThrows(ApiException.class,
                () -> adminAccess.requireAdmin("Bearer " + customerToken()));
        assertEquals(403, e.getStatus().value());
    }

    @Test
    @DisplayName("an expired token is rejected")
    void expiredIsRejected() {
        TokenService shortLived = new TokenService(SECRET, 1);
        String stale = shortLived.issue(1L, "admin@esaengineering.com.au", "ADMIN");
        ApiException e = assertThrows(ApiException.class,
                () -> adminAccess.requireAdmin("Bearer " + stale));
        assertEquals(401, e.getStatus().value());
    }
}
