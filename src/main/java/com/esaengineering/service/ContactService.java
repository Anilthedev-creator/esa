package com.esaengineering.service;

import com.esaengineering.model.Contact;
import com.esaengineering.repository.ContactRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ContactService {

    private final ContactRepository contactRepository;

    public ContactService(ContactRepository contactRepository) {
        this.contactRepository = contactRepository;
    }

    public Contact saveContact(Contact contact) {
        return contactRepository.save(contact);
    }

    public List<Contact> getAllContacts() {
        return contactRepository.findAll();
    }

    public Optional<Contact> getContactById(Long contactId) {
        return contactRepository.findById(contactId);
    }

    public void deleteContact(Long contactId) {
        contactRepository.deleteById(contactId);
    }
}
