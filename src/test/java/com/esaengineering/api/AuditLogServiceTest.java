package com.esaengineering.api;

import com.esaengineering.model.AuditEntry;
import com.esaengineering.repository.AuditEntryRepository;
import com.esaengineering.security.TokenService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditLogServiceTest {

    @Test
    void savesAnEntryWithTheAdminFromTheToken() {
        AuditEntryRepository repository = mock(AuditEntryRepository.class);
        TokenService tokens = new TokenService("audit-test-secret-with-enough-length", 12);
        AuditLogService service = new AuditLogService(repository, tokens);
        String auth = "Bearer " + tokens.issue(1L, "admin@example.com", "ADMIN");

        service.record(auth, "customer updated", "#4 fields: phone");

        ArgumentCaptor<AuditEntry> saved = ArgumentCaptor.forClass(AuditEntry.class);
        verify(repository).save(saved.capture());
        assertEquals("admin@example.com", saved.getValue().getWho());
        assertEquals("customer updated", saved.getValue().getAction());
        assertEquals("#4 fields: phone", saved.getValue().getDetail());
    }

    @Test
    void keepsLongDetailsWithinTheDatabaseColumnLimit() {
        AuditEntryRepository repository = mock(AuditEntryRepository.class);
        AuditLogService service = new AuditLogService(repository,
                new TokenService("audit-test-secret-with-enough-length", 12));

        service.record(null, "page content updated", "x".repeat(700));

        ArgumentCaptor<AuditEntry> saved = ArgumentCaptor.forClass(AuditEntry.class);
        verify(repository).save(saved.capture());
        assertEquals(500, saved.getValue().getDetail().length());
        assertEquals("unknown", saved.getValue().getWho());
    }
}
