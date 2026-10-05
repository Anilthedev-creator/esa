package com.esaengineering.repository;

import com.esaengineering.model.Contact;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public interface ContactRepository extends JpaRepository<Contact, Long> {

    /** Customer portal: enquiries belonging to one email address. */
    List<Contact> findByEmail(String email);

}
