package com.esaengineering.api;

import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ApiAuthControllerSecurityTest {

    @Test
    void creatingAnAdminNeedsAnAdminToken() {
        ApiAuthService authService = mock(ApiAuthService.class);
        TokenService tokens = new TokenService("test-token-secret-for-auth-controller", 1);
        ApiAuthController controller = new ApiAuthController(authService, tokens, new AdminAccess(tokens),
                mock(AuditLogService.class), false);
        Map<String, Object> body = Map.of(
                "fullName", "New Admin",
                "email", "new-admin@example.com",
                "password", "StrongPassword9");

        ApiException missing = assertThrows(ApiException.class, () -> controller.createAdmin(body, null));
        assertEquals(401, missing.getStatus().value());
        String customer = "Bearer " + tokens.issue(2L, "customer@example.com", "CUSTOMER");
        ApiException customerError = assertThrows(ApiException.class, () -> controller.createAdmin(body, customer));
        assertEquals(403, customerError.getStatus().value());
        verify(authService, never()).createAdmin(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void successfulAdminCreationIsAuditedWithoutThePassword() {
        ApiAuthService authService = mock(ApiAuthService.class);
        TokenService tokens = new TokenService("test-token-secret-for-auth-controller", 1);
        AuditLogService auditLog = mock(AuditLogService.class);
        ApiAuthController controller = new ApiAuthController(authService, tokens, new AdminAccess(tokens),
                auditLog, false);
        String auth = "Bearer " + tokens.issue(1L, "admin@example.com", "ADMIN");
        Map<String, Object> body = Map.of(
                "fullName", "New Admin",
                "email", "new-admin@example.com",
                "password", "StrongPassword9");

        controller.createAdmin(body, auth);

        verify(authService).createAdmin("New Admin", "new-admin@example.com", "StrongPassword9", null);
        verify(auditLog).record(auth, "administrator created", "New Admin (new-admin@example.com)");
    }
}
