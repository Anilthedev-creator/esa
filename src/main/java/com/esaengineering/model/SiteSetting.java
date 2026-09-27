package com.esaengineering.model;

import jakarta.persistence.*;

@Entity
@Table(name = "site_settings")
public class SiteSetting {

    /**
     * Physical columns are setting_key / setting_value, NOT key / value.
     *
     * KEY and VALUE are reserved words in H2 2.x, so Hibernate's unquoted DDL
     * ("create table site_settings (key varchar(255) ...)") is a syntax error.
     * Hibernate logs that failure but does not abort the boot, so the table was
     * silently never created and every read failed with
     * "Table \"site_settings\" not found".
     *
     * The Java field names - and therefore the JSON keys served by the API -
     * are unchanged.
     */
    @Id
    @Column(name = "setting_key")
    private String key;

    @Column(name = "setting_value", length = 2000)
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
