package com.esaengineering.api;

import com.esaengineering.model.Booking;
import com.esaengineering.model.Contact;
import com.esaengineering.model.Payment;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.security.TokenService;
import com.esaengineering.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApiPublicControllerTest {

    @Mock BookingRepository bookingRepo;
    @Mock ContactRepository contactRepo;
    @Mock PaymentRepository paymentRepo;
    @Mock EnquiryEmailService enquiryEmailService;

    private ApiPublicController controller;
    private TokenService tokens;
    private String aliceToken;
    private String bobToken;

    @BeforeEach
    void setUp() {
        tokens = new TokenService("test-token-secret-for-api-controller", 1);
        PortalAccess portalAccess = new PortalAccess(tokens);
        controller = new ApiPublicController(
                bookingRepo, contactRepo, paymentRepo, new AdminAccess(tokens), portalAccess,
                new BigDecimal("50.00"), false, true, enquiryEmailService);
        aliceToken = "Bearer " + tokens.issue(1L, "alice@example.com", "CUSTOMER");
        bobToken = "Bearer " + tokens.issue(2L, "bob@example.com", "CUSTOMER");
    }

    @Test
    void bookingRequiresSessionAndUsesTheSessionEmail() {
        assertEquals(401, assertThrows(ApiException.class,
                () -> controller.createBooking(Map.of("name", "Alice", "email", "bob@example.com"), null))
                .getStatus().value());
        verifyNoInteractions(bookingRepo, paymentRepo);

        when(bookingRepo.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            booking.setBookingID(7L);
            return booking;
        });
        when(paymentRepo.save(any(Payment.class))).thenAnswer(invocation -> {
            Payment payment = invocation.getArgument(0);
            payment.setPaymentId(11L);
            return payment;
        });

        Map<String, Object> body = new HashMap<>();
        body.put("name", "Alice Customer");
        body.put("email", "bob@example.com"); // must not override the signed-in account
        body.put("service", "Plant Commissioning");
        body.put("preferredSlot", "10:00");
        body.put("preferredDate", LocalDate.now(BookingSchedule.ZONE).plusDays(1).toString());
        Map<String, Object> response = controller.createBooking(body, aliceToken);

        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepo).save(saved.capture());
        assertEquals("alice@example.com", saved.getValue().getEmail());
        assertEquals("10:00", saved.getValue().getPreferredSlot());
        assertEquals(LocalDate.now(BookingSchedule.ZONE).plusDays(1), saved.getValue().getBookingDate());
        assertEquals(7L, ((Map<?, ?>) response.get("booking")).get("id"));
    }

    @Test
    void bookingRejectsTimesOutsideTheHalfHourSchedule() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Alice Customer");
        body.put("preferredDate", LocalDate.now(BookingSchedule.ZONE).plusDays(1).toString());
        body.put("preferredSlot", "09:15");
        assertEquals(400, assertThrows(ApiException.class,
                () -> controller.createBooking(body, aliceToken)).getStatus().value());
        verifyNoInteractions(bookingRepo, paymentRepo);
    }

    @Test
    void enquirySendsAutomaticAcknowledgementAndTeamNoticeWhenConfigured() {
        when(contactRepo.save(any(Contact.class))).thenAnswer(invocation -> {
            Contact contact = invocation.getArgument(0);
            contact.setContactId(14L);
            return contact;
        });
        when(enquiryEmailService.notifyEnquiry(any(Contact.class))).thenReturn(Map.of(
                "customerAcknowledgement", "sent",
                "teamNotification", "sent",
                "message", "Thanks — your enquiry is recorded. A confirmation email has been sent and the ESA team has been notified."));

        Map<String, Object> response = controller.createEnquiry(Map.of(
                "name", "Alice Customer", "email", "alice@example.com", "message", "Please call me."));

        assertEquals(14L, ((Map<?, ?>) response.get("enquiry")).get("id"));
        assertEquals("sent", ((Map<?, ?>) response.get("emailDelivery")).get("customerAcknowledgement"));
        verify(enquiryEmailService).notifyEnquiry(any(Contact.class));
    }

    @Test
    void bookingDetailIsOnlyVisibleToItsOwner() {
        Booking booking = booking("alice@example.com", 7L);
        when(bookingRepo.findByBookingId(7L)).thenReturn(Optional.of(booking));

        assertEquals(404, assertThrows(ApiException.class,
                () -> controller.getBooking(7L, bobToken)).getStatus().value());
        assertEquals(401, assertThrows(ApiException.class,
                () -> controller.getBooking(7L, null)).getStatus().value());
        assertEquals("alice@example.com", ((Map<?, ?>) controller.getBooking(7L, aliceToken).get("booking")).get("email"));
    }

    @Test
    void paymentCannotBeReadOrChangedByAnotherCustomer() {
        Payment payment = payment("incomplete");
        when(paymentRepo.findById(11L)).thenReturn(Optional.of(payment));
        when(bookingRepo.findByBookingId(7L)).thenReturn(Optional.of(booking("alice@example.com", 7L)));

        assertEquals(404, assertThrows(ApiException.class,
                () -> controller.getPayment(11L, bobToken)).getStatus().value());
        assertEquals(404, assertThrows(ApiException.class,
                () -> controller.confirmPayment(11L, Map.of("transferReference", "private"), bobToken))
                .getStatus().value());
        assertEquals(404, assertThrows(ApiException.class,
                () -> controller.cardPayment(11L, cardBody(), bobToken)).getStatus().value());
        verify(paymentRepo, never()).save(any(Payment.class));
    }

    @Test
    void transferIsRecordedOnceAndBlocksTheSandboxCardRoute() {
        Payment payment = payment("incomplete");
        Booking booking = booking("alice@example.com", 7L);
        when(paymentRepo.findById(11L)).thenReturn(Optional.of(payment));
        when(bookingRepo.findByBookingId(7L)).thenReturn(Optional.of(booking));
        when(paymentRepo.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> first = controller.confirmPayment(11L,
                Map.of("transferReference", "BANK-RECEIPT-1", "paidDate", LocalDate.now().toString()), aliceToken);
        assertEquals("pending", first.get("status"));
        assertEquals("pending", payment.getStatus());
        assertEquals("transfer", payment.getMethod());
        assertEquals("BANK-RECEIPT-1", payment.getTransferReference());

        Map<String, Object> retry = controller.confirmPayment(11L,
                Map.of("transferReference", "BANK-RECEIPT-2", "paidDate", LocalDate.now().toString()), aliceToken);
        assertEquals("pending", retry.get("status"));
        assertEquals("BANK-RECEIPT-1", payment.getTransferReference());

        ApiException card = assertThrows(ApiException.class,
                () -> controller.cardPayment(11L, cardBody(), aliceToken));
        assertEquals(409, card.getStatus().value());
        assertEquals("pending", payment.getStatus());
        assertNull(payment.getCardLast4());
        verify(paymentRepo, times(1)).save(payment);
    }

    @Test
    void sandboxCardSavesOnlyLastFourAndConfirmsTheBooking() {
        Payment payment = payment("incomplete");
        Booking booking = booking("alice@example.com", 7L);
        when(paymentRepo.findById(11L)).thenReturn(Optional.of(payment));
        when(bookingRepo.findByBookingId(7L)).thenReturn(Optional.of(booking));
        when(paymentRepo.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(bookingRepo.save(any(Booking.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = controller.cardPayment(11L, cardBody(), aliceToken);
        assertEquals("completed", result.get("status"));
        assertEquals("4242", result.get("cardLast4"));
        assertEquals("completed", payment.getStatus());
        assertEquals("card", payment.getMethod());
        assertEquals("4242", payment.getCardLast4());
        assertEquals("confirmed", booking.getStatus());

        Map<?, ?> safeDetails = (Map<?, ?>) controller.getPayment(11L, aliceToken).get("payment");
        assertFalse(safeDetails.containsKey("cardNumber"));
        assertFalse(safeDetails.containsKey("cardCvv"));
        assertEquals("4242", safeDetails.get("cardLast4"));
    }

    private static Map<String, Object> cardBody() {
        int month = LocalDate.now().plusYears(5).getMonthValue();
        int year = LocalDate.now().plusYears(5).getYear() % 100;
        return Map.of(
                "cardName", "Alice Customer",
                "cardNumber", "4242 4242 4242 4242",
                "cardExpiry", String.format("%02d/%02d", month, year),
                "cardCvv", "123");
    }

    private static Booking booking(String email, long id) {
        Booking booking = new Booking();
        booking.setBookingID(id);
        booking.setEmail(email);
        booking.setFullName("Alice Customer");
        booking.setServiceName("Plant Commissioning");
        booking.setStatus("pending");
        booking.setBookingDate(LocalDate.now());
        booking.setCreatedAt(LocalDateTime.now());
        return booking;
    }

    private static Payment payment(String status) {
        Payment payment = new Payment();
        payment.setPaymentId(11L);
        payment.setBookingId(7L);
        payment.setTransactionId("ESA-7-TEST1234");
        payment.setCustomerName("Alice Customer");
        payment.setAmount(new BigDecimal("50.00"));
        payment.setStatus(status);
        return payment;
    }
}
