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
    void rescheduleCanClearASlotButRejectsAnInvalidSlot() {
        PortalService service = new PortalService(userRepository, bookingRepository, contactRepository, paymentRepository);
        Booking booking = new Booking();
        booking.setBookingID(10L);
        booking.setEmail("alice@example.com");
        booking.setFullName("Alice");
        booking.setServiceName("Plant Commissioning");
        booking.setBookingDate(LocalDate.now());
        booking.setPreferredSlot("10:00");
        booking.setStatus("pending");
        when(bookingRepository.findByBookingId(10L)).thenReturn(Optional.of(booking));
        when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(paymentRepository.findFirstByBookingId(10L)).thenReturn(Optional.empty());

        service.reschedule("alice@example.com", 10L, LocalDate.now().plusDays(1).toString(), "");
        assertEquals("", booking.getPreferredSlot());
        ApiException error = assertThrows(ApiException.class,
                () -> service.reschedule("alice@example.com", 10L, null, "25:00"));
        assertEquals(400, error.getStatus().value());
    }
}
