package com.esaengineering.repository;

import com.esaengineering.model.CmsPage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface CmsPageRepository extends JpaRepository<CmsPage, Long> {
    Optional<CmsPage> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
