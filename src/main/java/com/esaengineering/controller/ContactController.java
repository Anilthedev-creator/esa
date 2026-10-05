package com.esaengineering.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.service.ContactService;
import com.esaengineering.model.Contact;

/**
 * Legacy contact endpoints kept for backwards compatibility.
 *
 * Reads and deletes now require an administrator token, because they expose
 * and can destroy customer enquiries. Prefer /api/enquiries (POST) for the
 * public contact form and /api/admin/** for administration.
 */
@RestController
@RequestMapping("/contact")
@CrossOrigin(origins = "*")
public class ContactController {

    private final ContactService contactService;
    private final AdminAccess adminAccess;

    public ContactController(ContactService contactService, AdminAccess adminAccess) {
        this.contactService = contactService;
        this.adminAccess = adminAccess;
    }

    @PostMapping("/create")
    public Contact createContact(@RequestBody Contact contact,
                                 @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return contactService.saveContact(contact);
    }

    @GetMapping("/get")
    public List<Contact> getContacts(
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        return contactService.getAllContacts();
    }

    @DeleteMapping("/{contactId}")
    public void deleteContact(@PathVariable Long contactId,
                              @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        contactService.deleteContact(contactId);
    }
}
