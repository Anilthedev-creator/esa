package com.esaengineering.api;

import com.esaengineering.service.AnalyticsService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/analytics")
public class ApiAnalyticsController {

    private final AnalyticsService analyticsService;

    public ApiAnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @PostMapping("/track")
    public Map<String, Object> track(@RequestBody(required = false) Map<String, Object> body,
                                     @RequestHeader(value = "Referer", required = false) String referer) {
        String page = "index.html";
        String ref = referer;
        if (body != null) {
            if (body.get("page") != null) page = body.get("page").toString();
            if (body.get("referrer") != null) ref = body.get("referrer").toString();
        }
        analyticsService.track(page, ref);
        return Map.of("success", true);
    }

    // Support beacon sending as plain text (navigator.sendBeacon uses Blob)
    @PostMapping(value = "/track", consumes = {"text/plain", "application/octet-stream"})
    public Map<String, Object> trackBeacon(@RequestBody(required = false) String raw) {
        String page = "index.html";
        if (raw != null && raw.contains("\"page\"")) {
            try {
                // crude extraction
                int idx = raw.indexOf("\"page\"");
                int colon = raw.indexOf(":", idx);
                int q1 = raw.indexOf("\"", colon + 1);
                int q2 = raw.indexOf("\"", q1 + 1);
                if (q1 >= 0 && q2 > q1) page = raw.substring(q1 + 1, q2);
            } catch (Exception ignored) {}
        }
        analyticsService.track(page, null);
        return Map.of("success", true);
    }
}
