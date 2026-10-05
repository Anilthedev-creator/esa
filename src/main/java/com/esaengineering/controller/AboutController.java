
package com.esaengineering.controller;

import org.springframework.web.bind.annotation.*;

import com.esaengineering.api.AdminAccess;
import com.esaengineering.service.AboutService;
import com.esaengineering.model.ContentAbout;





import org.springframework.web.bind.annotation.RequestHeader;



@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/about")
 public class AboutController {

    private final AboutService aboutService;
    private final AdminAccess adminAccess;

    public AboutController(AboutService aboutService, AdminAccess adminAccess) {
        this.aboutService = aboutService;
        this.adminAccess = adminAccess;
    }

    @GetMapping
    public   ContentAbout  getAllContents(   ){
        return aboutService.getAllContents();

    }

    @PutMapping
    public void saveContentsAboutPage(@RequestBody ContentAbout contentAbout,
                                      @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveContents(contentAbout);

    }
    @PutMapping("/story")
    public void saveStory(@RequestBody String story,
                          @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
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
    void saveHeading1(@RequestBody String heading1,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveHeading1(heading1);
    }

    //paragraph 1 endpoint

    @GetMapping("/paragraph1")
    public String getParagraph1() {
        return aboutService.getParagraph1();
    }

    @PutMapping("/paragraph1")
    void saveParagraph1(@RequestBody String paragraph1,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveParagraph1(paragraph1);
    }

   
    // Heading 2
    // 

    @GetMapping("/heading2")
    public String getHeading2() {
        return aboutService.getHeading2();
    }

    @PutMapping("/heading2")
    void saveHeading2(@RequestBody String heading2,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveHeading2(heading2);
    }

  
    // Paragraph 2
    

    @GetMapping("/paragraph2")
    public String getParagraph2() {
        return aboutService.getParagraph2();
    }

    @PutMapping("/paragraph2")
    void saveParagraph2(@RequestBody String paragraph2,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveParagraph2(paragraph2);
    }

  
    // Specialist 1 Name
  

    @GetMapping("/specialist1Name")
    public String getSpecialist1Name() {
        return aboutService.getSpecialist1Name();
    }

    @PutMapping("/specialist1Name")
    void saveSpecialist1Name(@RequestBody String specialist1Name,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist1Name(specialist1Name);
    }

    
    // Specialist 1 Position
   

    @GetMapping("/specialist1Position")
    public String getSpecialist1Position() {
        return aboutService.getSpecialist1Position();
    }

    @PutMapping("/specialist1Position")
    void saveSpecialist1Position(@RequestBody String specialist1Position,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist1Position(specialist1Position);
    }

    // Specialist 1 Biography


    @GetMapping("/specialist1Biography")
    public String getSpecialist1Biography() {
        return aboutService.getSpecialist1Biography();
    }

    @PutMapping("/specialist1Biography")
    void saveSpecialist1Biography(@RequestBody String specialist1Biography,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist1Biography(specialist1Biography);
    }

 
    // Specialist 2 Name
   

    @GetMapping("/specialist2Name")
    public String getSpecialist2Name() {
        return aboutService.getSpecialist2Name();
    }

    @PutMapping("/specialist2Name")
    void saveSpecialist2Name(@RequestBody String specialist2Name,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist2Name(specialist2Name);
    }


    // Specialist 2 Position
   

    @GetMapping("/specialist2Position")
    public String getSpecialist2Position() {
        return aboutService.getSpecialist2Position();
    }

    @PutMapping("/specialist2Position")
    void saveSpecialist2Position(@RequestBody String specialist2Position,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist2Position(specialist2Position);
    }

   
    // Specialist 2 Biography


    @GetMapping("/specialist2Biography")
    public String getSpecialist2Biography() {
        return aboutService.getSpecialist2Biography();
    }

    @PutMapping("/specialist2Biography")
    void saveSpecialist2Biography(@RequestBody String specialist2Biography,
            @RequestHeader(value = "Authorization", required = false) String auth) {
        adminAccess.requireAdmin(auth);
        aboutService.saveSpecialist2Biography(specialist2Biography);
    }
    












    





    
}
