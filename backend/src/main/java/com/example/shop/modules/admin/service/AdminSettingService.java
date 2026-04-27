package com.example.shop.modules.admin.service;

import com.example.shop.modules.admin.entity.AdminSetting;
import com.example.shop.modules.admin.repository.AdminSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminSettingService {

    private final AdminSettingRepository adminSettingRepository;

    public List<AdminSetting> getAllSettings() {
        return adminSettingRepository.findAllByOrderBySettingKeyAsc();
    }

    public Map<String, String> getPublicSettings(List<String> keys) {
        List<AdminSetting> settings = adminSettingRepository.findBySettingKeyIn(keys);
        return settings.stream()
                .collect(Collectors.toMap(AdminSetting::getSettingKey, s -> s.getSettingValue() != null ? s.getSettingValue() : ""));
    }

    @Transactional
    public AdminSetting upsertSetting(String key, String value, String description) {
        AdminSetting setting = adminSettingRepository.findAllByOrderBySettingKeyAsc()
                .stream()
                .filter(s -> s.getSettingKey().equals(key))
                .findFirst()
                .orElse(null);

        if (setting == null) {
            setting = AdminSetting.builder()
                    .settingKey(key)
                    .settingValue(value)
                    .description(description != null ? description : "Setting for " + key)
                    .updatedAt(LocalDateTime.now())
                    .build();
        } else {
            setting.setSettingValue(value);
            if (description != null && !description.isBlank()) {
                setting.setDescription(description);
            }
            setting.setUpdatedAt(LocalDateTime.now());
        }
        return adminSettingRepository.save(setting);
    }
}
