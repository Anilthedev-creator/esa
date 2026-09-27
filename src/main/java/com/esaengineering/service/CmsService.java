package com.esaengineering.service;

import com.esaengineering.model.CmsBlock;
import com.esaengineering.model.CmsPage;
import com.esaengineering.repository.CmsBlockRepository;
import com.esaengineering.repository.CmsPageRepository;
import com.esaengineering.web.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class CmsService {

    private static final Logger log = LoggerFactory.getLogger(CmsService.class);

    private final CmsPageRepository pageRepo;
    private final CmsBlockRepository blockRepo;

    // Regex to find data-cms="key" and optional data-cms-html, plus inner text fallback?
    // We parse static HTML files to extract editable keys and default values.
    private static final Pattern CMS_PATTERN = Pattern.compile(
            "<[^>]*data-cms\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</[^>]+>|<[^>]*data-cms\\s*=\\s*'([^']+)'[^>]*>(.*?)</[^>]+>",
            Pattern.DOTALL | Pattern.CASE_INSENSITIVE);

    private static final Pattern HTML_ATTR = Pattern.compile("data-cms-html", Pattern.CASE_INSENSITIVE);

    public CmsService(CmsPageRepository pageRepo, CmsBlockRepository blockRepo) {
        this.pageRepo = pageRepo;
        this.blockRepo = blockRepo;
    }

    /**
     * Creates the built-in pages if the table is empty.
     *
     * Called from {@link com.esaengineering.api.DataInitializer} once the schema
     * exists - never from a controller constructor. Resilient on purpose: a
     * missing table must not abort the boot.
     */
    @Transactional(noRollbackFor = RuntimeException.class)
    public void ensureDefaultPages() {
        try {
            if (pageRepo.count() > 0) return;
            List<CmsPage> defaults = List.of(
                    new CmsPage("Home", "index.html", "published"),
                    new CmsPage("About Us", "about.html", "published"),
                    new CmsPage("Services", "services.html", "published"),
                    new CmsPage("Projects", "projects.html", "published"),
                    new CmsPage("Contact Us", "contact.html", "published"),
                    new CmsPage("Commissioning", "commissioning.html", "published"),
                    new CmsPage("Appraisals", "appraisals.html", "published"),
                    new CmsPage("Optimisation", "optimisation.html", "published"),
                    new CmsPage("Waste Management", "waste-management.html", "published"),
                    new CmsPage("Dangerous Goods", "dangerous-goods.html", "published")
            );
            pageRepo.saveAll(defaults);
        } catch (RuntimeException e) {
            log.warn("Could not seed the default CMS pages (they will be retried on the next start): {}",
                    e.getMessage());
        }
    }

    /** Used by DataInitializer to prove the table exists and was seeded. */
    @Transactional(readOnly = true)
    public long countPages() {
        return pageRepo.count();
    }

    @Transactional(readOnly = true)
    public List<CmsPage> listPages() {
        return pageRepo.findAll();
    }

    @Transactional(readOnly = true)
    public CmsPage getPageOrThrow(Long id) {
        return pageRepo.findById(id).orElseThrow(() -> ApiException.notFound("Page not found"));
    }

    @Transactional(readOnly = true)
    public Optional<CmsPage> findBySlug(String slug) {
        return pageRepo.findBySlug(slug);
    }

    @Transactional
    public CmsPage createPage(String title, String slug) {
        if (title == null || title.isBlank()) throw ApiException.badRequest("Title is required");
        if (slug == null || slug.isBlank()) {
            slug = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "") + ".html";
        }
        if (pageRepo.existsBySlug(slug)) throw ApiException.conflict("A page with that slug already exists");
        CmsPage p = new CmsPage(title.trim(), slug.trim(), "published");
        return pageRepo.save(p);
    }

    @Transactional
    public CmsPage updatePageStatus(Long id, String status) {
        CmsPage p = getPageOrThrow(id);
        if (status != null) {
            String s = status.toLowerCase();
            if (!s.equals("published") && !s.equals("draft")) throw ApiException.badRequest("Status must be published or draft");
            p.setStatus(s);
        }
        return pageRepo.save(p);
    }

    /**
     * For admin edit: return page + list of blocks with default values discovered from static HTML + overrides from DB.
     */
    @Transactional
    public Map<String, Object> getPageWithBlocks(Long id) {
        CmsPage page = getPageOrThrow(id);
        List<Map<String, Object>> blocks = discoverBlocksForPage(page);
        // overlay DB overrides
        List<CmsBlock> persisted = blockRepo.findByPageId(page.getId());
        Map<String, CmsBlock> persistedMap = new HashMap<>();
        for (CmsBlock b : persisted) persistedMap.put(b.getKey(), b);

        List<Map<String, Object>> resultBlocks = new ArrayList<>();
        for (Map<String, Object> discovered : blocks) {
            String key = (String) discovered.get("key");
            CmsBlock override = persistedMap.get(key);
            String defaultVal = (String) discovered.get("defaultValue");
            String currentVal = override != null && override.getValue() != null ? override.getValue() : defaultVal;
            boolean isHtml = (Boolean) discovered.get("html");
            boolean overridden = override != null;

            Map<String, Object> out = new LinkedHashMap<>();
            out.put("key", key);
            out.put("label", discovered.get("label"));
            out.put("value", currentVal);
            out.put("defaultValue", defaultVal);
            out.put("html", isHtml);
            out.put("overridden", overridden);
            resultBlocks.add(out);
        }
        // also include any DB blocks that no longer exist in HTML (orphaned but still editable)
        for (CmsBlock pb : persisted) {
            boolean exists = blocks.stream().anyMatch(m -> pb.getKey().equals(m.get("key")));
            if (!exists) {
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("key", pb.getKey());
                out.put("label", pb.getLabel() != null ? pb.getLabel() : pb.getKey());
                out.put("value", pb.getValue());
                out.put("defaultValue", pb.getDefaultValue());
                out.put("html", pb.isHtml());
                out.put("overridden", true);
                resultBlocks.add(out);
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        Map<String, Object> pageMap = new LinkedHashMap<>();
        pageMap.put("id", page.getId());
        pageMap.put("title", page.getTitle());
        pageMap.put("slug", page.getSlug());
        pageMap.put("status", page.getStatus());
        pageMap.put("updatedAt", page.getUpdatedAt());
        response.put("page", pageMap);
        response.put("blocks", resultBlocks);
        return response;
    }

    @Transactional
    public void upsertBlocks(Long pageId, Map<String, String> incoming) {
        CmsPage page = getPageOrThrow(pageId);
        // discover defaults to know label/html
        List<Map<String, Object>> discovered = discoverBlocksForPage(page);
        Map<String, Map<String, Object>> discMap = new HashMap<>();
        for (Map<String, Object> d : discovered) discMap.put((String) d.get("key"), d);

        for (Map.Entry<String, String> e : incoming.entrySet()) {
            String key = e.getKey();
            String value = e.getValue();
            if (value == null) continue;
            Optional<CmsBlock> existingOpt = blockRepo.findByPageIdAndKey(pageId, key);
            CmsBlock block;
            if (existingOpt.isPresent()) {
                block = existingOpt.get();
            } else {
                block = new CmsBlock();
                block.setPage(page);
                block.setKey(key);
                Map<String, Object> d = discMap.get(key);
                if (d != null) {
                    block.setLabel((String) d.get("label"));
                    block.setDefaultValue((String) d.get("defaultValue"));
                    block.setHtml((Boolean) d.get("html"));
                } else {
                    block.setLabel(key);
                    block.setDefaultValue("");
                    block.setHtml(false);
                }
            }
            block.setValue(value);
            blockRepo.save(block);
        }
    }

    @Transactional
    public void deleteBlockOverride(Long pageId, String key) {
        Optional<CmsBlock> opt = blockRepo.findByPageIdAndKey(pageId, key);
        opt.ifPresent(blockRepo::delete);
    }

    /**
     * For public /api/content?slug= : returns {blocks: {key: value}}
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getPublicContent(String slug) {
        Optional<CmsPage> pageOpt = pageRepo.findBySlug(slug);
        if (pageOpt.isEmpty()) {
            // If page not in DB but slug matches a static file, still return discovered defaults (no overrides)
            // Try to discover from file directly
            Map<String, String> defaults = discoverDefaultsFromStaticFile(slug);
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("slug", slug);
            resp.put("blocks", defaults);
            return resp;
        }
        CmsPage page = pageOpt.get();
        List<Map<String, Object>> discovered = discoverBlocksForPage(page);
        List<CmsBlock> overrides = blockRepo.findByPageId(page.getId());
        Map<String, String> overrideMap = new HashMap<>();
        for (CmsBlock b : overrides) overrideMap.put(b.getKey(), b.getValue());

        Map<String, String> finalBlocks = new LinkedHashMap<>();
        for (Map<String, Object> d : discovered) {
            String k = (String) d.get("key");
            String def = (String) d.get("defaultValue");
            finalBlocks.put(k, overrideMap.getOrDefault(k, def));
        }
        // include orphaned overrides too
        for (CmsBlock ob : overrides) {
            if (!finalBlocks.containsKey(ob.getKey())) {
                finalBlocks.put(ob.getKey(), ob.getValue());
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("slug", slug);
        resp.put("blocks", finalBlocks);
        resp.put("page", Map.of("title", page.getTitle(), "slug", page.getSlug(), "status", page.getStatus()));
        return resp;
    }

    // --- discovery helpers ---

    private List<Map<String, Object>> discoverBlocksForPage(CmsPage page) {
        Map<String, String> defaults = discoverDefaultsFromStaticFile(page.getSlug());
        // Also need to know if html
        Map<String, Boolean> htmlFlags = discoverHtmlFlags(page.getSlug());
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map.Entry<String, String> e : defaults.entrySet()) {
            String key = e.getKey();
            String val = e.getValue();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", key);
            m.put("label", humanize(key));
            m.put("defaultValue", val);
            m.put("html", htmlFlags.getOrDefault(key, false));
            list.add(m);
        }
        return list;
    }

    private String humanize(String key) {
        String s = key.replaceAll("[-_]", " ");
        if (s.isEmpty()) return key;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private Map<String, String> discoverDefaultsFromStaticFile(String slug) {
        Map<String, String> out = new LinkedHashMap<>();
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:static/" + slug);
            if (resources.length == 0) return out;
            Resource r = resources[0];
            if (!r.exists()) return out;
            String html = new String(r.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            // crude parsing: find data-cms="key" ... >content<
            Pattern p = Pattern.compile("data-cms\\s*=\\s*\"([^\"]+)\"[^>]*>(.*?)</", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
            Matcher m = p.matcher(html);
            while (m.find()) {
                String key = m.group(1).trim();
                String inner = m.group(2).trim();
                // strip html tags for plain text default? Keep as is but remove excessive whitespace
                String text = inner.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
                // If element has inner HTML with <br> etc, keep original inner for html blocks
                // For simplicity, if html flag present, keep raw inner, else text
                if (!out.containsKey(key)) {
                    out.put(key, text.isEmpty() ? inner.trim() : text);
                }
            }
            // also single quotes variant
            Pattern p2 = Pattern.compile("data-cms\\s*=\\s*'([^']+)'[^>]*>(.*?)</", Pattern.DOTALL | Pattern.CASE_INSENSITIVE);
            Matcher m2 = p2.matcher(html);
            while (m2.find()) {
                String key = m2.group(1).trim();
                String inner = m2.group(2).trim();
                String text = inner.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
                if (!out.containsKey(key)) out.put(key, text.isEmpty() ? inner.trim() : text);
            }
        } catch (IOException ignored) {
        }
        return out;
    }

    private Map<String, Boolean> discoverHtmlFlags(String slug) {
        Map<String, Boolean> out = new HashMap<>();
        try {
            PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources("classpath:static/" + slug);
            if (resources.length == 0) return out;
            Resource r = resources[0];
            if (!r.exists()) return out;
            String html = new String(r.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            Pattern p = Pattern.compile("<[^>]*data-cms\\s*=\\s*\"([^\"]+)\"[^>]*>", Pattern.CASE_INSENSITIVE);
            Matcher m = p.matcher(html);
            while (m.find()) {
                String whole = m.group(0);
                String key = m.group(1);
                boolean isHtml = whole.toLowerCase().contains("data-cms-html");
                out.put(key, isHtml);
            }
        } catch (IOException ignored) {
        }
        return out;
    }
}
