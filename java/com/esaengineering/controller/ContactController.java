package com.esaengineering.controller;

import java.util.List;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.ContactService;
import com.esaengineering.model.Contact;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/contact")
public class ContactController {

    private final ContactService contactService;

    //Create contact
    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @PostMapping("/create")
    public ResponseEntity<Contact> createContact(@RequestBody Contact contact) {
        Contact saved = contactService.saveContact(contact);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/get")
    public List<Contact> getContacts() {
        return contactService.getAllContacts();
    }

    @GetMapping("/{contactId}")
    public ResponseEntity<Contact> getContactById(@PathVariable("contactId") Long contactId) {
        Optional<Contact> contact = contactService.getContactById(contactId);
        if (contact.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(contact.get());
    }

    @DeleteMapping("/{contactId}")
    public ResponseEntity<String> deleteContact(@PathVariable("contactId") Long contactId) {
        boolean deleted = contactService.deleteContact(contactId);
        if (deleted) {
            return ResponseEntity.ok("Contact deleted successfully");
        }
        return ResponseEntity.status(404).body("Contact not found");
    }
}
