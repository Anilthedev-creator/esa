package com.esaengineering.controller;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.service.AboutService;
import com.esaengineering.model.ContentAbout;

import org.springframework.beans.factory.annotation.Autowired;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/about")
public class AboutController {

    @Autowired
    AboutService aboutService;

    // The admin page sends the text with JSON.stringify, which adds
    // quotes around it ("hello"). This removes those extra quotes.
    private String cleanText(String value) {
        if (value == null) {
            return null;
        }
        String text = value.trim();
        if (text.length() >= 2 && text.startsWith("\"") && text.endsWith("\"")) {
            text = text.substring(1, text.length() - 1);
        }
        return text;
    }

    @GetMapping
    public ContentAbout getAllContents() {
        return aboutService.getAllContents();
    }

    @PutMapping
    public void saveContentsAboutPage(@RequestBody ContentAbout contentAbout) {
        aboutService.saveContents(contentAbout);
    }

    @PutMapping("/story")
    public void saveStory(@RequestBody String story) {
        aboutService.saveStory(cleanText(story));
    }

    @GetMapping("/story")
    public String getStory() {
        return aboutService.getStory();
    }

    @GetMapping("/heading1")
    public String getHeading1() {
        return aboutService.getHeading1();
    }

    @PutMapping("/heading1")
    public void saveHeading1(@RequestBody String heading1) {
        aboutService.saveHeading1(cleanText(heading1));
    }

    //paragraph 1 endpoint

    @GetMapping("/paragraph1")
    public String getParagraph1() {
        return aboutService.getParagraph1();
    }

    @PutMapping("/paragraph1")
    public void saveParagraph1(@RequestBody String paragraph1) {
        aboutService.saveParagraph1(cleanText(paragraph1));
    }

    //paragraph 3 endpoint (the admin page has a third paragraph box)

    @GetMapping("/paragraph3")
    public String getParagraph3() {
        return aboutService.getParagraph3();
    }

    @PutMapping("/paragraph3")
    public void saveParagraph3(@RequestBody String paragraph3) {
        aboutService.saveParagraph3(cleanText(paragraph3));
    }

    // Heading 2

    @GetMapping("/heading2")
    public String getHeading2() {
        return aboutService.getHeading2();
    }

    @PutMapping("/heading2")
    public void saveHeading2(@RequestBody String heading2) {
        aboutService.saveHeading2(cleanText(heading2));
    }

    // Paragraph 2

    @GetMapping("/paragraph2")
    public String getParagraph2() {
        return aboutService.getParagraph2();
    }

    @PutMapping("/paragraph2")
    public void saveParagraph2(@RequestBody String paragraph2) {
        aboutService.saveParagraph2(cleanText(paragraph2));
    }

    // Specialist 1 Name

    @GetMapping("/specialist1Name")
    public String getSpecialist1Name() {
        return aboutService.getSpecialist1Name();
    }

    @PutMapping("/specialist1Name")
    public void saveSpecialist1Name(@RequestBody String specialist1Name) {
        aboutService.saveSpecialist1Name(cleanText(specialist1Name));
    }

    // Specialist 1 Position

    @GetMapping("/specialist1Position")
    public String getSpecialist1Position() {
        return aboutService.getSpecialist1Position();
    }

    @PutMapping("/specialist1Position")
    public void saveSpecialist1Position(@RequestBody String specialist1Position) {
        aboutService.saveSpecialist1Position(cleanText(specialist1Position));
    }

    // Specialist 1 Biography

    @GetMapping("/specialist1Biography")
    public String getSpecialist1Biography() {
        return aboutService.getSpecialist1Biography();
    }

    @PutMapping("/specialist1Biography")
    public void saveSpecialist1Biography(@RequestBody String specialist1Biography) {
        aboutService.saveSpecialist1Biography(cleanText(specialist1Biography));
    }

    // Specialist 2 Name

    @GetMapping("/specialist2Name")
    public String getSpecialist2Name() {
        return aboutService.getSpecialist2Name();
    }

    @PutMapping("/specialist2Name")
    public void saveSpecialist2Name(@RequestBody String specialist2Name) {
        aboutService.saveSpecialist2Name(cleanText(specialist2Name));
    }

    // Specialist 2 Position

    @GetMapping("/specialist2Position")
    public String getSpecialist2Position() {
        return aboutService.getSpecialist2Position();
    }

    @PutMapping("/specialist2Position")
    public void saveSpecialist2Position(@RequestBody String specialist2Position) {
        aboutService.saveSpecialist2Position(cleanText(specialist2Position));
    }

    // Specialist 2 Biography

    @GetMapping("/specialist2Biography")
    public String getSpecialist2Biography() {
        return aboutService.getSpecialist2Biography();
    }

    @PutMapping("/specialist2Biography")
    public void saveSpecialist2Biography(@RequestBody String specialist2Biography) {
        aboutService.saveSpecialist2Biography(cleanText(specialist2Biography));
    }
}
