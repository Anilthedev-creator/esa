package com.esaengineering.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A case study the office writes in the admin. The projects page shows the
 * built-in cards plus whichever of these are published.
 */
@Entity
@Table(name = "case_studies")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 200)
    private String title;

    /** water | mining | food | fuel | infra, matches the filter buttons */
    @Column(length = 40)
    private String category;

    @Column(length = 200)
    private String location;

    /** "$80M facility" style chip text */
    @Column(length = 100)
    private String valueLabel;

    @Column(length = 2000)
    private String summary;

    /** image path under static/, e.g. images/project-grain.jpg */
    @Column(length = 300)
    private String image;

    /** draft | published */
    @Column(length = 20)
    private String status = "draft";

    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getValueLabel() { return valueLabel; }
    public void setValueLabel(String valueLabel) { this.valueLabel = valueLabel; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getImage() { return image; }
    public void setImage(String image) { this.image = image; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
