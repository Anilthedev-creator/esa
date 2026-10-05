package com.esaengineering.api;

import com.esaengineering.service.CmsService;
import com.esaengineering.service.SettingsService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Seeds the CMS pages and the site settings once the schema exists.
 *
 * Why this is a CommandLineRunner and not a controller constructor:
 * Spring Boot builds the EntityManagerFactory (which runs the DDL and creates
 * the tables) before any CommandLineRunner executes. Controller beans, on the
 * other hand, are instantiated while the context is still wiring up, so calling
 * a repository from a constructor hits "Table \"site_settings\" not found".
 *
 * Order matters: AdminBootstrap (@Order(1)) creates the first administrator
 * first, then this runner (@Order(2)) seeds content and settings.
 *
 * Each step also VERIFIES the result and logs it. That matters because
 * Hibernate's ddl-auto=update logs a failed CREATE TABLE and then carries on
 * booting normally - without this the only symptom is a confusing
 * "table not found" at request time, long after the real cause scrolled past.
 */
@Component
@Order(2)
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final CmsService cmsService;
    private final SettingsService settingsService;

    public DataInitializer(CmsService cmsService, SettingsService settingsService) {
        this.cmsService = cmsService;
        this.settingsService = settingsService;
    }

    @Override
    public void run(String... args) {
        seedPages();
        seedSettings();
    }

    private void seedPages() {
        try {
            cmsService.ensureDefaultPages();
            long pages = cmsService.countPages();
            if (pages == 0) {
                log.error("cms_pages is still EMPTY after seeding. Scroll up in this log for a Hibernate "
                        + "DDL error - ddl-auto=update reports a failed CREATE TABLE but does not abort the boot.");
            } else {
                log.info("CMS ready: {} page(s) seeded.", pages);
            }
        } catch (RuntimeException e) {
            log.error("Could not seed the default CMS pages - {}", e.getMessage());
        }
    }

    private void seedSettings() {
        try {
            settingsService.ensureDefaults();
            long settings = settingsService.countSettings();
            if (settings == 0) {
                log.error("site_settings is still EMPTY after seeding. Scroll up in this log for a Hibernate "
                        + "DDL error - ddl-auto=update reports a failed CREATE TABLE but does not abort the boot. "
                        + "Reserved column names (key/value/order/user/...) are the usual culprit.");
            } else {
                log.info("Settings ready: {} default setting(s) seeded.", settings);
            }
        } catch (RuntimeException e) {
            log.error("Could not seed the default site settings - {}", e.getMessage());
        }
    }
}
