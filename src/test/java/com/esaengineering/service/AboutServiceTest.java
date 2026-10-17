package com.esaengineering.service;

import com.esaengineering.model.ContentAbout;
import com.esaengineering.repository.ContentAboutRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AboutServiceTest {

    @Test
    void savesTheThirdAboutParagraphAlongWithTheOtherFields() {
        ContentAbout saved = new ContentAbout();
        ContentAboutRepository repository = mock(ContentAboutRepository.class);
        when(repository.findAll()).thenReturn(List.of(saved));
        AboutService service = new AboutService(repository);
        ContentAbout update = new ContentAbout();
        update.setParagraph3("company description");

        service.saveContents(update);

        assertEquals("company description", saved.getParagraph3());
        verify(repository).save(saved);
    }
}
