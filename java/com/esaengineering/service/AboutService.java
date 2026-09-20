package com.esaengineering.service;

import java.util.List;

import com.esaengineering.model.ContentAbout;
import com.esaengineering.repository.ContentAboutRepository;

import org.springframework.stereotype.Service;

@Service
public class AboutService {

    ContentAboutRepository repository;

    public AboutService(ContentAboutRepository repository) {
        this.repository = repository;
    }

    // There is only one row of about content in the table.
    // This returns it, or makes an empty one when the table is empty.
    private ContentAbout getOrCreate() {
        List<ContentAbout> contents = repository.findAll();
        if (contents.isEmpty()) {
            return repository.save(new ContentAbout());
        }
        return contents.get(0);
    }

    public ContentAbout getAllContents() {
        List<ContentAbout> contents = repository.findAll();
        if (contents.isEmpty()) {
            return new ContentAbout();
        }

        return contents.get(0); //it returns all contents
    }

    public void saveContents(ContentAbout newContent) {

        ContentAbout about = getOrCreate();

        if (newContent.getStory() != null) {
            about.setStory(newContent.getStory());
        }
        if (newContent.getHeading1() != null) {
            about.setHeading1(newContent.getHeading1());
        }
        if (newContent.getParagraph1() != null) {
            about.setParagraph1(newContent.getParagraph1());
        }
        if (newContent.getParagraph3() != null) {
            about.setParagraph3(newContent.getParagraph3());
        }
        if (newContent.getHeading2() != null) {
            about.setHeading2(newContent.getHeading2());
        }
        if (newContent.getParagraph2() != null) {
            about.setParagraph2(newContent.getParagraph2());
        }

        if (newContent.getSpecialist1Name() != null) {
            about.setSpecialist1Name(newContent.getSpecialist1Name());
        }
        if (newContent.getSpecialist1Position() != null) {
            about.setSpecialist1Position(newContent.getSpecialist1Position());
        }
        if (newContent.getSpecialist1Biography() != null) {
            about.setSpecialist1Biography(newContent.getSpecialist1Biography());
        }
        if (newContent.getSpecialist2Name() != null) {
            about.setSpecialist2Name(newContent.getSpecialist2Name());
        }
        if (newContent.getSpecialist2Position() != null) {
            about.setSpecialist2Position(newContent.getSpecialist2Position());
        }
        if (newContent.getSpecialist2Biography() != null) {
            about.setSpecialist2Biography(newContent.getSpecialist2Biography());
        }

        repository.save(about);
    }

    public String getStory() {
        return getOrCreate().getStory();
    }

    public void saveStory(String story) {
        ContentAbout about = getOrCreate();
        about.setStory(story);
        repository.save(about);
    }

    public String getHeading1() {
        return getOrCreate().getHeading1();
    }

    public void saveHeading1(String heading1) {
        ContentAbout about = getOrCreate();
        about.setHeading1(heading1);
        repository.save(about);
    }

    public String getHeading2() {
        return getOrCreate().getHeading2();
    }

    public void saveHeading2(String heading2) {
        ContentAbout about = getOrCreate();
        about.setHeading2(heading2);
        repository.save(about);
    }

    public String getParagraph1() {
        return getOrCreate().getParagraph1();
    }

    public String getParagraph2() {
        return getOrCreate().getParagraph2();
    }

    public String getParagraph3() {
        return getOrCreate().getParagraph3();
    }

    public void saveParagraph1(String paragraph1) {
        ContentAbout about = getOrCreate();
        about.setParagraph1(paragraph1);
        repository.save(about);
    }

    public void saveParagraph2(String paragraph2) {
        ContentAbout about = getOrCreate();
        about.setParagraph2(paragraph2);
        repository.save(about);
    }

    public void saveParagraph3(String paragraph3) {
        ContentAbout about = getOrCreate();
        about.setParagraph3(paragraph3);
        repository.save(about);
    }

    public String getSpecialist1Name() {
        return getOrCreate().getSpecialist1Name();
    }

    public String getSpecialist2Name() {
        return getOrCreate().getSpecialist2Name();
    }

    public void saveSpecialist1Name(String name) {
        ContentAbout about = getOrCreate();
        about.setSpecialist1Name(name);
        repository.save(about);
    }

    public void saveSpecialist2Name(String name) {
        ContentAbout about = getOrCreate();
        about.setSpecialist2Name(name);
        repository.save(about);
    }

    public String getSpecialist1Biography() {
        return getOrCreate().getSpecialist1Biography();
    }

    public String getSpecialist2Biography() {
        return getOrCreate().getSpecialist2Biography();
    }

    public void saveSpecialist1Biography(String bio) {
        ContentAbout about = getOrCreate();
        about.setSpecialist1Biography(bio);
        repository.save(about);
    }

    public void saveSpecialist2Biography(String bio) {
        ContentAbout about = getOrCreate();
        about.setSpecialist2Biography(bio);
        repository.save(about);
    }

    public String getSpecialist1Position() {
        return getOrCreate().getSpecialist1Position();
    }

    public String getSpecialist2Position() {
        return getOrCreate().getSpecialist2Position();
    }

    public void saveSpecialist1Position(String position) {
        ContentAbout about = getOrCreate();
        about.setSpecialist1Position(position);
        repository.save(about);
    }

    public void saveSpecialist2Position(String position) {
        ContentAbout about = getOrCreate();
        about.setSpecialist2Position(position);
        repository.save(about);
    }
}
