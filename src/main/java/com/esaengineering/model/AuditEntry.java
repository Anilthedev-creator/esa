package com.esaengineering.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One line of the admin audit trail: who did what, and when. Written by
 * AuditLogService whenever an admin mutation endpoint succeeds.
 */
@Entity
@Table(name = "audit_log")
public class AuditEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime at;

    /** email of the admin who did it, or "unknown" if we cant tell */
    @Column(length = 200)
    private String who;

    /** short label like "case study created" */
    @Column(length = 100)
    private String action;

    /** whatever extra context is handy, like the title or the new status */
    @Column(length = 500)
    private String detail;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getAt() { return at; }
    public void setAt(LocalDateTime at) { this.at = at; }

    public String getWho() { return who; }
    public void setWho(String who) { this.who = who; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
