package com.example.shop.modules.seller.catalog.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.mapper.ProductMapper;
import com.example.shop.modules.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class SellerCatalogServiceImpl implements SellerCatalogService {

    private final ProductRepository productRepository;
    private final ProductMapper productMapper;

    @Override
    @Transactional(readOnly = true)
    public List<ProductDto> listSellerProducts(UUID sellerUserId, String query) {
        if (sellerUserId == null) {
            return List.of();
        }

        List<Product> products = productRepository.findBySellerUserIdOrderByIdAsc(sellerUserId);
        if (!StringUtils.hasText(query)) {
            return products.stream().map(productMapper::toDto).toList();
        }

        String normalized = query.trim().toLowerCase(Locale.ROOT);
        return products.stream()
                .filter(product -> matchesQuery(product, normalized))
                .map(productMapper::toDto)
                .toList();
    }

    @Override
    public ProductDto createSellerProduct(UUID sellerUserId, ProductDto payload) {
        requireSeller(sellerUserId);
        requirePayload(payload);

        String productId = trimToNull(payload.getProductID());
        if (!StringUtils.hasText(productId)) {
            throw new BusinessException("productID is required", HttpStatus.BAD_REQUEST);
        }
        if (productRepository.findByProductID(productId).isPresent()) {
            throw new BusinessException("Product already exists: " + productId, HttpStatus.CONFLICT);
        }

        Product entity = productMapper.toEntity(payload);
        entity.setProductID(productId);
        entity.setSellerUserId(sellerUserId);
        entity.setSupplierUserId(null);
        applySellerDefaults(entity);

        Product saved = productRepository.save(entity);
        return productMapper.toDto(saved);
    }

    @Override
    public ProductDto updateSellerProduct(UUID sellerUserId, String productId, ProductDto payload) {
        requireSeller(sellerUserId);
        if (!StringUtils.hasText(productId)) {
            throw new BusinessException("productID is required", HttpStatus.BAD_REQUEST);
        }
        requirePayload(payload);

        Product existing = productRepository.findByProductID(productId)
                .orElseThrow(() -> new BusinessException("Product not found: " + productId, HttpStatus.NOT_FOUND));

        assertOwnsProduct(existing, sellerUserId);

        existing.setFrontImg(payload.getFrontImg());
        existing.setBackImg(payload.getBackImg());
        existing.setProductName(payload.getProductName());
        existing.setProductPrice(payload.getProductPrice());
        existing.setProductReviews(payload.getProductReviews());
        existing.setCategory(trimToDefault(payload.getCategory(), "Uncategorized"));
        existing.setSizes(productMapper.map(payload.getSizes()));
        existing.setStockQuantity(payload.getStockQuantity());
        existing.setActive(payload.getActive() != null ? payload.getActive() : existing.getActive());

        applySellerDefaults(existing);

        Product saved = productRepository.save(existing);
        return productMapper.toDto(saved);
    }

    @Override
    public void deleteSellerProduct(UUID sellerUserId, String productId) {
        requireSeller(sellerUserId);
        if (!StringUtils.hasText(productId)) {
            throw new BusinessException("productID is required", HttpStatus.BAD_REQUEST);
        }

        Product existing = productRepository.findByProductID(productId)
                .orElseThrow(() -> new BusinessException("Product not found: " + productId, HttpStatus.NOT_FOUND));
        assertOwnsProduct(existing, sellerUserId);
        productRepository.delete(existing);
    }

    private void requireSeller(UUID sellerUserId) {
        if (sellerUserId == null) {
            throw new BusinessException("Seller is required", HttpStatus.UNAUTHORIZED);
        }
    }

    private void requirePayload(ProductDto payload) {
        if (payload == null) {
            throw new BusinessException("Payload is required", HttpStatus.BAD_REQUEST);
        }
    }

    private void assertOwnsProduct(Product product, UUID sellerUserId) {
        if (product == null || sellerUserId == null || !sellerUserId.equals(product.getSellerUserId())) {
            throw new BusinessException("You do not own this product", HttpStatus.FORBIDDEN);
        }
    }

    private void applySellerDefaults(Product product) {
        if (product.getStockQuantity() == null) {
            product.setStockQuantity(25);
        }
        if (product.getActive() == null) {
            product.setActive(true);
        }
        if (product.getFrontImg() == null) {
            product.setFrontImg("");
        }
        if (product.getProductName() == null) {
            product.setProductName("");
        }
        if (product.getProductPrice() == null) {
            product.setProductPrice(0.0);
        }
        if (!StringUtils.hasText(product.getCategory())) {
            product.setCategory("Uncategorized");
        }
    }

    private boolean matchesQuery(Product product, String loweredQuery) {
        if (product == null || !StringUtils.hasText(loweredQuery)) {
            return true;
        }
        String name = product.getProductName() == null ? "" : product.getProductName().toLowerCase(Locale.ROOT);
        String id = product.getProductID() == null ? "" : product.getProductID().toLowerCase(Locale.ROOT);
        String category = product.getCategory() == null ? "" : product.getCategory().toLowerCase(Locale.ROOT);
        return name.contains(loweredQuery) || id.contains(loweredQuery) || category.contains(loweredQuery);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String trimToDefault(String value, String defaultValue) {
        String trimmed = trimToNull(value);
        return trimmed == null ? defaultValue : trimmed;
    }
}
