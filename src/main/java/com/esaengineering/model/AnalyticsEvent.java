package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "analytics_events")
public class AnalyticsEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String page;

    private String referrer;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public AnalyticsEvent() {}
    public AnalyticsEvent(String page, String referrer) {
        this.page = page;
        this.referrer = referrer;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getPage() { return page; }
    public void setPage(String page) { this.page = page; }
    public String getReferrer() { return referrer; }
    public void setReferrer(String referrer) { this.referrer = referrer; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
