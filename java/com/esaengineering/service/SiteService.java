package com.esaengineering.service;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

import com.esaengineering.model.Contact;
import com.esaengineering.model.ContentBlock;
import com.esaengineering.model.SitePage;
import com.esaengineering.model.SiteSetting;
import com.esaengineering.model.SiteVisit;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.ContentBlockRepository;
import com.esaengineering.repository.SitePageRepository;
import com.esaengineering.repository.SiteSettingRepository;
import com.esaengineering.repository.SiteVisitRepository;

// Settings, page content (CMS) and visit tracking for the website.
@Service
public class SiteService {

    private final SiteSettingRepository settingRepository;
    private final SitePageRepository pageRepository;
    private final ContentBlockRepository blockRepository;
    private final SiteVisitRepository visitRepository;
    private final ContactRepository contactRepository;

    public SiteService(
            SiteSettingRepository settingRepository,
            SitePageRepository pageRepository,
            ContentBlockRepository blockRepository,
            SiteVisitRepository visitRepository,
            ContactRepository contactRepository) {
        this.settingRepository = settingRepository;
        this.pageRepository = pageRepository;
        this.blockRepository = blockRepository;
        this.visitRepository = visitRepository;
        this.contactRepository = contactRepository;
    }

    /* ---------------- settings ---------------- */

    // default values used when nothing was saved yet
    public Map<String, String> getSettings() {
        Map<String, String> settings = new LinkedHashMap<>();
        settings.put("siteName", "ESA Engineering Services Australia");
        settings.put("adminEmail", "engsa@live.com.au");
        settings.put("timezone", "Australia/Sydney");
        settings.put("language", "en-AU");

        List<SiteSetting> saved = settingRepository.findAll();
        for (SiteSetting setting : saved) {
            if (settings.containsKey(setting.getSettingKey())) {
                settings.put(setting.getSettingKey(), setting.getSettingValue());
            }
        }

        return settings;
    }

    public void saveSettings(Map<String, String> settings) {
        for (String key : settings.keySet()) {
            // only the 4 known settings can be saved
            if (!key.equals("siteName") && !key.equals("adminEmail")
                    && !key.equals("timezone") && !key.equals("language")) {
                continue;
            }
            String value = settings.get(key);
            if (value == null) {
                value = "";
            }
            settingRepository.save(new SiteSetting(key, value.trim()));
        }
    }

    /* ---------------- visit tracking ---------------- */

    public void recordVisit(String page) {
        if (page == null || page.isBlank()) {
            page = "index.html";
        }
        visitRepository.save(new SiteVisit(page.trim(), LocalDateTime.now()));
    }

    // visits and enquiries per day for the last N days, oldest day first
    public List<Map<String, Object>> activitySeries(int days) {
        if (days < 1) {
            days = 7;
        }
        if (days > 90) {
            days = 90;
        }

        LocalDateTime from = LocalDate.now().minusDays(days - 1).atStartOfDay();
        List<SiteVisit> visits = visitRepository.findByVisitedAtAfter(from);
        List<Contact> enquiries = contactRepository.findAll();

        List<Map<String, Object>> series = new ArrayList<>();

        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = LocalDate.now().minusDays(i);

            int visitCount = 0;
            for (SiteVisit visit : visits) {
                if (visit.getVisitedAt() != null
                        && visit.getVisitedAt().toLocalDate().equals(day)) {
                    visitCount++;
                }
            }

            int enquiryCount = 0;
            for (Contact enquiry : enquiries) {
                if (enquiry.getCreatedAt() != null
                        && enquiry.getCreatedAt().toLocalDate().equals(day)) {
                    enquiryCount++;
                }
            }

            Map<String, Object> oneDay = new HashMap<>();
            oneDay.put("date", day.toString());
            oneDay.put("visits", visitCount);
            oneDay.put("enquiries", enquiryCount);
            series.add(oneDay);
        }

        return series;
    }

    /* ---------------- pages ---------------- */

    public List<SitePage> getPages() {
        return pageRepository.findAll();
    }

    public Optional<SitePage> getPage(Long id) {
        return pageRepository.findById(id);
    }

    public Optional<SitePage> getPageBySlug(String slug) {
        return pageRepository.findBySlug(slug);
    }

    public SitePage createPage(String title, String slug) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException("Page title is required");
        }
        if (slug == null || slug.isBlank()) {
            // make a slug from the title, eg "Case Studies" -> "case-studies.html"
            slug = title.trim().toLowerCase().replaceAll("[^a-z0-9]+", "-");
            slug = slug.replaceAll("^-|-$", "") + ".html";
        }
        slug = slug.trim();
        if (pageRepository.findBySlug(slug).isPresent()) {
            throw new IllegalArgumentException("A page with this slug already exists");
        }
        SitePage page = new SitePage(title.trim(), slug, "draft");
        return pageRepository.save(page);
    }

    public SitePage savePage(SitePage page) {
        page.setUpdatedAt(LocalDateTime.now());
        return pageRepository.save(page);
    }

    /* ---------------- content blocks ---------------- */

    // saved changes for one page, used by content.js on the public site
    public Map<String, String> blocksForSlug(String slug) {
        Map<String, String> blocks = new HashMap<>();
        Optional<SitePage> page = pageRepository.findBySlug(slug);
        if (page.isEmpty()) {
            return blocks;
        }
        List<ContentBlock> saved = blockRepository.findByPage(page.get());
        for (ContentBlock block : saved) {
            blocks.put(block.getBlockKey(), block.getBlockValue());
        }
        return blocks;
    }

    // every editable block of a page with its default text from the
    // html file and the saved change (if any), used by the admin editor
    public List<Map<String, Object>> blocksForAdmin(SitePage page) {
        List<CmsDefault> defaults = readDefaultsFromHtml(page.getSlug());

        Map<String, String> saved = new HashMap<>();
        List<ContentBlock> rows = blockRepository.findByPage(page);
        for (ContentBlock row : rows) {
            saved.put(row.getBlockKey(), row.getBlockValue());
        }

        List<Map<String, Object>> blocks = new ArrayList<>();
        for (CmsDefault one : defaults) {
            Map<String, Object> block = new HashMap<>();
            block.put("key", one.key);
            block.put("label", makeLabel(one.key));
            block.put("defaultValue", one.value);
            block.put("html", one.html);
            if (saved.containsKey(one.key)) {
                block.put("value", saved.get(one.key));
                block.put("overridden", true);
            } else {
                block.put("value", one.value);
                block.put("overridden", false);
            }
            blocks.add(block);
        }

        // changes for blocks that are no longer in the html file
        for (String key : saved.keySet()) {
            boolean found = false;
            for (CmsDefault one : defaults) {
                if (one.key.equals(key)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                Map<String, Object> block = new HashMap<>();
                block.put("key", key);
                block.put("label", makeLabel(key));
                block.put("defaultValue", "");
                block.put("html", false);
                block.put("value", saved.get(key));
                block.put("overridden", true);
                blocks.add(block);
            }
        }

        return blocks;
    }

    public void saveBlocks(SitePage page, Map<String, String> blocks) {
        for (String key : blocks.keySet()) {
            if (key == null || key.isBlank()) {
                continue;
            }
            String value = blocks.get(key);
            if (value == null) {
                value = "";
            }
            Optional<ContentBlock> existing =
                    blockRepository.findByPageAndBlockKey(page, key.trim());
            if (existing.isPresent()) {
                ContentBlock row = existing.get();
                row.setBlockValue(value);
                blockRepository.save(row);
            } else {
                blockRepository.save(new ContentBlock(page, key.trim(), value));
            }
        }
        page.setUpdatedAt(LocalDateTime.now());
        pageRepository.save(page);
    }

    public boolean deleteBlock(SitePage page, String key) {
        Optional<ContentBlock> existing =
                blockRepository.findByPageAndBlockKey(page, key);
        if (existing.isEmpty()) {
            return false;
        }
        blockRepository.delete(existing.get());
        page.setUpdatedAt(LocalDateTime.now());
        pageRepository.save(page);
        return true;
    }

    // "hero-intro" -> "Hero Intro"
    private String makeLabel(String key) {
        String label = key.replace("-", " ").replace("_", " ").trim();
        if (label.isEmpty()) {
            return key;
        }
        return label.substring(0, 1).toUpperCase() + label.substring(1);
    }

    // one editable piece of text found in a html file
    private static class CmsDefault {
        String key;
        String value;
        boolean html;
    }

    // Reads the html file of a page and finds every data-cms="..."
    // element. The text inside the element is the default value.
    private List<CmsDefault> readDefaultsFromHtml(String slug) {
        List<CmsDefault> defaults = new ArrayList<>();

        // safety check so nobody can read files outside the static folder
        if (slug == null || slug.contains("..") || slug.contains("/") || slug.contains("\\")) {
            return defaults;
        }

        try {
            InputStream file = getClass().getClassLoader()
                    .getResourceAsStream("static/" + slug);
            if (file == null) {
                return defaults;
            }
            String html = new String(file.readAllBytes(), StandardCharsets.UTF_8);
            file.close();

            Pattern pattern = Pattern.compile(
                    "<([A-Za-z][A-Za-z0-9]*)[^>]*?data-cms=\"([^\"]+)\"[^>]*>(.*?)</\\1>",
                    Pattern.DOTALL);
            Matcher matcher = pattern.matcher(html);

            while (matcher.find()) {
                CmsDefault one = new CmsDefault();
                one.key = matcher.group(2);
                one.value = matcher.group(3).trim();
                one.html = matcher.group(0).contains("data-cms-html");
                defaults.add(one);
            }
        } catch (Exception error) {
            // if the file cannot be read there are just no defaults
            error.printStackTrace();
        }

        return defaults;
    }
}
