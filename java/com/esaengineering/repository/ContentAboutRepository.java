package com.esaengineering.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import com.esaengineering.model.ContentAbout;

@Repository
public interface ContentAboutRepository extends JpaRepository<ContentAbout, Long> {

    // contentId is unique so there can only be one row with this id
    Optional<ContentAbout> findByContentId(Long contentId);
}
