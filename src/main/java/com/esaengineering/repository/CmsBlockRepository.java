package com.esaengineering.repository;

import com.esaengineering.model.CmsBlock;
import com.esaengineering.model.CmsPage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CmsBlockRepository extends JpaRepository<CmsBlock, Long> {
    List<CmsBlock> findByPage(CmsPage page);
    List<CmsBlock> findByPageId(Long pageId);
    Optional<CmsBlock> findByPageIdAndKey(Long pageId, String key);
    Optional<CmsBlock> findByPageAndKey(CmsPage page, String key);
}
