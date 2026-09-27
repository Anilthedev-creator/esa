package com.esaengineering.repository;

import com.esaengineering.model.SiteSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteSettingRepository extends JpaRepository<SiteSetting, String> {
}
