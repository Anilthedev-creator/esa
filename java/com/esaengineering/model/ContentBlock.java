package com.esaengineering.model;

import jakarta.persistence.*;

// A piece of text on a page that the admin has changed.
// The key matches the data-cms="..." attribute in the html file.
@Entity
@Table(name = "content_blocks",
        uniqueConstraints = @UniqueConstraint(columnNames = {"page_id", "block_key"}))
public class ContentBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "page_id", nullable = false)
    private SitePage page;

    // the data-cms name, eg "hero-intro"
    @Column(name = "block_key", nullable = false)
    private String blockKey;

    // the new text typed by the admin
    @Column(nullable = false, length = 5000)
    private String blockValue;

    public ContentBlock() {
    }

    public ContentBlock(SitePage page, String blockKey, String blockValue) {
        this.page = page;
        this.blockKey = blockKey;
        this.blockValue = blockValue;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public SitePage getPage() {
        return page;
    }

    public void setPage(SitePage page) {
        this.page = page;
    }

    public String getBlockKey() {
        return blockKey;
    }

    public void setBlockKey(String blockKey) {
        this.blockKey = blockKey;
    }

    public String getBlockValue() {
        return blockValue;
    }

    public void setBlockValue(String blockValue) {
        this.blockValue = blockValue;
    }
}
