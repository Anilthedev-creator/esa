package com.esaengineering.api;

import java.util.LinkedHashMap;
import java.util.Map;

import com.esaengineering.repository.AuditEntryRepository;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The audit trail feed for auditLog.html. Mirrors GET /api/admin/audit in
 * server.js - admin only, newest first.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiAuditController {

    private final AuditEntryRepository auditRepo;
    private final AdminAccess adminAccess;

    public ApiAuditController(AuditEntryRepository auditRepo, AdminAccess adminAccess) {
        this.auditRepo = auditRepo;
        this.adminAccess = adminAccess;
    }

    @GetMapping("/admin/audit")
    public Map<String, Object> list(@RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entries", auditRepo.findAllByOrderByIdDesc());
        return out;
    }
}
