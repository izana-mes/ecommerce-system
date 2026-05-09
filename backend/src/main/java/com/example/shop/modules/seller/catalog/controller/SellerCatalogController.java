package com.example.shop.modules.seller.catalog.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.productapproval.dto.ProductChangeRequestResponseDto;
import com.example.shop.modules.seller.catalog.service.SellerCatalogService;
import com.example.shop.modules.productapproval.service.ProductChangeRequestService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/seller/products")
@RequiredArgsConstructor
public class SellerCatalogController {

    private final SellerCatalogService catalogService;
    private final ProductChangeRequestService productChangeRequestService;

    @GetMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<List<ProductDto>>> list(
            @AuthenticationPrincipal User user,
            @RequestParam(value = "q", required = false) String query
    ) {
        List<ProductDto> products = catalogService.listSellerProducts(user.getId(), query);
        return ResponseEntity.ok(ApiResponse.success(products));
    }

    @PostMapping
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<Map<String, Object>> create(
            @AuthenticationPrincipal User user,
            @RequestBody ProductDto payload
    ) {
        ProductChangeRequestResponseDto request = productChangeRequestService.requestCreate(payload, user);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Product create request submitted for admin approval",
                "request", request
        ));
    }

    @PutMapping("/{productID}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<Map<String, Object>> update(
            @AuthenticationPrincipal User user,
            @PathVariable("productID") String productID,
            @RequestBody ProductDto payload
    ) {
        ProductChangeRequestResponseDto request = productChangeRequestService.requestUpdate(productID, payload, user);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Product update request submitted for admin approval",
                "request", request
        ));
    }

    @DeleteMapping("/{productID}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<Map<String, Object>> delete(
            @AuthenticationPrincipal User user,
            @PathVariable("productID") String productID
    ) {
        ProductChangeRequestResponseDto request = productChangeRequestService.requestDelete(productID, user);
        return ResponseEntity.accepted().body(Map.of(
                "message", "Product delete request submitted for admin approval",
                "request", request
        ));
    }
}
