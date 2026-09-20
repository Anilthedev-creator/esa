package com.esaengineering.model;

import jakarta.persistence.*;

@Entity
@Table(name = "about_content")
public class ContentAbout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long contentId;

    @Column(length = 200)
    private String story;

    private String heading1;

    @Column(length = 3000)
    private String paragraph1;

    @Column(length = 3000)
    private String paragraph3;

    private String heading2;

    @Column(length = 3000)
    private String paragraph2;

    private String specialist1Name;

    @Column(length = 3000)
    private String specialist1Position;

    @Column(length = 3000)
    private String specialist1Biography;

    private String specialist2Name;

    @Column(length = 3000)
    private String specialist2Position;

    @Column(length = 3000)
    private String specialist2Biography;

    public ContentAbout() {
    }

    public ContentAbout(Long contentId, String story, String heading1, String paragraph1, String heading2,
            String paragraph2, String specialist1Name, String specialist1Position, String specialist1Biography,
            String specialist2Name, String specialist2Position, String specialist2Biography) {
        this.contentId = contentId;
        this.story = story;
        this.heading1 = heading1;
        this.paragraph1 = paragraph1;
        this.heading2 = heading2;
        this.paragraph2 = paragraph2;
        this.specialist1Name = specialist1Name;
        this.specialist1Position = specialist1Position;
        this.specialist1Biography = specialist1Biography;
        this.specialist2Name = specialist2Name;
        this.specialist2Position = specialist2Position;
        this.specialist2Biography = specialist2Biography;
    }

    public Long getContentId() {
        return contentId;
    }

    public String getStory() {
        return story;
    }

    public String getHeading1() {
        return heading1;
    }

    public String getParagraph1() {
        return paragraph1;
    }

    public String getHeading2() {
        return heading2;
    }

    public String getParagraph2() {
        return paragraph2;
    }

    public String getSpecialist1Name() {
        return specialist1Name;
    }

    public String getSpecialist1Position() {
        return specialist1Position;
    }

    public String getSpecialist1Biography() {
        return specialist1Biography;
    }

    public String getSpecialist2Name() {
        return specialist2Name;
    }

    public String getSpecialist2Position() {
        return specialist2Position;
    }

    public String getSpecialist2Biography() {
        return specialist2Biography;
    }

    public void setContentId(Long contentId) {
        this.contentId = contentId;
    }

    public void setStory(String story) {
        this.story = story;
    }

    public void setHeading1(String heading1) {
        this.heading1 = heading1;
    }

    public void setParagraph1(String paragraph1) {
        this.paragraph1 = paragraph1;
    }

    public void setHeading2(String heading2) {
        this.heading2 = heading2;
    }

    public void setParagraph2(String paragraph2) {
        this.paragraph2 = paragraph2;
    }

    public void setSpecialist1Name(String specialist1Name) {
        this.specialist1Name = specialist1Name;
    }

    public void setSpecialist1Position(String specialist1Position) {
        this.specialist1Position = specialist1Position;
    }

    public void setSpecialist1Biography(String specialist1Biography) {
        this.specialist1Biography = specialist1Biography;
    }

    public void setSpecialist2Name(String specialist2Name) {
        this.specialist2Name = specialist2Name;
    }

    public void setSpecialist2Position(String specialist2Position) {
        this.specialist2Position = specialist2Position;
    }

    public void setSpecialist2Biography(String specialist2Biography) {
        this.specialist2Biography = specialist2Biography;
    }

    public String getParagraph3() {
        return paragraph3;
    }

    public void setParagraph3(String paragraph3) {
        this.paragraph3 = paragraph3;
    }
    




    


}
    
