package com.example.shop.modules.resale.controller;

import com.example.shop.modules.resale.dto.SupplierPublicProfileDto;
import com.example.shop.modules.resale.service.ResaleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/suppliers")
@RequiredArgsConstructor
public class PublicSupplierProfileController {

    private final ResaleService resaleService;

    @GetMapping("/{supplierId}/public-profile")
    public ResponseEntity<SupplierPublicProfileDto> getPublicProfile(@PathVariable UUID supplierId) {
        return ResponseEntity.ok(resaleService.getSupplierPublicProfile(supplierId));
    }
}
