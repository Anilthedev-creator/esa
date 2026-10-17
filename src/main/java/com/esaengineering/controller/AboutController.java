package com.esaengineering.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.api.AuditLogService;
import com.esaengineering.model.ContentAbout;
import com.esaengineering.service.AboutService;
import com.esaengineering.web.ApiException;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/about")
public class AboutController {

    private final AboutService aboutService;
    private final AdminAccess adminAccess;
    private final AuditLogService auditLog;

    public AboutController(AboutService aboutService, AdminAccess adminAccess, AuditLogService auditLog) {
        this.aboutService = aboutService;
        this.adminAccess = adminAccess;
        this.auditLog = auditLog;
    }

    @GetMapping
    public ContentAbout getAllContents() {
        return aboutService.getAllContents();
    }

    @PutMapping
    public Map<String, Object> saveContents(@RequestBody ContentAbout content,
                                            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveContents(content);
        auditLog.record(auth, "about content updated", changedFields(content));
        return Map.of("message", "Updated", "success", true);
    }

    @GetMapping("/{field}")
    public String getField(@PathVariable String field) {
        switch (field) {
            case "story": return aboutService.getStory();
            case "heading1": return aboutService.getHeading1();
            case "paragraph1": return aboutService.getParagraph1();
            case "heading2": return aboutService.getHeading2();
            case "paragraph2": return aboutService.getParagraph2();
            case "paragraph3": return aboutService.getParagraph3();
            case "specialist1Name": return aboutService.getSpecialist1Name();
            case "specialist1Position": return aboutService.getSpecialist1Position();
            case "specialist1Biography": return aboutService.getSpecialist1Biography();
            case "specialist2Name": return aboutService.getSpecialist2Name();
            case "specialist2Position": return aboutService.getSpecialist2Position();
            case "specialist2Biography": return aboutService.getSpecialist2Biography();
            default: throw ApiException.notFound("About field not found");
        }
    }

    @PutMapping("/{field}")
    public Map<String, Object> saveField(@PathVariable String field, @RequestBody String value,
                                         @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        switch (field) {
            case "story": aboutService.saveStory(value); break;
            case "heading1": aboutService.saveHeading1(value); break;
            case "paragraph1": aboutService.saveParagraph1(value); break;
            case "heading2": aboutService.saveHeading2(value); break;
            case "paragraph2": aboutService.saveParagraph2(value); break;
            case "paragraph3": aboutService.saveParagraph3(value); break;
            case "specialist1Name": aboutService.saveSpecialist1Name(value); break;
            case "specialist1Position": aboutService.saveSpecialist1Position(value); break;
            case "specialist1Biography": aboutService.saveSpecialist1Biography(value); break;
            case "specialist2Name": aboutService.saveSpecialist2Name(value); break;
            case "specialist2Position": aboutService.saveSpecialist2Position(value); break;
            case "specialist2Biography": aboutService.saveSpecialist2Biography(value); break;
            default: throw ApiException.notFound("About field not found");
        }
        auditLog.record(auth, "about content updated", field);
        return Map.of("message", "Updated", "success", true);
    }

    private static String changedFields(ContentAbout content) {
        if (content == null) return "no fields";
        List<String> fields = new ArrayList<>();
        if (content.getStory() != null) fields.add("story");
        if (content.getHeading1() != null) fields.add("heading1");
        if (content.getParagraph1() != null) fields.add("paragraph1");
        if (content.getHeading2() != null) fields.add("heading2");
        if (content.getParagraph2() != null) fields.add("paragraph2");
        if (content.getParagraph3() != null) fields.add("paragraph3");
        if (content.getSpecialist1Name() != null) fields.add("specialist1Name");
        if (content.getSpecialist1Position() != null) fields.add("specialist1Position");
        if (content.getSpecialist1Biography() != null) fields.add("specialist1Biography");
        if (content.getSpecialist2Name() != null) fields.add("specialist2Name");
        if (content.getSpecialist2Position() != null) fields.add("specialist2Position");
        if (content.getSpecialist2Biography() != null) fields.add("specialist2Biography");
        return fields.isEmpty() ? "no fields" : String.join(", ", fields);
    }
}
