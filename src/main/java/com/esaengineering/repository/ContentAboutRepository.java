
package com.esaengineering.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import com.esaengineering.model.ContentAbout;

@Repository
public interface ContentAboutRepository  extends JpaRepository<ContentAbout, Long> {

    List <ContentAbout> findByContentId(Long contentId);







    
}
