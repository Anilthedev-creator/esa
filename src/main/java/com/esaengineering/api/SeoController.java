package com.esaengineering.api;

import java.net.URI;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Serves a domain-correct sitemap only when the operator sets PUBLIC_SITE_URL. */
@RestController
public class SeoController {

    private static final List<String> PUBLIC_PAGES = List.of(
            "index.html", "about.html", "services.html", "commissioning.html",
            "appraisals.html", "optimisation.html", "waste-management.html",
            "dangerous-goods.html", "projects.html", "contact.html", "team.html",
            "resources.html", "safety-standards.html", "privacy-policy.html"
    );

    private static final List<String> PRIVATE_PAGES = List.of(
            "dashboard.html", "customers.html", "enquiries.html", "bookings.html",
            "payments.html", "settings.html", "content.html", "auditLog.html",
            "caseStudies.html", "aboutPageAdmin.html", "accountAdmin.html",
            "portal.html", "signin.html", "signup.html", "forgot-password.html",
            "reset-password.html", "booking.html", "payment.html", "receipt.html"
    );

    private final String siteOrigin;

    public SeoController(@Value("${app.public-site-url:}") String publicSiteUrl) {
        this.siteOrigin = cleanOrigin(publicSiteUrl);
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robots() {
        StringBuilder text = new StringBuilder("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /data/\n");
        for (String page : PRIVATE_PAGES) text.append("Disallow: /").append(page).append('\n');
        if (!siteOrigin.isEmpty()) text.append("\nSitemap: ").append(siteOrigin).append("/sitemap.xml\n");
        return text.toString();
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        if (siteOrigin.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Set PUBLIC_SITE_URL to enable the sitemap.");
        }
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        for (String page : PUBLIC_PAGES) {
            xml.append("  <url><loc>").append(siteOrigin).append('/').append(page)
                    .append("</loc></url>\n");
        }
        xml.append("</urlset>\n");
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_XML).body(xml.toString());
    }

    private static String cleanOrigin(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            URI uri = URI.create(value.trim());
            String scheme = uri.getScheme();
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null
                    || uri.getFragment() != null || (uri.getPath() != null && !uri.getPath().isEmpty() && !"/".equals(uri.getPath()))) {
                return "";
            }
            if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return "";
            return scheme.toLowerCase() + "://" + uri.getRawAuthority();
        } catch (IllegalArgumentException error) {
            return "";
        }
    }
}
