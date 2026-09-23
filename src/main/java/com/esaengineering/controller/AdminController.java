package com.esaengineering.controller;

import java.util.List;
import java.util.Map;

import com.esaengineering.dto.CustomerDTO;
import com.esaengineering.service.AdminService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin")
@CrossOrigin
public class AdminController {

    @Autowired
    private AdminService adminService;

    /*
     * Get customer information for the Admin Portal
     */
    @GetMapping("/customers")
    public List<CustomerDTO> getAllBookings() {

        return adminService.getAllBookings();
    }

    /*
     * Get dashboard statistics and recent activity
     */
    @GetMapping("/stats")
    public Map<String, Object> getDashboardStats() {

        return adminService.getDashboardStats();
    }
}
