package com.esaengineering.service;

import java.util.List;

import com.esaengineering.model.ContentAbout;
import com.esaengineering.repository.ContentAboutRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AboutService {

    private final ContentAboutRepository repository;

    public AboutService(ContentAboutRepository repository) {
        this.repository = repository;
    }

    private ContentAbout getOrCreate() {
        List<ContentAbout> contents = repository.findAll();
        if (contents.isEmpty()) {
            ContentAbout c = new ContentAbout();
            c.setStory("ESA Engineering Services Australia delivers technical excellence across regional and remote Australia.");
            c.setHeading1("Engineering Excellence Since 2004");
            c.setParagraph1("We provide plant commissioning, utility appraisals, production optimisation, waste management and dangerous goods consulting.");
            c.setHeading2("Our Specialists");
            c.setParagraph2("Our team combines decades of field experience with a focus on safety and compliance.");
            c.setSpecialist1Name("John Smith");
            c.setSpecialist1Position("Lead Engineer");
            c.setSpecialist1Biography("20+ years in plant commissioning.");
            c.setSpecialist2Name("Jane Doe");
            c.setSpecialist2Position("Operations Manager");
            c.setSpecialist2Biography("Expert in waste management and safety standards.");
            return repository.save(c);
        }
        return contents.get(0);
    }

    public ContentAbout getAllContents() {
        return getOrCreate();
    }

    @Transactional
    public void saveContents(ContentAbout newContent) {
        ContentAbout about = getOrCreate();
        if (newContent.getStory() != null) about.setStory(newContent.getStory());
        if (newContent.getHeading1() != null) about.setHeading1(newContent.getHeading1());
        if (newContent.getParagraph1() != null) about.setParagraph1(newContent.getParagraph1());
        if (newContent.getHeading2() != null) about.setHeading2(newContent.getHeading2());
        if (newContent.getParagraph2() != null) about.setParagraph2(newContent.getParagraph2());
        if (newContent.getSpecialist1Name() != null) about.setSpecialist1Name(newContent.getSpecialist1Name());
        if (newContent.getSpecialist1Position() != null) about.setSpecialist1Position(newContent.getSpecialist1Position());
        if (newContent.getSpecialist1Biography() != null) about.setSpecialist1Biography(newContent.getSpecialist1Biography());
        if (newContent.getSpecialist2Name() != null) about.setSpecialist2Name(newContent.getSpecialist2Name());
        if (newContent.getSpecialist2Position() != null) about.setSpecialist2Position(newContent.getSpecialist2Position());
        if (newContent.getSpecialist2Biography() != null) about.setSpecialist2Biography(newContent.getSpecialist2Biography());
        repository.save(about);
    }

    public String getStory() { return getOrCreate().getStory(); }
    public void saveStory(String story) { ContentAbout a = getOrCreate(); a.setStory(clean(story)); repository.save(a); }

    public String getHeading1() { return getOrCreate().getHeading1(); }
    public void saveHeading1(String heading1) { ContentAbout a = getOrCreate(); a.setHeading1(clean(heading1)); repository.save(a); }

    public String getHeading2() { return getOrCreate().getHeading2(); }
    public void saveHeading2(String heading2) { ContentAbout a = getOrCreate(); a.setHeading2(clean(heading2)); repository.save(a); }

    public String getParagraph1() { return getOrCreate().getParagraph1(); }
    public void saveParagraph1(String paragraph1) { ContentAbout a = getOrCreate(); a.setParagraph1(clean(paragraph1)); repository.save(a); }

    public String getParagraph2() { return getOrCreate().getParagraph2(); }
    public void saveParagraph2(String paragraph2) { ContentAbout a = getOrCreate(); a.setParagraph2(clean(paragraph2)); repository.save(a); }

    public String getParagraph3() { return getOrCreate().getParagraph3(); }
    public void saveParagraph3(String paragraph3) { ContentAbout a = getOrCreate(); a.setParagraph3(clean(paragraph3)); repository.save(a); }

    public String getSpecialist1Name() { return getOrCreate().getSpecialist1Name(); }
    public void saveSpecialist1Name(String name) { ContentAbout a = getOrCreate(); a.setSpecialist1Name(clean(name)); repository.save(a); }

    public String getSpecialist2Name() { return getOrCreate().getSpecialist2Name(); }
    public void saveSpecialist2Name(String name) { ContentAbout a = getOrCreate(); a.setSpecialist2Name(clean(name)); repository.save(a); }

    public String getSpecialist1Biography() { return getOrCreate().getSpecialist1Biography(); }
    public void saveSpecialist1Biography(String bio) { ContentAbout a = getOrCreate(); a.setSpecialist1Biography(clean(bio)); repository.save(a); }

    public String getSpecialist2Biography() { return getOrCreate().getSpecialist2Biography(); }
    public void saveSpecialist2Biography(String bio) { ContentAbout a = getOrCreate(); a.setSpecialist2Biography(clean(bio)); repository.save(a); }

    public String getSpecialist1Position() { return getOrCreate().getSpecialist1Position(); }
    public void saveSpecialist1Position(String position) { ContentAbout a = getOrCreate(); a.setSpecialist1Position(clean(position)); repository.save(a); }

    public String getSpecialist2Position() { return getOrCreate().getSpecialist2Position(); }
    public void saveSpecialist2Position(String position) { ContentAbout a = getOrCreate(); a.setSpecialist2Position(clean(position)); repository.save(a); }

    private String clean(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        // Remove surrounding quotes if client sent JSON stringified value
        if ((s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.substring(1, s.length() - 1);
        }
        return s;
    }
}
