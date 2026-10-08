package com.esaengineering.api;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import com.esaengineering.model.Project;
import com.esaengineering.repository.ProjectRepository;
import com.esaengineering.web.ApiException;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Case studies: public list for the projects page plus the admin CRUD the
 * caseStudies.html page calls. Mirrors the /api/projects routes in server.js.
 */
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class ApiProjectsController {

    private final ProjectRepository projectRepo;
    private final AdminAccess adminAccess;

    public ApiProjectsController(ProjectRepository projectRepo, AdminAccess adminAccess) {
        this.projectRepo = projectRepo;
        this.adminAccess = adminAccess;
    }

    /** Published case studies, newest first. */
    @GetMapping("/projects")
    public Map<String, Object> list() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projects", projectRepo.findByStatus("published"));
        return out;
    }

    /** Admin list, drafts included. */
    @GetMapping("/admin/projects")
    public Map<String, Object> listAll(@RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("projects", projectRepo.findAll());
        return out;
    }

    @PostMapping("/admin/projects")
    public Map<String, Object> create(@RequestBody Map<String, Object> body,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        String title = text(body, "title");
        if (title == null) throw ApiException.badRequest("Title is required");
        Project p = new Project();
        apply(p, body);
        p.setCreatedAt(LocalDateTime.now());
        p = projectRepo.save(p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("project", p);
        out.put("message", "Case study saved");
        out.put("success", true);
        return out;
    }

    @PatchMapping("/admin/projects/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        Project p = projectRepo.findById(id).orElseThrow(() -> ApiException.notFound("Case study not found"));
        apply(p, body);
        p = projectRepo.save(p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("project", p);
        out.put("message", "Case study updated");
        out.put("success", true);
        return out;
    }

    @DeleteMapping("/admin/projects/{id}")
    public Map<String, Object> remove(@PathVariable Long id,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        if (!projectRepo.existsById(id)) throw ApiException.notFound("Case study not found");
        projectRepo.deleteById(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", "Case study deleted");
        out.put("success", true);
        return out;
    }

    // copy whatever the form sent over onto the entity
    private void apply(Project p, Map<String, Object> body) {
        if (body.containsKey("title")) p.setTitle(text(body, "title"));
        if (body.containsKey("category")) p.setCategory(text(body, "category"));
        if (body.containsKey("location")) p.setLocation(text(body, "location"));
        if (body.containsKey("valueLabel")) p.setValueLabel(text(body, "valueLabel"));
        if (body.containsKey("summary")) p.setSummary(text(body, "summary"));
        if (body.containsKey("image")) p.setImage(text(body, "image"));
        if (body.containsKey("status")) p.setStatus(text(body, "status"));
    }

    private static String text(Map<String, Object> body, String key) {
        if (body == null) return null;
        Object v = body.get(key);
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
}
