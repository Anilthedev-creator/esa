package com.esaengineering.api;

import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;

import org.springframework.stereotype.Component;

/**
 * The one place that answers "is this caller an administrator?".
 *
 * Every {@code /api/admin/**} endpoint and every write endpoint in the legacy
 * controllers goes through {@link #requireAdmin(String)}. A missing, malformed,
 * expired or non-admin token is rejected.
 *
 * There is deliberately NO "no token sent = allow" path. That is what previously
 * left the entire admin API open to anyone who simply omitted the header.
 */
@Component
public class AdminAccess {

    private final TokenService tokenService;

    public AdminAccess(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    /**
     * @throws ApiException 401 when the token is missing, malformed or expired;
     *                      403 when it is valid but not an administrator.
     */
    public void requireAdmin(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            throw ApiException.unauthorized("Sign in to continue");
        }
        TokenService.TokenPayload payload = tokenService.verify(authorizationHeader);
        if (payload == null) {
            throw ApiException.unauthorized("Your session has expired, please sign in again");
        }
        if (!payload.isAdmin()) {
            throw ApiException.forbidden("Admin access required");
        }
    }
}
