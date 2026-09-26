package com.esaengineering.api;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The endpoints static/admin-data.js calls on every admin page.
 *
 *   GET /api/admin/stats      -> { stats:{...}, recentRequests:[...], recentEnquiries:[...] }
 *   GET /api/admin/customers  -> { customers:[...] }
 *   GET /api/admin/enquiries  -> { enquiries:[...] }
 *   GET /api/admin/payments   -> { payments:[...] }
 *
 * Responses are objects, never bare arrays, because the renderers read a
 * named key (data.customers etc). A 404 here is what produces the
 * "Backend offline" banner - these four cover dashboard, customers,
 * enquiries and payments.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/admin")
public class ApiAdminController {

    private final AdminDataService adminService;

    public ApiAdminController(AdminDataService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return adminService.stats();
    }

    @GetMapping("/customers")
    public Map<String, Object> customers() {
        List<Map<String, Object>> rows = adminService.customers();
        return single("customers", rows, rows.size());
    }

    @GetMapping("/enquiries")
    public Map<String, Object> enquiries() {
        List<Map<String, Object>> rows = adminService.enquiries();
        return single("enquiries", rows, rows.size());
    }

    @GetMapping("/payments")
    public Map<String, Object> payments() {
        List<Map<String, Object>> rows = adminService.payments();
        return single("payments", rows, rows.size());
    }

    private static Map<String, Object> single(String key, List<Map<String, Object>> rows, int total) {
        java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put(key, rows);
        payload.put("total", total);
        return payload;
    }
}
