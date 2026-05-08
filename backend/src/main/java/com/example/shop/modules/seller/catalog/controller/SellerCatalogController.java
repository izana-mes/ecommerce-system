package com.example.shop.modules.seller.catalog.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.seller.catalog.service.SellerCatalogService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/seller/products")
@RequiredArgsConstructor
public class SellerCatalogController {

    private final SellerCatalogService catalogService;

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
    public ResponseEntity<ApiResponse<ProductDto>> create(
            @AuthenticationPrincipal User user,
            @RequestBody ProductDto payload
    ) {
        ProductDto created = catalogService.createSellerProduct(user.getId(), payload);
        return ResponseEntity.ok(ApiResponse.success(created, "Product created"));
    }

    @PutMapping("/{productID}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<ProductDto>> update(
            @AuthenticationPrincipal User user,
            @PathVariable("productID") String productID,
            @RequestBody ProductDto payload
    ) {
        ProductDto updated = catalogService.updateSellerProduct(user.getId(), productID, payload);
        return ResponseEntity.ok(ApiResponse.success(updated, "Product updated"));
    }

    @DeleteMapping("/{productID}")
    @PreAuthorize("hasRole('SELLER')")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal User user,
            @PathVariable("productID") String productID
    ) {
        catalogService.deleteSellerProduct(user.getId(), productID);
        return ResponseEntity.ok(ApiResponse.success(null, "Product deleted"));
    }
}

