package com.esaengineering.api;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class BookingScheduleTest {

    @Test
    void offersEveryHalfHourFromNineUntilTheLastSlotBeforeFive() {
        List<String> slots = new ArrayList<>(BookingSchedule.timeSlots());
        assertEquals(16, slots.size());
        assertEquals("09:00", slots.get(0));
        assertEquals("09:30", slots.get(1));
        assertEquals("16:00", slots.get(14));
        assertEquals("16:30", slots.get(15));
        assertFalse(BookingSchedule.isAllowedSlot("08:30"));
        assertFalse(BookingSchedule.isAllowedSlot("09:15"));
        assertFalse(BookingSchedule.isAllowedSlot("17:00"));
    }

    @Test
    void closesReschedulingAtNinetyMinutesBeforeTheRequestedTime() {
        LocalDate date = LocalDate.of(2026, 10, 22);
        Instant cutoff = LocalDateTime.of(date, LocalTime.of(10, 0))
                .atZone(BookingSchedule.ZONE).toInstant().minusSeconds(90 * 60L);
        assertFalse(BookingSchedule.cutoffReached(date, "10:00", cutoff.minusMillis(1)));
        assertTrue(BookingSchedule.cutoffReached(date, "10:00", cutoff));
        assertTrue(BookingSchedule.canReschedule("pending", date, "10:00", cutoff.minusMillis(1)));
        assertFalse(BookingSchedule.canReschedule("pending", date, "10:00", cutoff));
    }

    @Test
    void dashboardCountsOnlyAppointmentsThatHaveNotStartedYet() {
        LocalDate date = LocalDate.of(2026, 10, 22);
        Instant start = BookingSchedule.slotTime(date, "10:00");
        assertTrue(BookingSchedule.isUpcoming(date, "10:00", start.minusMillis(1)));
        assertFalse(BookingSchedule.isUpcoming(date, "10:00", start));
        assertTrue(BookingSchedule.isUpcoming(date, "", LocalDateTime.of(date, LocalTime.of(16, 59))
                .atZone(BookingSchedule.ZONE).toInstant()));
        assertFalse(BookingSchedule.isUpcoming(date, "", LocalDateTime.of(date, LocalTime.of(17, 0))
                .atZone(BookingSchedule.ZONE).toInstant()));
    }

    @Test
    void legacyBookingsWithoutATimeUseTheFivePmClose() {
        LocalDate date = LocalDate.of(2026, 10, 22);
        Instant cutoff = LocalDateTime.of(date, LocalTime.of(15, 30))
                .atZone(BookingSchedule.ZONE).toInstant();
        assertEquals(cutoff, BookingSchedule.cutoff(date, ""));
    }
}
