package com.esaengineering.controller;

import java.util.List;
import java.util.Map;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.dto.CustomerDTO;
import com.esaengineering.service.AdminService;

import org.springframework.web.bind.annotation.*;

/**
 * Legacy admin endpoints kept for backwards compatibility.
 *
 * Both are reads of customer data, so they now require an administrator token
 * exactly like /api/admin/** does. Prefer /api/admin/stats and
 * /api/admin/customers - these exist only so old callers keep working.
 */
@RestController
@RequestMapping("/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private final AdminService adminService;
    private final AdminAccess adminAccess;

    public AdminController(AdminService adminService, AdminAccess adminAccess) {
        this.adminService = adminService;
        this.adminAccess = adminAccess;
    }

    /*
     * Get customer information for the Admin Portal
     */
    @GetMapping("/customers")
    public List<CustomerDTO> getAllBookings(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return adminService.getAllBookings();
    }

    /*
     * Get dashboard statistics and recent activity
     */
    @GetMapping("/stats")
    public Map<String, Object> getDashboardStats(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return adminService.getDashboardStats();
    }
}
