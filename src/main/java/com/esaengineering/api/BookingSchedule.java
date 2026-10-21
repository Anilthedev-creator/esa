package com.esaengineering.api;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

/** Shared booking times and the 90-minute rescheduling rule. */
final class BookingSchedule {

    static final ZoneId ZONE = ZoneId.of("Australia/Melbourne");
    static final long RESCHEDULE_CUTOFF_MINUTES = 90;
    private static final Set<String> TIME_SLOTS = buildTimeSlots();

    private BookingSchedule() {}

    static Set<String> timeSlots() {
        return TIME_SLOTS;
    }

    static boolean isAllowedSlot(String slot) {
        return slot != null && TIME_SLOTS.contains(slot);
    }

    static Instant slotTime(LocalDate date, String slot) {
        if (date == null || !isAllowedSlot(slot)) return null;
        return LocalDateTime.of(date, LocalTime.parse(slot)).atZone(ZONE).toInstant();
    }

    static boolean isUpcoming(LocalDate date, String slot, Instant now) {
        if (date == null) return false;
        LocalTime requestedTime = isAllowedSlot(slot) ? LocalTime.parse(slot) : LocalTime.of(17, 0);
        Instant requestedStart = LocalDateTime.of(date, requestedTime).atZone(ZONE).toInstant();
        return requestedStart.isAfter(now);
    }

    /**
     * Old bookings without a saved time use 5:00 pm as their reference point.
     * Their reschedule cutoff is therefore 3:30 pm Melbourne time on that day.
     */
    static Instant cutoff(LocalDate date, String slot) {
        if (date == null) return null;
        LocalTime referenceTime = isAllowedSlot(slot) ? LocalTime.parse(slot) : LocalTime.of(17, 0);
        return LocalDateTime.of(date, referenceTime).atZone(ZONE).toInstant()
                .minus(Duration.ofMinutes(RESCHEDULE_CUTOFF_MINUTES));
    }

    static boolean cutoffReached(LocalDate date, String slot, Instant now) {
        Instant cutoff = cutoff(date, slot);
        return cutoff == null || !now.isBefore(cutoff);
    }

    static boolean canReschedule(String status, LocalDate date, String slot, Instant now) {
        String currentStatus = status == null ? "pending" : status.trim().toLowerCase();
        return ("pending".equals(currentStatus) || "confirmed".equals(currentStatus))
                && !cutoffReached(date, slot, now);
    }

    private static Set<String> buildTimeSlots() {
        Set<String> slots = new LinkedHashSet<>();
        for (int minutes = 9 * 60; minutes < 17 * 60; minutes += 30) {
            slots.add(String.format("%02d:%02d", minutes / 60, minutes % 60));
        }
        return Collections.unmodifiableSet(slots);
    }
}
