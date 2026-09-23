package com.esaengineering.controller;

import java.util.List;



import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.ContactService;
import com.esaengineering.model.Contact;

@RestController
@RequestMapping("/contact")
public class ContactController{

  
    private final ContactService contactService;



    //Create contact
    
    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @PostMapping("/create")
     public Contact createContact(@RequestBody Contact contact){
       return contactService.saveContact(contact);


     }



     @GetMapping("/get")
     public List<Contact>  getContacts(){

        
         return contactService.getAllContacts();
     }

     @DeleteMapping("/{contactId}")
     public void deleteContact(@PathVariable Long contactID){

         contactService.deleteContact(contactID);


     }


    











}