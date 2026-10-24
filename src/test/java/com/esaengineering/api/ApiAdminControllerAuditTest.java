package com.esaengineering.api;

import com.esaengineering.service.CmsService;
import com.esaengineering.service.SettingsService;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ApiAdminControllerAuditTest {

    private final AdminDataService adminService = mock(AdminDataService.class);
    private final CmsService cmsService = mock(CmsService.class);
    private final SettingsService settingsService = mock(SettingsService.class);
    private final AuditLogService auditLog = mock(AuditLogService.class);
    private final AdminAccess adminAccess = mock(AdminAccess.class);
    private final ApiAdminController controller = new ApiAdminController(
            adminService, cmsService, settingsService, adminAccess, auditLog);

    @Test
    void customerChangesAreAuditedAfterTheySave() {
        Map<String, Object> body = Map.of("phone", "0400000000");
        when(adminService.updateCustomer(4L, body)).thenReturn(Map.of("id", 4L));

        controller.patchCustomer(4L, body, "Bearer admin-token");

        verify(adminAccess).requireAdmin("Bearer admin-token");
        verify(adminService).updateCustomer(4L, body);
        verify(auditLog).record("Bearer admin-token", "customer updated", "#4 fields: phone");
    }

    @Test
    void startingAnEnquiryChangesItsStatusAndCreatesAnAuditEntry() {
        when(adminService.enquiryById(5L)).thenReturn(Map.of("id", 5L, "status", "new"));
        when(adminService.startEnquiry(5L)).thenReturn(Map.of("id", 5L, "status", "in-progress"));

        Map<String, Object> result = controller.startEnquiry(5L, "Bearer admin-token");

        assertEquals("in-progress", ((Map<?, ?>) result.get("enquiry")).get("status"));
        assertEquals(true, result.get("statusChanged"));
        verify(adminAccess).requireAdmin("Bearer admin-token");
        verify(adminService).startEnquiry(5L);
        verify(auditLog).record("Bearer admin-token", "enquiry started", "#5 status: in-progress");
    }

    @Test
    void startingAnEnquiryAgainDoesNotCreateAnotherAuditEntry() {
        when(adminService.enquiryById(5L)).thenReturn(Map.of("id", 5L, "status", "in-progress"));
        when(adminService.startEnquiry(5L)).thenReturn(Map.of("id", 5L, "status", "in-progress"));

        Map<String, Object> result = controller.startEnquiry(5L, "Bearer admin-token");

        assertEquals(false, result.get("statusChanged"));
        verify(auditLog, never()).record("Bearer admin-token", "enquiry started", "#5 status: in-progress");
    }

    @Test
    void contentAndSettingsEditsAreAuditedByFieldNameNotByTheirText() {
        Map<String, Object> blocks = new LinkedHashMap<>();
        blocks.put("hero-title", "private text that should stay in the page content");
        Map<String, Object> contentBody = Map.of("blocks", blocks);
        controller.putBlocks(7L, contentBody, "Bearer admin-token");
        verify(cmsService).upsertBlocks(7L, Map.of("hero-title", "private text that should stay in the page content"));
        verify(auditLog).record("Bearer admin-token", "page content updated", "page #7 blocks: hero-title");

        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("siteName", "ESA office");
        controller.putSettings(settings, "Bearer admin-token");
        verify(settingsService).updateSettings(Map.of("siteName", "ESA office"));
        verify(auditLog).record("Bearer admin-token", "site settings updated", "siteName");
    }

    @Test
    void resettingPageContentIsAudited() {
        controller.deleteBlock(7L, "hero-title", "Bearer admin-token");

        verify(cmsService).deleteBlockOverride(7L, "hero-title");
        verify(auditLog).record("Bearer admin-token", "page content reset", "page #7 block: hero-title");
    }

    @Test
    void failedDataUpdatesDoNotCreateSuccessfulAuditEntries() {
        Map<String, Object> body = Map.of("phone", "0400000000");
        when(adminService.updateCustomer(4L, body)).thenThrow(new RuntimeException("save failed"));

        assertThrows(RuntimeException.class,
                () -> controller.patchCustomer(4L, body, "Bearer admin-token"));

        verify(auditLog, never()).record("Bearer admin-token", "customer updated", "#4 fields: phone");
    }
}
