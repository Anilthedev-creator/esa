package com.esaengineering.controller;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.api.AuditLogService;
import com.esaengineering.model.ContentAbout;
import com.esaengineering.security.TokenService;
import com.esaengineering.service.AboutService;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AboutControllerAuditTest {

    @Test
    void aboutEditsAreAuditedByFieldName() {
        AboutService aboutService = mock(AboutService.class);
        AuditLogService auditLog = mock(AuditLogService.class);
        TokenService tokens = new TokenService("about-test-secret-with-enough-length", 12);
        AboutController controller = new AboutController(aboutService, new AdminAccess(tokens), auditLog);
        String auth = "Bearer " + tokens.issue(1L, "admin@example.com", "ADMIN");
        ContentAbout content = new ContentAbout();
        content.setParagraph3("content that should not be copied into the audit log");

        controller.saveContents(content, auth);

        verify(aboutService).saveContents(content);
        verify(auditLog).record(auth, "about content updated", "paragraph3");
    }
}
