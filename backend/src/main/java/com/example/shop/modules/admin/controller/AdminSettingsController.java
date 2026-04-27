package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.admin.entity.AdminSetting;
import com.example.shop.modules.admin.service.AdminSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/settings")
@RequiredArgsConstructor
public class AdminSettingsController {

    private static final List<String> PUBLIC_SETTING_KEYS = List.of(
            "banner_left_url",
            "banner_right_url",
            "collection_left_url",
            "collection_top_url",
            "collection_bottom_left_url",
            "deal_background_url",
            "hero_background_url"
    );

    private final AdminSettingService adminSettingService;

    /** Public endpoint — no authentication required. Returns map of homepage image setting keys. */
    @GetMapping("/public")
    public ResponseEntity<ApiResponse<Map<String, String>>> getPublicSettings() {
        Map<String, String> settings = adminSettingService.getPublicSettings(PUBLIC_SETTING_KEYS);
        return ResponseEntity.ok(ApiResponse.success(settings));
    }

    /** Admin-only: returns all settings as a list. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<AdminSetting>>> getAllSettings() {
        return ResponseEntity.ok(ApiResponse.success(adminSettingService.getAllSettings()));
    }

    /** Admin-only: upsert a setting by key. */
    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<String>> upsertSetting(@RequestBody UpsertSettingRequest body) {
        if (body.getSettingKey() == null || body.getSettingKey().isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("setting_key is required"));
        }
        adminSettingService.upsertSetting(body.getSettingKey(), body.getSettingValue(), body.getDescription());
        return ResponseEntity.ok(ApiResponse.success("Setting updated"));
    }

    @lombok.Data
    @lombok.NoArgsConstructor
    public static class UpsertSettingRequest {
        private String setting_key;
        private String setting_value;
        private String description;

        public String getSettingKey() { return setting_key; }
        public String getSettingValue() { return setting_value != null ? setting_value : ""; }
        public String getDescription() { return description; }
    }
}
