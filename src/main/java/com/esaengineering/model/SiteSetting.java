package com.esaengineering.model;

import jakarta.persistence.*;

@Entity
@Table(name = "site_settings")
public class SiteSetting {

    @Id
    private String key;

    @Column(length = 2000)
    private String value;

    public SiteSetting() {}
    public SiteSetting(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
}
