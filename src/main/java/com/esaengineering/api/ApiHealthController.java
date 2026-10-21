package com.esaengineering.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiHealthController {

    private final boolean demoCardPaymentsEnabled;

    public ApiHealthController(@Value("${app.payment.demo-card-enabled:true}") boolean demoCardPaymentsEnabled) {
        this.demoCardPaymentsEnabled = demoCardPaymentsEnabled;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "UP");
        m.put("backend", "Spring Boot");
        m.put("timestamp", java.time.Instant.now().toString());
        m.put("demoCardPaymentsEnabled", demoCardPaymentsEnabled);
        return m;
    }

    @GetMapping("/admin/health")
    public Map<String, Object> adminHealth() {
        return health();
    }
}
