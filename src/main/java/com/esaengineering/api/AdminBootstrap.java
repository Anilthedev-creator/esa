package com.esaengineering.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Creates the first administrator so the portal can actually be signed into.
 *
 * Runs at startup and does nothing once an ADMIN row exists, so your own
 * accounts are never touched and the default password cannot be re-created
 * after you change it. Override in application.properties (or env vars).
 */
@Component
public class AdminBootstrap implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final ApiAuthService authService;
    private final AdminDataService adminService;
    private final boolean enabled;
    private final String email;
    private final String password;
    private final String fullName;

    public AdminBootstrap(ApiAuthService authService,
                          AdminDataService adminService,
                          @Value("${app.admin.enabled:true}") boolean enabled,
                          @Value("${app.admin.email:admin@esaengineering.com.au}") String email,
                          @Value("${app.admin.password:Admin123}") String password,
                          @Value("${app.admin.name:ESA Administrator}") String fullName) {
        this.authService = authService;
        this.adminService = adminService;
        this.enabled = enabled;
        this.email = email;
        this.password = password;
        this.fullName = fullName;
    }

    @Override
    public void run(String... args) {
        if (!enabled) {
            return;
        }
        if (adminService.hasAdministrator()) {
            return;
        }
        try {
            authService.createAdmin(fullName, email, password, "");
            log.info("");
            log.info("=== ESA admin portal ready ===");
            log.info("    sign in : http://localhost:8080/signin.html");
            log.info("    email   : {}", email);
            log.info("    password: {}  (first-run default - change it after signing in)", password);
            log.info("    override with app.admin.email / app.admin.password in application.properties");
            log.info("");
        } catch (RuntimeException e) {
            log.warn("Could not create the default administrator: {}", e.getMessage());
        }
    }
}
