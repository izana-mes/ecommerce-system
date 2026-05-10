package com.example.shop.modules.seller.catalog.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.seller.catalog.dto.PromotionRequest;
import com.example.shop.modules.seller.catalog.dto.PromotionResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SellerPromotionServiceImpl implements SellerPromotionService {

    private final ProductRepository productRepository;

    @Override
    @Transactional
    public PromotionResponse applyPromotion(UUID sellerUserId, String productId, PromotionRequest request) {
        Product product = findOwnedProduct(sellerUserId, productId);

        double currentPrice = product.getProductPrice();
        double salePrice = request.getSalePrice();

        if (salePrice >= currentPrice) {
            throw new BusinessException(
                    "Sale price (%.2f) must be less than the current price (%.2f)".formatted(salePrice, currentPrice),
                    HttpStatus.BAD_REQUEST);
        }

        // Preserve original price in oldPrice only if no promotion is active yet
        if (product.getOldPrice() == null) {
            product.setOldPrice(currentPrice);
        }
        product.setProductPrice(salePrice);
        productRepository.save(product);

        log.info("Seller {} applied promotion on product {}: {} → {}",
                sellerUserId, productId, currentPrice, salePrice);

        return PromotionResponse.builder()
                .productId(product.getProductID())
                .productName(product.getProductName())
                .originalPrice(product.getOldPrice())
                .salePrice(salePrice)
                .onPromotion(true)
                .message("Promotion applied successfully")
                .build();
    }

    @Override
    @Transactional
    public PromotionResponse clearPromotion(UUID sellerUserId, String productId) {
        Product product = findOwnedProduct(sellerUserId, productId);

        if (product.getOldPrice() == null) {
            throw new BusinessException("No active promotion found for product: " + productId,
                    HttpStatus.BAD_REQUEST);
        }

        double restoredPrice = product.getOldPrice();
        product.setProductPrice(restoredPrice);
        product.setOldPrice(null);
        productRepository.save(product);

        log.info("Seller {} cleared promotion on product {}, price restored to {}",
                sellerUserId, productId, restoredPrice);

        return PromotionResponse.builder()
                .productId(product.getProductID())
                .productName(product.getProductName())
                .originalPrice(restoredPrice)
                .salePrice(null)
                .onPromotion(false)
                .message("Promotion cleared. Price restored to original.")
                .build();
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private Product findOwnedProduct(UUID sellerUserId, String productId) {
        Product product = productRepository.findByProductID(productId)
                .orElseThrow(() -> new BusinessException("Product not found: " + productId, HttpStatus.NOT_FOUND));

        if (!sellerUserId.equals(product.getSellerUserId())) {
            throw new BusinessException("You do not own this product", HttpStatus.FORBIDDEN);
        }
        return product;
    }
}
