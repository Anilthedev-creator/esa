package com.esaengineering.config;

import com.esaengineering.security.TokenService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Wires app.auth.* into the token bean. */
@Configuration
public class AppConfig {

    @Bean
    public TokenService tokenService(
            @Value("${app.auth.token-secret:}") String secret,
            @Value("${app.auth.token-ttl-hours:12}") long ttlHours) {
        return new TokenService(secret, ttlHours);
    }
}
