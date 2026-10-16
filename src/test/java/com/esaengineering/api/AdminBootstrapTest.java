package com.esaengineering.api;

import com.esaengineering.model.User;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class AdminBootstrapTest {

    @Test
    void productionNeedsEnvironmentProvidedFirstAdminCredentials() {
        ApiAuthService auth = mock(ApiAuthService.class);
        AdminDataService admin = mock(AdminDataService.class);
        when(auth.findByEmail("admin@esaengineering.com.au")).thenReturn(Optional.empty());
        when(admin.hasAdministrator()).thenReturn(false);

        AdminBootstrap bootstrap = new AdminBootstrap(auth, admin, true,
                "admin@esaengineering.com.au", "Admin123", "ESA Administrator",
                "", "", "prod");

        assertThrows(IllegalStateException.class, () -> bootstrap.run());
        verify(auth, never()).createAdmin(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void productionRejectsAnExistingSampleAdminEvenWhenNewCredentialsAreSet() {
        ApiAuthService auth = mock(ApiAuthService.class);
        AdminDataService admin = mock(AdminDataService.class);
        User sample = new User();
        sample.setEmail("admin@esaengineering.com.au");
        sample.setPassword("Admin123");
        when(auth.findByEmail("admin@esaengineering.com.au")).thenReturn(Optional.of(sample));

        AdminBootstrap bootstrap = new AdminBootstrap(auth, admin, true,
                "admin@esaengineering.com.au", "Admin123", "ESA Administrator",
                "operations@example.com", "A-Different-Password9", "production");

        assertThrows(IllegalStateException.class, () -> bootstrap.run());
        verifyNoInteractions(admin);
        verify(auth, never()).createAdmin(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void productionCreatesFirstAdminFromEnvironmentValues() {
        ApiAuthService auth = mock(ApiAuthService.class);
        AdminDataService admin = mock(AdminDataService.class);
        when(auth.findByEmail("admin@esaengineering.com.au")).thenReturn(Optional.empty());
        when(admin.hasAdministrator()).thenReturn(false);

        AdminBootstrap bootstrap = new AdminBootstrap(auth, admin, true,
                "admin@esaengineering.com.au", "Admin123", "ESA Administrator",
                "operations@example.com", "Safe-Password9", "prod");

        bootstrap.run();
        verify(auth).createAdmin("ESA Administrator", "operations@example.com", "Safe-Password9", "");
    }
}
