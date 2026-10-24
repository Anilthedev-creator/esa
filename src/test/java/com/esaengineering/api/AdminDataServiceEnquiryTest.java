package com.esaengineering.api;

import com.esaengineering.model.Contact;
import com.esaengineering.repository.BookingRepository;
import com.esaengineering.repository.ContactRepository;
import com.esaengineering.repository.PaymentRepository;
import com.esaengineering.repository.UserRepository;
import com.esaengineering.web.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminDataServiceEnquiryTest {

    private final ContactRepository contactRepository = mock(ContactRepository.class);
    private AdminDataService service;

    @BeforeEach
    void setUp() {
        service = new AdminDataService(
                mock(BookingRepository.class), contactRepository,
                mock(PaymentRepository.class), mock(UserRepository.class));
    }

    @Test
    void startsAnEnquiryOnceAndLeavesItInProgress() {
        Contact contact = enquiry("new");
        when(contactRepository.findById(1L)).thenReturn(Optional.of(contact));

        Map<String, Object> result = service.startEnquiry(1L);
        assertEquals("in-progress", result.get("status"));

        service.startEnquiry(1L);
        verify(contactRepository, times(1)).save(contact);
    }

    @Test
    void replyTextResolvesAnEnquiryAndBlankReplyKeepsItInProgress() {
        Contact contact = enquiry("in-progress");
        when(contactRepository.findById(1L)).thenReturn(Optional.of(contact));

        Map<String, Object> resolved = service.updateEnquiry(1L, Map.of("reply", "  Thanks for your message.  "));
        assertEquals("resolved", resolved.get("status"));
        assertEquals("Thanks for your message.", resolved.get("reply"));

        Map<String, Object> inProgress = service.updateEnquiry(1L, Map.of("reply", "  "));
        assertEquals("in-progress", inProgress.get("status"));
        assertNull(inProgress.get("reply"));
        verify(contactRepository, times(2)).save(contact);
    }

    @Test
    void rejectsManualStatusesAndMissingReplies() {
        Contact contact = enquiry("new");
        when(contactRepository.findById(1L)).thenReturn(Optional.of(contact));

        ApiException statusError = assertThrows(ApiException.class,
                () -> service.updateEnquiry(1L, Map.of("status", "resolved", "reply", "A reply")));
        assertEquals(400, statusError.getStatus().value());

        ApiException replyError = assertThrows(ApiException.class,
                () -> service.updateEnquiry(1L, Map.of("message", "not a reply")));
        assertEquals(400, replyError.getStatus().value());
        verify(contactRepository, never()).save(contact);
    }

    private Contact enquiry(String status) {
        Contact contact = new Contact(1L, "Alice Customer", "alice@example.com", "General", "Please help");
        contact.setStatus(status);
        return contact;
    }
}
