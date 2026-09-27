package com.esaengineering.service;

import com.esaengineering.model.SiteSetting;
import com.esaengineering.repository.SiteSettingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class SettingsService {

    private static final Logger log = LoggerFactory.getLogger(SettingsService.class);

    private final SiteSettingRepository repo;

    public SettingsService(SiteSettingRepository repo) {
        this.repo = repo;
    }

    /**
     * Creates the built-in settings if they are missing. Resilient on purpose:
     * a missing table must not abort the boot.
     */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void ensureDefaults() {
        Map<String, String> defaults = Map.of(
                "siteName", "ESA Engineering",
                "adminEmail", "admin@esaengineering.com.au",
                "timezone", "Australia/Melbourne",
                "language", "en-AU"
        );
        try {
            for (Map.Entry<String, String> e : defaults.entrySet()) {
                if (!repo.existsById(e.getKey())) {
                    repo.save(new SiteSetting(e.getKey(), e.getValue()));
                }
            }
        } catch (RuntimeException e) {
            log.warn("Could not seed the default site settings (they will be retried on the next start): {}",
                    e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSettings() {
        ensureDefaults();
        Map<String, Object> map = new LinkedHashMap<>();
        for (SiteSetting s : repo.findAll()) {
            map.put(s.getKey(), s.getValue());
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("settings", map);
        return resp;
    }

    @Transactional
    public Map<String, Object> updateSettings(Map<String, String> incoming) {
        ensureDefaults();
        for (Map.Entry<String, String> e : incoming.entrySet()) {
            String k = e.getKey();
            String v = e.getValue();
            if (v == null) continue;
            Optional<SiteSetting> opt = repo.findById(k);
            SiteSetting s = opt.orElse(new SiteSetting(k, v));
            s.setValue(v);
            repo.save(s);
        }
        return getSettings();
    }
}
