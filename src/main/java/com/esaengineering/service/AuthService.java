package com.esaengineering.service;

import java.util.Optional;

import org.springframework.stereotype.Service;

import com.esaengineering.model.Role;
import com.esaengineering.model.User;
import com.esaengineering.repository.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;

    public AuthService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Register a new customer account.
     */
    public boolean registerUser(
            String fullName,
            String companyName,
            String email,
            String password,
            String phoneNumber) {

        Optional<User> existingUser =
                userRepository.findByEmail(email);

        if (existingUser.isPresent()) {
            return false;
        }



        User user = new User();

        user.setFullName(fullName);
        user.setCompanyName(companyName);
        user.setEmail(email);
        user.setPassword(password);
        user.setPhoneNumber(phoneNumber);

        user.setRole(Role.CUSTOMER);

        user.setPasswordResetRequired(false);
        user.setActive(true);

        userRepository.save(user);

        return true;


    }






    public boolean registerUserAdmin(

      

        String fullName,

     
        String email,
        String password,
    
        String phoneNumber
    

    ){
        

        Optional<User> exitingUser = userRepository.findByEmail(email);

        if (exitingUser.isPresent()){
            return false;
        }
        
        User user = new User();

        user.setFullName(fullName);
        user.setEmail(email);
        user.setPassword(password);
        user.setPhoneNumber(phoneNumber); 
        user.setCompanyName("ESA");
        user.setRole(Role.ADMIN);
        user.setPasswordResetRequired(true);
        user.setActive(true);

        userRepository.save(user);

        return true;
      
    }
    


    /**
     * Login validation.
     */
    public User login(
            String email,
            String password) {

        Optional<User> userOptional =
                userRepository.findByEmail(email);

        if (userOptional.isEmpty()) {
            return null;
        }

        User user = userOptional.get();

        if (!user.getPassword().equals(password)) {
            return null;
        }

        return user;
    }








    /**
     * Change password.
     */
    public boolean changePassword(
            String email,
            String newPassword) {

        Optional<User> userOptional =
                userRepository.findByEmail(email);

        if (userOptional.isEmpty()) {
            return false;
        }

        User user = userOptional.get();

        user.setPassword(newPassword);

        userRepository.save(user);

        return true;
    }
}