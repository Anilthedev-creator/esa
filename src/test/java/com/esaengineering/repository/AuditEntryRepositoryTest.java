package com.esaengineering.repository;

import com.esaengineering.model.AuditEntry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
class AuditEntryRepositoryTest {

    @Autowired
    private AuditEntryRepository repository;

    @Test
    void savedEntriesCanBeReadNewestFirst() {
        AuditEntry older = entry("customer updated");
        AuditEntry newer = entry("page content updated");
        repository.save(older);
        repository.save(newer);

        List<AuditEntry> entries = repository.findAllByOrderByIdDesc();

        assertEquals(2, entries.size());
        assertEquals("page content updated", entries.get(0).getAction());
        assertEquals("customer updated", entries.get(1).getAction());
    }

    private AuditEntry entry(String action) {
        AuditEntry entry = new AuditEntry();
        entry.setAt(LocalDateTime.now());
        entry.setWho("admin@example.com");
        entry.setAction(action);
        entry.setDetail("saved to the audit table");
        return entry;
    }
}
