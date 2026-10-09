package com.esaengineering.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.esaengineering.model.AuditEntry;

public interface AuditEntryRepository extends JpaRepository<AuditEntry, Long> {
    // newest first, the audit page shows the top of this
    List<AuditEntry> findAllByOrderByIdDesc();
}
