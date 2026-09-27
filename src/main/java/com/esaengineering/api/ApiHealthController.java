package com.esaengineering.api;

import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiHealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "UP");
        m.put("backend", "Spring Boot");
        m.put("timestamp", java.time.Instant.now().toString());
        return m;
    }

    @GetMapping("/admin/health")
    public Map<String, Object> adminHealth() {
        return health();
    }
}
