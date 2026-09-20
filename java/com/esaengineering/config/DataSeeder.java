package com.esaengineering.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.esaengineering.model.ContentAbout;
import com.esaengineering.model.SitePage;
import com.esaengineering.repository.ContentAboutRepository;
import com.esaengineering.repository.SitePageRepository;
import com.esaengineering.service.AuthService;

// Fills the database with the rows the site needs when it
// starts for the first time. Everything here only runs when
// the table is empty so it never makes duplicates.
@Component
public class DataSeeder implements CommandLineRunner {

    private final AuthService authService;
    private final ContentAboutRepository aboutRepository;
    private final SitePageRepository pageRepository;

    public DataSeeder(
            AuthService authService,
            ContentAboutRepository aboutRepository,
            SitePageRepository pageRepository) {
        this.authService = authService;
        this.aboutRepository = aboutRepository;
        this.pageRepository = pageRepository;
    }

    @Override
    public void run(String... args) {

        // default admin account for the admin pages
        // email: admin@esa.com.au   password: Admin1234
        authService.registerUserAdmin(
                "Site Admin",
                "admin@esa.com.au",
                "Admin1234",
                "0402464823");

        // the about page needs its one content row
        if (aboutRepository.count() == 0) {
            aboutRepository.save(new ContentAbout());
        }

        // pages shown on the admin content page
        String[][] pages = {
            {"Home", "index.html"},
            {"About", "about.html"},
            {"Services", "services.html"},
            {"Projects", "projects.html"},
            {"Contact", "contact.html"},
            {"Team", "team.html"}
        };

        for (String[] page : pages) {
            if (pageRepository.findBySlug(page[1]).isEmpty()) {
                pageRepository.save(new SitePage(page[0], page[1], "published"));
            }
        }
    }
}
