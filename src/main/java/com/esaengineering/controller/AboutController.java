
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

    @GetMapping
    public   ContentAbout  getAllContents(   ){
        return aboutService.getAllContents();

    }

    @PutMapping
    public void saveContentsAboutPage( @RequestBody ContentAbout contentAbout){
        aboutService.saveContents(contentAbout);

    }
    @PutMapping("/story")
    public void saveStory(@RequestBody String story){
        aboutService.saveStory(story);
    }
    @GetMapping("/story")
    public String getStory(){
        return aboutService.getStory();
    }


    @GetMapping("/heading1")
    public String getHeading1() {
        return aboutService.getHeading1();
    }

    @PutMapping("/heading1")
    public void saveHeading1(@RequestBody String heading1) {
        aboutService.saveHeading1(heading1);
    }

    //paragraph 1 endpoint

    @GetMapping("/paragraph1")
    public String getParagraph1() {
        return aboutService.getParagraph1();
    }

    @PutMapping("/paragraph1")
    public void saveParagraph1(@RequestBody String paragraph1) {
        aboutService.saveParagraph1(paragraph1);
    }

   
    // Heading 2
    // 

    @GetMapping("/heading2")
    public String getHeading2() {
        return aboutService.getHeading2();
    }

    @PutMapping("/heading2")
    public void saveHeading2(@RequestBody String heading2) {
        aboutService.saveHeading2(heading2);
    }

  
    // Paragraph 2
    

    @GetMapping("/paragraph2")
    public String getParagraph2() {
        return aboutService.getParagraph2();
    }

    @PutMapping("/paragraph2")
    public void saveParagraph2(@RequestBody String paragraph2) {
        aboutService.saveParagraph2(paragraph2);
    }

  
    // Specialist 1 Name
  

    @GetMapping("/specialist1Name")
    public String getSpecialist1Name() {
        return aboutService.getSpecialist1Name();
    }

    @PutMapping("/specialist1Name")
    public void saveSpecialist1Name(@RequestBody String specialist1Name) {
        aboutService.saveSpecialist1Name(specialist1Name);
    }

    
    // Specialist 1 Position
   

    @GetMapping("/specialist1Position")
    public String getSpecialist1Position() {
        return aboutService.getSpecialist1Position();
    }

    @PutMapping("/specialist1Position")
    public void saveSpecialist1Position(@RequestBody String specialist1Position) {
        aboutService.saveSpecialist1Position(specialist1Position);
    }

    // Specialist 1 Biography


    @GetMapping("/specialist1Biography")
    public String getSpecialist1Biography() {
        return aboutService.getSpecialist1Biography();
    }

    @PutMapping("/specialist1Biography")
    public void saveSpecialist1Biography(@RequestBody String specialist1Biography) {
        aboutService.saveSpecialist1Biography(specialist1Biography);
    }

 
    // Specialist 2 Name
   

    @GetMapping("/specialist2Name")
    public String getSpecialist2Name() {
        return aboutService.getSpecialist2Name();
    }

    @PutMapping("/specialist2Name")
    public void saveSpecialist2Name(@RequestBody String specialist2Name) {
        aboutService.saveSpecialist2Name(specialist2Name);
    }


    // Specialist 2 Position
   

    @GetMapping("/specialist2Position")
    public String getSpecialist2Position() {
        return aboutService.getSpecialist2Position();
    }

    @PutMapping("/specialist2Position")
    public void saveSpecialist2Position(@RequestBody String specialist2Position) {
        aboutService.saveSpecialist2Position(specialist2Position);
    }

   
    // Specialist 2 Biography


    @GetMapping("/specialist2Biography")
    public String getSpecialist2Biography() {
        return aboutService.getSpecialist2Biography();
    }

    @PutMapping("/specialist2Biography")
    public void saveSpecialist2Biography(@RequestBody String specialist2Biography) {
        aboutService.saveSpecialist2Biography(specialist2Biography);
    }
    












    





    
}
