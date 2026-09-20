package com.esaengineering.repository;

import com.esaengineering.model.ContentBlock;
import com.esaengineering.model.SitePage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentBlockRepository extends JpaRepository<ContentBlock, Long> {

    List<ContentBlock> findByPage(SitePage page);

    Optional<ContentBlock> findByPageAndBlockKey(SitePage page, String blockKey);
}
