package com.esaengineering.config;

import com.esaengineering.security.TokenService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AppConfigTest {

    private static final String DEMO_SECRET = "esa-local-dev-secret-change-me-in-production-32chars";

    @Test
    void productionRefusesTheDemoSigningSecret() {
        AppConfig config = new AppConfig();
        assertThrows(IllegalStateException.class,
                () -> config.tokenService(DEMO_SECRET, 12, "prod", false, false));
    }

    @Test
    void productionAcceptsAUniqueSigningSecret() {
        AppConfig config = new AppConfig();
        TokenService tokens = config.tokenService("different-private-secret", 12, "production", false, false);
        assertNotNull(tokens.issue(1L, "admin@example.com", "ADMIN"));
    }

    @Test
    void productionRefusesDemoEmailPreview() {
        AppConfig config = new AppConfig();
        assertThrows(IllegalStateException.class,
                () -> config.tokenService("different-private-secret", 12, "prod", true, false));
    }

    @Test
    void productionRefusesDemoCardPayments() {
        AppConfig config = new AppConfig();
        assertThrows(IllegalStateException.class,
                () -> config.tokenService("different-private-secret", 12, "prod", false, true));
    }
}
