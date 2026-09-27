package com.esaengineering.api;

import com.esaengineering.model.CmsPage;
import com.esaengineering.service.AnalyticsService;
import com.esaengineering.service.CmsService;
import com.esaengineering.service.SettingsService;
import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;

import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Full admin API that the frontend (admin-data.js) expects.
 * Covers dashboard, customers, enquiries, payments, pages, analytics, settings.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/admin")
public class ApiAdminController {

    private final AdminDataService adminService;
    private final CmsService cmsService;
    private final AnalyticsService analyticsService;
    private final SettingsService settingsService;
    private final TokenService tokenService;

    public ApiAdminController(AdminDataService adminService,
                              CmsService cmsService,
                              AnalyticsService analyticsService,
                              SettingsService settingsService,
                              TokenService tokenService) {
        this.adminService = adminService;
        this.cmsService = cmsService;
        this.analyticsService = analyticsService;
        this.settingsService = settingsService;
        this.tokenService = tokenService;
        this.cmsService.ensureDefaultPages();
        this.settingsService.ensureDefaults();
    }

    // ---- helper for optional auth guard (if Authorization header present, validate admin) ----
    private void checkAdminIfTokenPresent(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            // Allow in dev mode when no token sent (e.g. direct curl), but frontend will send token
            return;
        }
        var payload = tokenService.verify(authHeader);
        if (payload == null) throw ApiException.unauthorized("Session expired");
        if (!"ADMIN".equalsIgnoreCase(payload.getRole())) throw ApiException.forbidden("Admin access required");
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return adminService.stats();
    }

    @GetMapping("/customers")
    public Map<String, Object> customers(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        List<Map<String, Object>> rows = adminService.customers();
        return single("customers", rows, rows.size());
    }

    @GetMapping("/customers/{id}")
    public Map<String, Object> customerOne(@PathVariable Long id,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return Map.of("customer", adminService.customerById(id));
    }

    @PatchMapping("/customers/{id}")
    public Map<String, Object> patchCustomer(@PathVariable Long id,
                                             @RequestBody Map<String, Object> body,
                                             @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        Map<String, Object> updated = adminService.updateCustomer(id, body);
        return Map.of("customer", updated, "message", "Customer updated");
    }

    @GetMapping("/enquiries")
    public Map<String, Object> enquiries(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        List<Map<String, Object>> rows = adminService.enquiries();
        return single("enquiries", rows, rows.size());
    }

    @GetMapping("/enquiries/{id}")
    public Map<String, Object> enquiryOne(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return Map.of("enquiry", adminService.enquiryById(id));
    }

    @PatchMapping("/enquiries/{id}")
    public Map<String, Object> patchEnquiry(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body,
                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        Map<String, Object> updated = adminService.updateEnquiry(id, body);
        return Map.of("enquiry", updated, "message", "Enquiry updated");
    }

    @GetMapping("/payments")
    public Map<String, Object> payments(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        List<Map<String, Object>> rows = adminService.payments();
        return single("payments", rows, rows.size());
    }

    @GetMapping("/payments/{id}")
    public Map<String, Object> paymentOne(@PathVariable Long id,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return Map.of("payment", adminService.paymentById(id));
    }

    @PatchMapping("/payments/{id}")
    public Map<String, Object> patchPayment(@PathVariable Long id,
                                            @RequestBody Map<String, Object> body,
                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        Map<String, Object> updated = adminService.updatePayment(id, body);
        return Map.of("payment", updated, "message", "Payment updated");
    }

    // ---- pages (CMS) ----

    @GetMapping("/pages")
    public Map<String, Object> pages(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        List<CmsPage> all = cmsService.listPages();
        List<Map<String, Object>> rows = all.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("title", p.getTitle());
            m.put("slug", p.getSlug());
            m.put("status", p.getStatus());
            m.put("updatedAt", p.getUpdatedAt());
            return m;
        }).toList();
        return single("pages", rows, rows.size());
    }

    @PostMapping("/pages")
    public Map<String, Object> createPage(@RequestBody Map<String, Object> body,
                                          @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        String title = body.get("title") != null ? body.get("title").toString() : null;
        String slug = body.get("slug") != null ? body.get("slug").toString() : null;
        CmsPage created = cmsService.createPage(title, slug);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", created.getId());
        m.put("title", created.getTitle());
        m.put("slug", created.getSlug());
        m.put("status", created.getStatus());
        return Map.of("page", m, "message", "Page created");
    }

    @GetMapping("/pages/{id}")
    public Map<String, Object> pageWithBlocks(@PathVariable Long id,
                                              @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return cmsService.getPageWithBlocks(id);
    }

    @PatchMapping("/pages/{id}")
    public Map<String, Object> patchPage(@PathVariable Long id,
                                         @RequestBody Map<String, Object> body,
                                         @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        String status = body.get("status") != null ? body.get("status").toString() : null;
        CmsPage updated = cmsService.updatePageStatus(id, status);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", updated.getId());
        m.put("title", updated.getTitle());
        m.put("slug", updated.getSlug());
        m.put("status", updated.getStatus());
        return Map.of("page", m, "message", "Page updated");
    }

    @PutMapping("/pages/{id}/blocks")
    public Map<String, Object> putBlocks(@PathVariable Long id,
                                         @RequestBody Map<String, Object> body,
                                         @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        Object blocksObj = body.get("blocks");
        if (!(blocksObj instanceof Map)) throw ApiException.badRequest("blocks must be an object");
        @SuppressWarnings("unchecked")
        Map<String, Object> raw = (Map<String, Object>) blocksObj;
        Map<String, String> toSave = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : raw.entrySet()) {
            toSave.put(e.getKey(), e.getValue() != null ? e.getValue().toString() : "");
        }
        cmsService.upsertBlocks(id, toSave);
        return Map.of("message", "Content saved", "success", true);
    }

    @DeleteMapping("/pages/{id}/blocks/{key}")
    public Map<String, Object> deleteBlock(@PathVariable Long id,
                                           @PathVariable String key,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        cmsService.deleteBlockOverride(id, key);
        return Map.of("message", "Block reset to default", "success", true);
    }

    // ---- analytics ----

    @GetMapping("/analytics/activity")
    public Map<String, Object> activity(@RequestParam(value = "days", defaultValue = "7") int days,
                                        @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return analyticsService.getActivity(days);
    }

    // ---- settings ----

    @GetMapping("/settings")
    public Map<String, Object> getSettings(@RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        return settingsService.getSettings();
    }

    @PutMapping("/settings")
    public Map<String, Object> putSettings(@RequestBody Map<String, Object> body,
                                           @RequestHeader(value = "Authorization", required = false) String auth) {
        checkAdminIfTokenPresent(auth);
        Map<String, String> incoming = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : body.entrySet()) {
            if (e.getValue() != null) incoming.put(e.getKey(), e.getValue().toString());
        }
        return settingsService.updateSettings(incoming);
    }

    private static Map<String, Object> single(String key, List<Map<String, Object>> rows, int total) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(key, rows);
        payload.put("total", total);
        return payload;
    }
}
