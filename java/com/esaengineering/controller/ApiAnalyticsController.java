package com.esaengineering.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.SiteService;

// Page view tracking (tracking.js calls this on every page load).
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/analytics")
public class ApiAnalyticsController {

    private final SiteService siteService;

    public ApiAnalyticsController(SiteService siteService) {
        this.siteService = siteService;
    }

    @PostMapping("/track")
    public ResponseEntity<Map<String, Object>> track(@RequestBody Map<String, String> body) {
        String page = body.get("page");
        siteService.recordVisit(page);

        Map<String, Object> response = new HashMap<>();
        response.put("ok", true);

        return ResponseEntity.ok(response);
    }
}
