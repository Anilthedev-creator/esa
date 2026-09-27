package com.esaengineering.repository;

import com.esaengineering.model.AnalyticsEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long> {
    List<AnalyticsEvent> findByCreatedAtAfter(LocalDateTime after);
    long countByCreatedAtAfter(LocalDateTime after);
}
