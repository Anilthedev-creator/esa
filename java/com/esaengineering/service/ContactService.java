package com.esaengineering.service;

import com.esaengineering.model.Contact;
import com.esaengineering.repository.ContactRepository;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ContactService {

     private final ContactRepository contactRepository;

     public ContactService(ContactRepository contactRepository) {
         this.contactRepository = contactRepository;
     }

     public Contact saveContact(Contact contact) {

         if (contact.getFullName() == null || contact.getFullName().isBlank()) {
             throw new IllegalArgumentException("Full name is required");
         }
         if (contact.getEmail() == null || contact.getEmail().isBlank()) {
             throw new IllegalArgumentException("Email is required");
         }
         if (contact.getServiceName() == null || contact.getServiceName().isBlank()) {
             contact.setServiceName("General Inquiry");
         }
         if (contact.getDescription() == null) {
             contact.setDescription("");
         }
         if (contact.getStatus() == null || contact.getStatus().isBlank()) {
             contact.setStatus("new");
         }
         if (contact.getCreatedAt() == null) {
             contact.setCreatedAt(LocalDateTime.now());
         }

         return contactRepository.save(contact);
     }

     public List<Contact> getAllContacts() {
        return contactRepository.findAll();
     }

     public Optional<Contact> getContactById(Long contactId) {
        return contactRepository.findById(contactId);
     }

     // returns false when there is nothing to delete
     public boolean deleteContact(Long contactId) {
        if (!contactRepository.existsById(contactId)) {
            return false;
        }
        contactRepository.deleteById(contactId);
        return true;
     }
}
