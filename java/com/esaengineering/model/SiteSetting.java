package com.esaengineering.model;

import jakarta.persistence.*;

// Simple key/value settings for the website,
// edited on the admin settings page.
@Entity
@Table(name = "site_settings")
public class SiteSetting {

    @Id
    @Column(nullable = false)
    private String settingKey;

    @Column(length = 1000)
    private String settingValue;

    public SiteSetting() {
    }

    public SiteSetting(String settingKey, String settingValue) {
        this.settingKey = settingKey;
        this.settingValue = settingValue;
    }

    public String getSettingKey() {
        return settingKey;
    }

    public void setSettingKey(String settingKey) {
        this.settingKey = settingKey;
    }

    public String getSettingValue() {
        return settingValue;
    }

    public void setSettingValue(String settingValue) {
        this.settingValue = settingValue;
    }
}
