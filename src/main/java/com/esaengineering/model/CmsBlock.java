package com.esaengineering.model;

import jakarta.persistence.*;

@Entity
@Table(name = "cms_blocks", uniqueConstraints = @UniqueConstraint(columnNames = {"page_id", "block_key"}))
public class CmsBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "page_id", nullable = false)
    private CmsPage page;

    @Column(name = "block_key", nullable = false)
    private String key;

    @Column(length = 2000)
    private String label;

    @Column(length = 10000)
    private String value;

    @Column(length = 10000)
    private String defaultValue;

    @Column(name = "is_html")
    private boolean html = false;

    public CmsBlock() {}

    public CmsBlock(CmsPage page, String key, String label, String value, String defaultValue, boolean html) {
        this.page = page;
        this.key = key;
        this.label = label;
        this.value = value;
        this.defaultValue = defaultValue;
        this.html = html;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CmsPage getPage() { return page; }
    public void setPage(CmsPage page) { this.page = page; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getDefaultValue() { return defaultValue; }
    public void setDefaultValue(String defaultValue) { this.defaultValue = defaultValue; }
    public boolean isHtml() { return html; }
    public void setHtml(boolean html) { this.html = html; }
}
