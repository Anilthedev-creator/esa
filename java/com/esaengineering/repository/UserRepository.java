package com.esaengineering.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.esaengineering.model.Role;
import com.esaengineering.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Optional<User> findByPhoneNumber(String phoneNumber);

    // used by the forgot password page
    Optional<User> findByResetToken(String resetToken);

    // used by the admin customers page
    List<User> findByRole(Role role);
}
