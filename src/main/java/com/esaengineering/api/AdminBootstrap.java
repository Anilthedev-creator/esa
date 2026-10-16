package com.esaengineering.api;

import com.esaengineering.model.User;
import com.esaengineering.security.PasswordHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Creates the first administrator so the portal can actually be signed into.
 *
 * The local project demo still gets an easy account. Production must bring its
 * own credentials through ADMIN_EMAIL and ADMIN_PASSWORD.
 */
@Component
@Order(1)
public class AdminBootstrap implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);
    private static final String DEMO_EMAIL = "admin@esaengineering.com.au";
    private static final String DEMO_PASSWORD = "Admin123";

    private final ApiAuthService authService;
    private final AdminDataService adminService;
    private final boolean enabled;
    private final boolean production;
    private final String email;
    private final String password;
    private final String fullName;

    public AdminBootstrap(ApiAuthService authService,
                          AdminDataService adminService,
                          @Value("${app.admin.enabled:true}") boolean enabled,
                          @Value("${app.admin.email:}") String configuredEmail,
                          @Value("${app.admin.password:}") String configuredPassword,
                          @Value("${app.admin.name:ESA Administrator}") String fullName,
                          @Value("${ADMIN_EMAIL:}") String environmentEmail,
                          @Value("${ADMIN_PASSWORD:}") String environmentPassword,
                          @Value("${spring.profiles.active:}") String profiles) {
        this.authService = authService;
        this.adminService = adminService;
        this.enabled = enabled;
        String nodeEnv = System.getenv("NODE_ENV");
        this.production = "production".equalsIgnoreCase(nodeEnv)
                || "prod".equalsIgnoreCase(nodeEnv)
                || hasProductionProfile(profiles);
        this.email = production ? environmentEmail : configuredEmail;
        this.password = production ? environmentPassword : configuredPassword;
        this.fullName = fullName;
    }

    @Override
    public void run(String... args) {
        rejectSampleAccountInProduction();
        if (!enabled) return;

        if (adminService.hasAdministrator()) return;

        if (production && (email == null || email.isBlank() || password == null || password.isBlank())) {
            throw new IllegalStateException("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first production admin.");
        }
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new IllegalStateException("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin.");
        }
        if (production && DEMO_EMAIL.equalsIgnoreCase(email.trim()) && DEMO_PASSWORD.equals(password)) {
            throw new IllegalStateException("The sample admin credentials are not allowed in production.");
        }

        authService.createAdmin(fullName, email, password, "");
        log.info("");
        log.info("=== ESA admin portal ready ===");
        log.info("    sign in : http://localhost:8080/signin.html");
        log.info("    email   : {}", email);
        if (!production) log.info("    password: {}  (local demo only)", password);
        log.info("");
    }

    private void rejectSampleAccountInProduction() {
        if (!production) return;
        User sample = authService.findByEmail(DEMO_EMAIL).orElse(null);
        if (sample != null && PasswordHasher.matches(DEMO_PASSWORD, sample.getPassword(), true)) {
            throw new IllegalStateException("The sample admin account is in the production database. Replace it before starting.");
        }
    }

    private static boolean hasProductionProfile(String profiles) {
        if (profiles == null) return false;
        for (String profile : profiles.split(",")) {
            if ("prod".equalsIgnoreCase(profile.trim()) || "production".equalsIgnoreCase(profile.trim())) return true;
        }
        return false;
    }
}
