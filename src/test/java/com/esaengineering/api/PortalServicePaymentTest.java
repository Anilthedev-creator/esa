package com.esaengineering.api;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Payment;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.web.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PortalServicePaymentTest {

    @Mock UserRepository userRepository;
    @Mock BookingRepository bookingRepository;
    @Mock ContactRepository contactRepository;
    @Mock PaymentRepository paymentRepository;

    @Test
    void aLoggedTransferCannotBeCancelledOrPresentedAsPayableAgain() {
        PortalService service = new PortalService(userRepository, bookingRepository, contactRepository, paymentRepository);
        Booking booking = new Booking();
        booking.setBookingID(9L);
        booking.setEmail("alice@example.com");
        booking.setFullName("Alice");
        booking.setServiceName("Plant Commissioning");
        booking.setBookingDate(LocalDate.now());
        booking.setStatus("pending");

        Payment payment = new Payment();
        payment.setPaymentId(19L);
        payment.setBookingId(9L);
        payment.setAmount(new BigDecimal("50.00"));
        payment.setStatus("pending");
        payment.setMethod("transfer");
        payment.setTransferReference("BANK-RECEIPT-1");

        when(bookingRepository.findByBookingId(9L)).thenReturn(Optional.of(booking));
        when(paymentRepository.findFirstByBookingId(9L)).thenReturn(Optional.of(payment));
        ApiException cancelError = assertThrows(ApiException.class,
                () -> service.cancelBooking("alice@example.com", 9L));
        assertEquals(400, cancelError.getStatus().value());
        verify(bookingRepository, never()).save(any(Booking.class));

        when(bookingRepository.findByEmail("alice@example.com")).thenReturn(List.of(booking));
        Map<String, Object> summary = service.bookings("alice@example.com").get(0);
        assertEquals(false, summary.get("canPay"));
        assertEquals(false, summary.get("canCancel"));
    }

    @Test
    void rescheduleCutoffStartsAtNinetyMinutesBeforeTheBookedTime() {
        Booking booking = new Booking();
        booking.setBookingDate(LocalDate.of(2026, 6, 11));
        booking.setPreferredSlot("11:30");
        ZoneId zone = ZoneId.of("Australia/Melbourne");
        ZonedDateTime now = ZonedDateTime.of(2026, 6, 11, 10, 0, 0, 0, zone);

        assertTrue(PortalService.rescheduleCutoffPassed(booking, now));
        booking.setPreferredSlot("12:00");
        assertFalse(PortalService.rescheduleCutoffPassed(booking, now));
    }

    @Test
    void customerCannotRescheduleOnceTheCutoffHasPassed() {
        PortalService service = new PortalService(userRepository, bookingRepository, contactRepository, paymentRepository);
        Booking booking = new Booking();
        booking.setBookingID(11L);
        booking.setEmail("alice@example.com");
        booking.setBookingDate(LocalDate.now(ZoneId.of("Australia/Melbourne")).minusDays(1));
        booking.setPreferredSlot("10:00");
        booking.setStatus("pending");
        when(bookingRepository.findByBookingId(11L)).thenReturn(Optional.of(booking));

        ApiException error = assertThrows(ApiException.class,
                () -> service.reschedule("alice@example.com", 11L, LocalDate.now().plusDays(1).toString(), "09:30"));

        assertEquals(400, error.getStatus().value());
        verify(bookingRepository, never()).save(any(Booking.class));
    }

    @Test
    void rescheduleCanClearASlotButRejectsAnInvalidSlot() {
        PortalService service = new PortalService(userRepository, bookingRepository, contactRepository, paymentRepository);
        Booking booking = new Booking();
        booking.setBookingID(10L);
        booking.setEmail("alice@example.com");
        booking.setFullName("Alice");
        booking.setServiceName("Plant Commissioning");
        LocalDate tomorrow = LocalDate.now(ZoneId.of("Australia/Melbourne")).plusDays(1);
        booking.setBookingDate(tomorrow.plusDays(1));
        booking.setPreferredSlot("10:00");
        booking.setStatus("pending");
        when(bookingRepository.findByBookingId(10L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentRepository.findFirstByBookingId(10L)).thenReturn(Optional.empty());

        service.reschedule("alice@example.com", 10L, tomorrow.toString(), "09:30");
        assertEquals("09:30", booking.getPreferredSlot());
        service.reschedule("alice@example.com", 10L, tomorrow.toString(), "");
        assertEquals("", booking.getPreferredSlot());
        ApiException error = assertThrows(ApiException.class,
                () -> service.reschedule("alice@example.com", 10L, null, "09:15"));
        assertEquals(400, error.getStatus().value());
    }
}
