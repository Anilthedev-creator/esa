package com.esaengineering.api;

import java.time.LocalDateTime;

import com.esaengineering.model.AuditEntry;
import com.esaengineering.repository.AuditEntryRepository;
import com.esaengineering.security.TokenService;

import org.springframework.stereotype.Component;

/**
 * Writes audit trail rows. Admin mutation endpoints call record(...) after a
 * successful change so there is a paper trail of who did what.
 *
 * The actor's email comes from the same Authorization header the endpoint
 * already checked - if we somehow cant read it we log "unknown" rather than
 * dropping the entry, because the action itself matters more than the name.
 *
 * TODO: the Node fallback caps its log at 500 entries. Here the table just
 * grows; add a scheduled prune if it ever gets big.
 */
@Component
public class AuditLogService {

    private final AuditEntryRepository auditRepo;
    private final TokenService tokenService;

    public AuditLogService(AuditEntryRepository auditRepo, TokenService tokenService) {
        this.auditRepo = auditRepo;
        this.tokenService = tokenService;
    }

    public void record(String authorizationHeader, String action, String detail) {
        AuditEntry entry = new AuditEntry();
        entry.setAt(LocalDateTime.now());
        entry.setWho(emailOf(authorizationHeader));
        entry.setAction(action);
        entry.setDetail(detail == null ? "" : (detail.length() > 500 ? detail.substring(0, 500) : detail));
        auditRepo.save(entry);
    }

    private String emailOf(String authorizationHeader) {
        try {
            TokenService.TokenPayload payload = tokenService.verify(authorizationHeader);
            if (payload != null && payload.getEmail() != null) return payload.getEmail();
        } catch (RuntimeException ignored) {
            // fall through to unknown, the entry is still worth keeping
        }
        return "unknown";
    }
}
