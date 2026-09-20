package com.esaengineering.repository;

import com.esaengineering.model.SiteVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SiteVisitRepository extends JpaRepository<SiteVisit, Long> {

    // all visits after a date, used to build the analytics chart
    List<SiteVisit> findByVisitedAtAfter(LocalDateTime date);
}
