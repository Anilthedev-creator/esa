package com.esaengineering.service;

import com.esaengineering.model.AnalyticsEvent;
import com.esaengineering.repository.AnalyticsEventRepository;
import com.esaengineering.repository.ContactRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class AnalyticsService {

    private final AnalyticsEventRepository eventRepo;
    private final ContactRepository contactRepo;

    public AnalyticsService(AnalyticsEventRepository eventRepo, ContactRepository contactRepo) {
        this.eventRepo = eventRepo;
        this.contactRepo = contactRepo;
    }

    @Transactional
    public AnalyticsEvent track(String page, String referrer) {
        if (page == null || page.isBlank()) page = "index.html";
        AnalyticsEvent e = new AnalyticsEvent(page.trim(), referrer);
        return eventRepo.save(e);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getActivity(int days) {
        if (days <= 0) days = 7;
        if (days > 90) days = 90;
        LocalDate today = LocalDate.now();
        LocalDate start = today.minusDays(days - 1);

        List<AnalyticsEvent> allEvents = eventRepo.findAll();
        long contactCount = contactRepo.count();

        // Group events by date
        Map<LocalDate, Long> visitsByDate = new HashMap<>();
        // Contact has no per-row timestamp, so a true per-day enquiry series
        // is not derivable from the current schema. It stays at 0 rather than
        // being faked; contactCount is still reported as the total below.
        Map<LocalDate, Long> enquiriesByDate = new HashMap<>();

        for (AnalyticsEvent ev : allEvents) {
            if (ev.getCreatedAt() == null) continue;
            LocalDate d = ev.getCreatedAt().toLocalDate();
            if (d.isBefore(start) || d.isAfter(today)) continue;
            visitsByDate.merge(d, 1L, Long::sum);
        }

        // Days with no recorded visits show as 0. We deliberately do NOT invent
        // numbers: a chart full of Math.random() looked plausible but was
        // fiction, which is worse than an empty chart.
        List<Map<String, Object>> series = new ArrayList<>();
        for (int i = 0; i < days; i++) {
            LocalDate d = start.plusDays(i);
            long visits = visitsByDate.getOrDefault(d, 0L);
            long enquiries = enquiriesByDate.getOrDefault(d, 0L);
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", d.toString());
            point.put("visits", visits);
            point.put("enquiries", enquiries);
            series.add(point);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("days", days);
        resp.put("series", series);
        resp.put("totalVisits", series.stream().mapToLong(m -> (Long) m.get("visits")).sum());
        resp.put("totalEnquiries", contactCount);
        return resp;
    }
}
