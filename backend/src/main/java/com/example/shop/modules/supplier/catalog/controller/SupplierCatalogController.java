package com.example.shop.modules.supplier.catalog.controller;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.productapproval.dto.ProductChangeRequestResponseDto;
import com.example.shop.modules.productapproval.service.ProductChangeRequestService;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Supplier-specific catalog operations beyond the generic product approval flow.
 *
 * <p>POST /api/v1/supplier/catalog/csv-bulk  – upload a CSV of product proposals
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/supplier/catalog")
@RequiredArgsConstructor
public class SupplierCatalogController {

    private final ProductChangeRequestService productChangeRequestService;

    /**
     * POST /api/v1/supplier/catalog/csv-bulk
     *
     * <p>Accepts a multipart CSV file and converts each row into a BULK_UPSERT
     * product change request pending admin approval.
     *
     * <p>Expected CSV columns (header row required):
     * {@code productID,productName,category,productPrice,stockQuantity,sizes,active}
     *
     * <ul>
     *   <li>{@code sizes} – pipe-separated list, e.g. {@code S|M|L|XL}
     *   <li>{@code active} – {@code true} or {@code false}
     * </ul>
     *
     * <p>Example response:
     * <pre>{@code
     * {
     *   "success": true,
     *   "message": "Bulk upload submitted: 5 products pending admin approval",
     *   "data": { "id": "...", "actionType": "BULK_UPSERT", "status": "PENDING", ... }
     * }
     * }</pre>
     */
    @PostMapping("/csv-bulk")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<ApiResponse<ProductChangeRequestResponseDto>> csvBulkUpload(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) {
        if (file.isEmpty()) {
            throw new BusinessException("Uploaded CSV file is empty", HttpStatus.BAD_REQUEST);
        }

        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".csv")) {
            throw new BusinessException("Only .csv files are accepted", HttpStatus.BAD_REQUEST);
        }

        List<ProductDto> products = parseCsv(file);
        if (products.isEmpty()) {
            throw new BusinessException("CSV contains no valid product rows", HttpStatus.BAD_REQUEST);
        }

        ProductChangeRequestResponseDto request = productChangeRequestService.requestBulkUpsert(products, user);

        log.info("Supplier {} submitted CSV bulk upload with {} products (requestId={})",
                user.getId(), products.size(), request.getId());

        return ResponseEntity.accepted().body(
                ApiResponse.success(request,
                        "Bulk upload submitted: " + products.size() + " products pending admin approval")
        );
    }

    /**
     * GET /api/v1/supplier/catalog/csv-template
     *
     * Returns the expected CSV header/template as a plain-text download.
     */
    @GetMapping("/csv-template")
    @PreAuthorize("hasRole('SUPPLIER')")
    public ResponseEntity<String> getCsvTemplate() {
        String template = "productID,productName,category,productPrice,stockQuantity,sizes,active\n" +
                "EXAMPLE-001,Example Product,Electronics,29.99,100,S|M|L,true\n";
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv")
                .header("Content-Disposition", "attachment; filename=\"supplier-product-template.csv\"")
                .body(template);
    }

    // ── CSV parsing ──────────────────────────────────────────────────────────

    private List<ProductDto> parseCsv(MultipartFile file) {
        List<ProductDto> products = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new BusinessException("CSV file has no header row", HttpStatus.BAD_REQUEST);
            }

            Map<String, Integer> columnIndex = buildColumnIndex(headerLine);
            validateRequiredColumns(columnIndex);

            String line;
            int rowNum = 1;
            while ((line = reader.readLine()) != null) {
                rowNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                try {
                    ProductDto dto = parseRow(line, columnIndex);
                    if (dto != null) products.add(dto);
                } catch (Exception ex) {
                    log.warn("CSV bulk upload: skipping invalid row {} – {}", rowNum, ex.getMessage());
                }
            }
        } catch (BusinessException be) {
            throw be;
        } catch (Exception ex) {
            throw new BusinessException("Failed to parse CSV: " + ex.getMessage(), HttpStatus.BAD_REQUEST);
        }
        return products;
    }

    private Map<String, Integer> buildColumnIndex(String headerLine) {
        String[] headers = splitCsvLine(headerLine);
        java.util.Map<String, Integer> index = new java.util.LinkedHashMap<>();
        for (int i = 0; i < headers.length; i++) {
            index.put(headers[i].trim().toLowerCase(), i);
        }
        return index;
    }

    private void validateRequiredColumns(Map<String, Integer> index) {
        List<String> required = List.of("productid", "productname", "productprice");
        List<String> missing = required.stream().filter(c -> !index.containsKey(c)).toList();
        if (!missing.isEmpty()) {
            throw new BusinessException(
                    "CSV is missing required columns: " + String.join(", ", missing), HttpStatus.BAD_REQUEST);
        }
    }

    private ProductDto parseRow(String line, Map<String, Integer> idx) {
        String[] cols = splitCsvLine(line);
        ProductDto dto = new ProductDto();

        dto.setProductID(cell(cols, idx, "productid"));
        dto.setProductName(cell(cols, idx, "productname"));
        dto.setCategory(cell(cols, idx, "category"));

        String priceStr = cell(cols, idx, "productprice");
        if (priceStr != null) {
            try {
                dto.setProductPrice(Double.parseDouble(priceStr));
            } catch (NumberFormatException ignore) { /* skip invalid price */ }
        }

        String stockStr = cell(cols, idx, "stockquantity");
        if (stockStr != null) {
            try {
                dto.setStockQuantity(Integer.parseInt(stockStr));
            } catch (NumberFormatException ignore) { /* skip invalid stock */ }
        }

        String sizesStr = cell(cols, idx, "sizes");
        if (sizesStr != null && !sizesStr.isBlank()) {
            dto.setSizes(Arrays.asList(sizesStr.split("\\|")));
        }

        String activeStr = cell(cols, idx, "active");
        dto.setActive(activeStr == null || "true".equalsIgnoreCase(activeStr.trim()));

        // Skip rows with no product ID or name
        if ((dto.getProductID() == null || dto.getProductID().isBlank())
                && (dto.getProductName() == null || dto.getProductName().isBlank())) {
            return null;
        }
        return dto;
    }

    private String cell(String[] cols, Map<String, Integer> idx, String colName) {
        Integer i = idx.get(colName);
        if (i == null || i >= cols.length) return null;
        String val = cols[i].trim();
        return val.isEmpty() ? null : val;
    }

    /** Naive CSV split — handles simple unquoted fields separated by commas. */
    private String[] splitCsvLine(String line) {
        return line.split(",", -1);
    }
}
