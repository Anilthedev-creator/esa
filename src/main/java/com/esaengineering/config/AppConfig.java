package com.esaengineering.config;

import com.esaengineering.security.TokenService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires app.auth.* into the token bean. */
@Configuration
public class AppConfig {

    private static final String DEMO_SECRET = "esa-local-dev-secret-change-me-in-production-32chars";

    @Bean
    public TokenService tokenService(
            @Value("${app.auth.token-secret:}") String secret,
            @Value("${app.auth.token-ttl-hours:12}") long ttlHours,
            @Value("${spring.profiles.active:}") String profiles,
            @Value("${app.demo-email-preview:false}") boolean demoEmailPreview) {
        String nodeEnv = System.getenv("NODE_ENV");
        boolean production = "production".equalsIgnoreCase(nodeEnv)
                || "prod".equalsIgnoreCase(nodeEnv)
                || hasProductionProfile(profiles);
        if (production && (secret == null || secret.isBlank() || DEMO_SECRET.equals(secret))) {
            throw new IllegalStateException("Set a unique JWT_SECRET before running ESA in production.");
        }
        if (production && demoEmailPreview) {
            throw new IllegalStateException("Demo email previews must not be enabled in production.");
        }
        return new TokenService(secret, ttlHours);
    }

    private static boolean hasProductionProfile(String profiles) {
        if (profiles == null) return false;
        for (String profile : profiles.split(",")) {
            if ("prod".equalsIgnoreCase(profile.trim()) || "production".equalsIgnoreCase(profile.trim())) {
                return true;
            }
        }
        return false;
    }
}
