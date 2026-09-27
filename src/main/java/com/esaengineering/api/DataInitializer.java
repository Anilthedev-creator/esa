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
        try {
            cmsService.ensureDefaultPages();
        } catch (RuntimeException e) {
            log.warn("Could not seed the default CMS pages (they will be retried on the next start): {}",
                    e.getMessage());
        }

        try {
            settingsService.ensureDefaults();
        } catch (RuntimeException e) {
            log.warn("Could not seed the default site settings (they will be retried on the next start): {}",
                    e.getMessage());
        }
    }
}
