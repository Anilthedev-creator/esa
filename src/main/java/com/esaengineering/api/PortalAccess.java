package com.esaengineering.api;

import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;
import org.springframework.stereotype.Component;

/**
 * Shared authorization for the customer portal ({@code /api/portal/**}).
 *
 * Every portal endpoint answers with data that belongs to one signed-in
 * customer, so unlike the public endpoints none of them may be anonymous.
 * This is the mirror image of {@link AdminAccess}: one place that verifies the
 * bearer token and hands the caller a payload carrying the customer's email,
 * which is the only key used to scope the queries.
 *
 * There is no "role" here on purpose - an administrator browsing the portal
 * sees exactly the same thing a customer does, namely their own rows.
 */
@Component
public class PortalAccess {

    private final TokenService tokenService;

    public PortalAccess(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    /**
     * Verifies the bearer token and returns the caller's identity.
     *
     * @throws ApiException 401 when the header is missing, the signature is
     *         wrong, the token has expired, or it carries no email address
     */
    public TokenService.TokenPayload requireCustomer(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            throw ApiException.unauthorized("Sign in to view your portal");
        }
        TokenService.TokenPayload payload = tokenService.verify(authHeader);
        if (payload == null) {
            // Covers a bad signature, an expired token and a malformed payload
            // alike: the client can't tell them apart and shouldn't need to.
            throw ApiException.unauthorized("Your session has expired - please sign in again");
        }
        if (payload.getEmail() == null || payload.getEmail().isBlank()) {
            throw ApiException.unauthorized("Your session has expired - please sign in again");
        }
        return payload;
    }
}
