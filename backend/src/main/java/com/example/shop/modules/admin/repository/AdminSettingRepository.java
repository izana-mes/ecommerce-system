package com.example.shop.modules.admin.repository;

import com.example.shop.modules.admin.entity.AdminSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AdminSettingRepository extends JpaRepository<AdminSetting, Long> {
    List<AdminSetting> findAllByOrderBySettingKeyAsc();
    List<AdminSetting> findBySettingKeyIn(List<String> keys);
}
