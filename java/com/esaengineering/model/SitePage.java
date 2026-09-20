package com.esaengineering.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

// One row for every public page of the website, eg index.html.
// The admin content page shows this list.
@Entity
@Table(name = "site_pages")
public class SitePage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // page title shown in the admin list, eg "Home"
    @Column(nullable = false)
    private String title;

    // file name of the page, eg "index.html"
    @Column(nullable = false, unique = true)
    private String slug;

    // published or draft
    @Column(nullable = false)
    private String status = "published";

    private LocalDateTime updatedAt;

    public SitePage() {
    }

    public SitePage(String title, String slug, String status) {
        this.title = title;
        this.slug = slug;
        this.status = status;
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
