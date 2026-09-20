package com.esaengineering.repository;

import com.esaengineering.model.SitePage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SitePageRepository extends JpaRepository<SitePage, Long> {

    Optional<SitePage> findBySlug(String slug);
}
