package com.esaengineering.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.SiteService;

// Sends saved text changes to the public pages (content.js calls this).
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/content")
public class ApiContentController {

    private final SiteService siteService;

    public ApiContentController(SiteService siteService) {
        this.siteService = siteService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getContent(@RequestParam("slug") String slug) {
        if (slug == null || slug.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // unknown page, the public page just keeps its normal text
        if (siteService.getPageBySlug(slug.trim()).isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Map<String, Object> response = new HashMap<>();
        response.put("slug", slug.trim());
        response.put("blocks", siteService.blocksForSlug(slug.trim()));

        return ResponseEntity.ok(response);
    }
}
