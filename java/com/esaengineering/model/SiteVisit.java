package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// One row every time someone opens a public page.
// The analytics page counts these rows per day.
@Entity
@Table(name = "site_visits")
public class SiteVisit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // which page was opened, eg "index.html"
    @Column(nullable = false)
    private String page;

    @Column(nullable = false)
    private LocalDateTime visitedAt;

    public SiteVisit() {
    }

    public SiteVisit(String page, LocalDateTime visitedAt) {
        this.page = page;
        this.visitedAt = visitedAt;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPage() {
        return page;
    }

    public void setPage(String page) {
        this.page = page;
    }

    public LocalDateTime getVisitedAt() {
        return visitedAt;
    }

    public void setVisitedAt(LocalDateTime visitedAt) {
        this.visitedAt = visitedAt;
    }
}
