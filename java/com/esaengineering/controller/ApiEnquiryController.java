package com.esaengineering.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.model.Contact;
import com.esaengineering.service.ContactService;

// Enquiries from the website contact page (contact.html calls this).
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/enquiries")
public class ApiEnquiryController {

    private final ContactService contactService;

    public ApiEnquiryController(ContactService contactService) {
        this.contactService = contactService;
    }

    // reads a value that can have two different names, eg "message" or "description"
    private String pick(Map<String, String> body, String name1, String name2) {
        String value = body.get(name1);
        if (value == null || value.isBlank()) {
            value = body.get(name2);
        }
        if (value == null) {
            return null;
        }
        return value.trim();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createEnquiry(@RequestBody Map<String, String> body) {
        String name = pick(body, "name", "fullName");
        String email = body.get("email");
        String type = pick(body, "type", "serviceName");
        String message = pick(body, "message", "description");

        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Full name is required"));
        }
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(errorJson("Email is required"));
        }

        Contact contact = new Contact();
        contact.setFullName(name);
        contact.setEmail(email.trim());
        contact.setServiceName(type == null || type.isBlank() ? "General Inquiry" : type);
        contact.setDescription(message == null ? "" : message);

        Contact saved = contactService.saveContact(contact);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Thanks - we've received your request and will be in touch shortly.");
        response.put("id", saved.getContactId());

        return ResponseEntity.status(201).body(response);
    }

    private Map<String, Object> errorJson(String message) {
        Map<String, Object> json = new HashMap<>();
        json.put("message", message);
        return json;
    }
}
