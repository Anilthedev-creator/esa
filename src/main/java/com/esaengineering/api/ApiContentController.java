package com.esaengineering.api;

import com.esaengineering.service.CmsService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiContentController {

    private final CmsService cmsService;

    public ApiContentController(CmsService cmsService) {
        this.cmsService = cmsService;
        // NOTE: no database access here - see DataInitializer.
    }

    @GetMapping("/content")
    public Map<String, Object> content(@RequestParam("slug") String slug) {
        if (slug == null || slug.isBlank()) slug = "index.html";
        return cmsService.getPublicContent(slug);
    }

    // Legacy endpoint for older static pages
    @GetMapping("/pages/{slug}")
    public Map<String, Object> pageBySlug(@PathVariable String slug) {
        return cmsService.getPublicContent(slug);
    }
}
