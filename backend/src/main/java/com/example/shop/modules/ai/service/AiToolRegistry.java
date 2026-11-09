package com.example.shop.modules.ai.service;

import com.example.shop.modules.admin.service.AdminDashboardService;
import com.example.shop.modules.ai.dto.AiProductDto;
import com.example.shop.modules.ai.provider.AiToolDefinition;
import com.example.shop.modules.cart.service.CartService;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.productapproval.entity.ProductChangeRequestStatus;
import com.example.shop.modules.productapproval.repository.ProductChangeRequestRepository;
import com.example.shop.modules.resale.entity.SellerProductAllocation;
import com.example.shop.modules.resale.entity.SupplierProduct;
import com.example.shop.modules.resale.repository.SellerProductAllocationRepository;
import com.example.shop.modules.resale.repository.SupplierProductRepository;
import com.example.shop.modules.resale.service.ResaleService;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.seller.dashboard.service.SellerDashboardService;
import com.example.shop.modules.seller.order.dto.SellerOrderDto;
import com.example.shop.modules.seller.order.service.SellerOrderService;
import com.example.shop.modules.seller.catalog.service.SellerCatalogService;
import com.example.shop.modules.shipper.service.ShipperRealtimeService;
import com.example.shop.modules.supplier.dashboard.service.SupplierDashboardService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/** Server-authorized, read-only AI tools. Every management query is scoped to the authenticated principal. */
@Service
@RequiredArgsConstructor
public class AiToolRegistry {
    private static final Set<String> CUSTOMER = Set.of("search_products", "get_catalog_summary", "get_product_details",
            "get_product_inventory_status", "get_my_orders", "get_my_order_status", "get_my_cart", "get_my_wishlist",
            "recommend_products", "get_product_reviews");
    private static final Set<String> ADMIN = Set.of("get_sales_summary", "get_product_sales", "get_order_statistics",
            "get_customer_statistics", "get_low_stock_products", "get_product_marketing_insight", "get_product_promotion_candidates",
            "get_admin_operations", "get_admin_moderation_queue");
    private static final Set<String> SELLER = Set.of("get_seller_overview", "get_seller_orders", "search_supplier_offers",
            "get_seller_resale_status", "get_seller_allocations", "get_my_product_description_context");
    private static final Set<String> SUPPLIER = Set.of("get_supplier_overview", "get_supplier_requests", "get_supplier_allocations", "get_supplier_inventory");
    private static final Set<String> SHIPPER = Set.of("get_assigned_deliveries", "get_delivery_performance");

    private final ProductService products;
    private final OrderService orders;
    private final CartService carts;
    private final WishlistService wishlist;
    private final ProductReviewService reviews;
    private final AdminDashboardService dashboard;
    private final SellerDashboardService sellerDashboard;
    private final SupplierDashboardService supplierDashboard;
    private final SellerOrderService sellerOrders;
    private final SellerCatalogService sellerCatalog;
    private final ResaleService resale;
    private final SellerProductAllocationRepository allocations;
    private final SupplierProductRepository supplierProducts;
    private final ShipperRealtimeService shipper;
    private final ProductChangeRequestRepository productChangeRequests;
    private final JdbcTemplate jdbc;

    public record ToolResult(Object data, List<AiProductDto> products) {}

    private static final Map<String, Object> QUERY_SCHEMA = Map.of("type", "object", "properties", Map.of(
            "query", Map.of("type", "string", "description", "A short product name, order reference, or search phrase")), "additionalProperties", false);
    private static final Map<String, Object> EMPTY_SCHEMA = Map.of("type", "object", "properties", Map.of(), "additionalProperties", false);

    public List<AiToolDefinition> definitions(User user) {
        String role = role(user);
        List<AiToolDefinition> definitions = new ArrayList<>();
        if ("USER".equals(role) || role == null) {
            definitions.addAll(List.of(
                    tool("search_products", "Search active public catalog products", QUERY_SCHEMA),
                    tool("get_catalog_summary", "Summarize public catalog products", EMPTY_SCHEMA),
                    tool("get_product_details", "Get verified public product details", QUERY_SCHEMA),
                    tool("get_product_reviews", "Get public review summary", QUERY_SCHEMA),
                    tool("recommend_products", "Find public product candidates for a shopping need", QUERY_SCHEMA),
                    tool("get_my_orders", "Get only the signed-in customer's recent orders", EMPTY_SCHEMA),
                    tool("get_my_order_status", "Get only the signed-in customer's order status", QUERY_SCHEMA),
                    tool("get_my_cart", "Get only the signed-in customer's cart", EMPTY_SCHEMA),
                    tool("get_my_wishlist", "Get only the signed-in customer's wishlist", EMPTY_SCHEMA)));
        } else if ("ADMIN".equals(role)) {
            definitions.addAll(List.of(
                    tool("get_sales_summary", "Get platform order and revenue statistics", EMPTY_SCHEMA),
                    tool("get_product_sales", "Get platform product sales analytics", EMPTY_SCHEMA),
                    tool("get_order_statistics", "Get aggregate order statistics", EMPTY_SCHEMA),
                    tool("get_customer_statistics", "Get aggregate customer statistics", EMPTY_SCHEMA),
                    tool("get_low_stock_products", "Get platform low-stock products", EMPTY_SCHEMA),
                    tool("get_product_marketing_insight", "Get verified product facts for an admin marketing review", QUERY_SCHEMA),
                    tool("get_product_promotion_candidates", "Get verified catalog candidates for admin review", EMPTY_SCHEMA),
                    tool("get_admin_operations", "Get platform activity, pending queues, seller and supplier activity, and operational issue counts", EMPTY_SCHEMA),
                    tool("get_admin_moderation_queue", "Get a bounded list of pending product moderation records", EMPTY_SCHEMA)));
        } else if ("SELLER".equals(role)) {
            definitions.addAll(List.of(
                    tool("get_seller_overview", "Get this seller's verified sales, orders, owned listings and inventory totals", EMPTY_SCHEMA),
                    tool("get_seller_orders", "Get a bounded list of this seller's own order line summaries", EMPTY_SCHEMA),
                    tool("search_supplier_offers", "Search supplier resale offers visible to this authenticated seller", QUERY_SCHEMA),
                    tool("get_seller_resale_status", "Get this seller's own resale requests, authorizations and listings", EMPTY_SCHEMA),
                    tool("get_seller_allocations", "Get this seller's own allocated, sold, reserved and remaining inventory", EMPTY_SCHEMA),
                    tool("get_my_product_description_context", "Get this seller's own product details for a description suggestion; query must identify an owned product", QUERY_SCHEMA)));
        } else if ("SUPPLIER".equals(role)) {
            definitions.addAll(List.of(
                    tool("get_supplier_overview", "Get this supplier's verified wholesale performance, products, requests and inventory totals", EMPTY_SCHEMA),
                    tool("get_supplier_requests", "Get this supplier's recent Seller request and partnership statuses", EMPTY_SCHEMA),
                    tool("get_supplier_allocations", "Get only this supplier's allocations and allocated, sold, reserved and remaining quantities", EMPTY_SCHEMA),
                    tool("get_supplier_inventory", "Get this supplier's own offer inventory, available and reserved quantities", EMPTY_SCHEMA)));
        } else if ("SHIPPER".equals(role)) {
            definitions.addAll(List.of(
                    tool("get_assigned_deliveries", "Get recent active and completed deliveries assigned to this shipper, with recorded issue types", EMPTY_SCHEMA),
                    tool("get_delivery_performance", "Get this shipper's delivery performance for the last 30 days", EMPTY_SCHEMA)));
        }
        return definitions;
    }

    @Transactional(readOnly = true)
    public ToolResult execute(String name, Map<String, String> args, User user) {
        String role = role(user);
        if (CUSTOMER.contains(name)) {
            if (role != null && !"USER".equals(role)) throw new AccessDeniedException("Customer tools are unavailable to management roles");
            return customerTool(name, safeArgs(args), user);
        }
        Set<String> allowed = switch (role == null ? "" : role) {
            case "ADMIN" -> ADMIN;
            case "SELLER" -> SELLER;
            case "SUPPLIER" -> SUPPLIER;
            case "SHIPPER" -> SHIPPER;
            default -> Set.of();
        };
        if (!allowed.contains(name)) throw new AccessDeniedException("This AI capability is not available for your role");
        Map<String, String> safe = safeArgs(args);
        UUID ownerId = requireAuthenticated(user);
        return switch (name) {
            case "get_admin_operations" -> adminOperations();
            case "get_admin_moderation_queue" -> adminModerationQueue();
            case "get_seller_overview" -> result(sellerDashboard.getDashboard(ownerId, 30, 5));
            case "get_seller_orders" -> result(sellerOrders.listOrdersForSeller(ownerId, 20, null).stream().map(this::sellerOrderSummary).toList());
            case "search_supplier_offers" -> result(resale.browseSupplierCatalog(null, null, safe.getOrDefault("query", ""), null, null, user,
                    PageRequest.of(0, 10, Sort.by("productName"))).getContent().stream().map(o -> Map.of(
                    "productId", value(o.getProductId()), "productName", value(o.getProductName()), "supplier", value(o.getSupplierDisplayName()),
                    "wholesalePrice", o.getWholesalePrice() == null ? "not listed" : o.getWholesalePrice(), "stock", o.getStockQuantity() == null ? 0 : o.getStockQuantity(),
                    "minimumOrderQuantity", o.getMinimumOrderQuantity() == null ? 0 : o.getMinimumOrderQuantity(),
                    "allowResale", Boolean.TRUE.equals(o.getAllowResale()), "myRequestStatus", value(o.getMyRequestStatus()))).toList());
            case "get_seller_resale_status" -> result(Map.of(
                    "requests", resale.listMyRequests(null, user, PageRequest.of(0, 20)).getContent(),
                    "authorizations", resale.listSellerAuthorizations(false, user, PageRequest.of(0, 20)).getContent(),
                    "listings", resale.listMyListings(user, PageRequest.of(0, 20)).getContent()));
            case "get_seller_allocations" -> result(allocations.findActiveForSeller(ownerId).stream().map(this::sellerAllocationSummary).toList());
            case "get_my_product_description_context" -> sellerProductContext(ownerId, safe.getOrDefault("query", ""));
            case "get_supplier_overview" -> result(supplierDashboard.getDashboard(ownerId, 30, 8));
            case "get_supplier_requests" -> result(Map.of(
                    "requests", resale.listIncomingRequests(null, null, user, PageRequest.of(0, 20)).getContent(),
                    "activeAuthorizations", resale.listSupplierAuthorizations(true, user, PageRequest.of(0, 20)).getContent()));
            case "get_supplier_allocations" -> result(allocations.findAllForSupplier(ownerId).stream().map(this::supplierAllocationSummary).toList());
            case "get_supplier_inventory" -> result(supplierProducts.findBySupplierId(ownerId,
                    PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "createdAt"))).getContent().stream().map(this::supplierOfferSummary).toList());
            case "get_assigned_deliveries" -> result(shipper.listMyAssignedOrders(user, false, 100).stream().map(o -> deliverySummary(o, shipper.getOrderIssues(o.getOrderId()))).toList());
            case "get_delivery_performance" -> result(shipper.getPerformance(ownerId, null, null));
            case "get_sales_summary", "get_product_sales", "get_order_statistics" -> result(dashboard.getDashboard(30, 10, 5));
            case "get_customer_statistics" -> result(orders.fulfillmentInsightsForStaff());
            case "get_low_stock_products" -> lowStockProducts();
            case "get_product_marketing_insight", "get_product_promotion_candidates" -> publicProductContext(safe.getOrDefault("query", ""));
            default -> throw new AccessDeniedException("Unknown AI capability");
        };
    }

    private ToolResult customerTool(String name, Map<String, String> args, User user) {
        String query = args.getOrDefault("query", "");
        if (Set.of("search_products", "recommend_products", "get_catalog_summary").contains(name)) {
            List<AiProductDto> found = ("get_catalog_summary".equals(name) ? products.getActiveProducts(50) : products.searchProducts(query)).stream()
                    .filter(p -> Boolean.TRUE.equals(p.getActive())).limit("get_catalog_summary".equals(name) ? 50 : 6).map(this::safe).toList();
            return new ToolResult(found, found);
        }
        if (Set.of("get_product_details", "get_product_inventory_status", "get_product_marketing_insight", "get_product_promotion_candidates").contains(name)) return publicProductContext(query);
        if ("get_my_orders".equals(name) || "get_my_order_status".equals(name)) { requireAuthenticated(user); return result(orders.getMyOrders(user, 5)); }
        if ("get_my_cart".equals(name)) { requireAuthenticated(user); return result(carts.getCart(user)); }
        if ("get_my_wishlist".equals(name)) { requireAuthenticated(user); return result(wishlist.getWishlist(user)); }
        if ("get_product_reviews".equals(name)) return result(reviews.getReviews(query, 10, user));
        throw new IllegalArgumentException("Unknown customer tool");
    }

    private ToolResult adminOperations() {
        Map<String, Object> data = new LinkedHashMap<>();
        var d = dashboard.getDashboard(30, 5, 5);
        data.put("platform", Map.of("totalUsers", d.totalUsers(), "activeUsers", d.activeUsers(), "totalProducts", d.totalProducts(),
                "activeProducts", d.activeProducts(), "totalOrders", d.totalOrders(), "totalRevenue", d.totalRevenue(),
                "pendingOrders", d.pendingOrders(), "lowStockProducts", d.lowStockProducts()));
        data.put("sellerAccounts", scalar("select count(distinct ur.users_id) from user_roles ur join roles r on r.roles_id=ur.roles_id where r.roles_name='ROLE_SELLER'"));
        data.put("supplierAccounts", scalar("select count(distinct ur.users_id) from user_roles ur join roles r on r.roles_id=ur.roles_id where r.roles_name='ROLE_SUPPLIER'"));
        data.put("pendingProductModeration", productChangeRequests.countByStatus(ProductChangeRequestStatus.PENDING));
        data.put("pendingSupplierOfferApprovals", supplierProducts.countByApprovedFalse());
        data.put("pendingSellerResaleRequests", scalar("select count(*) from seller_resale_requests where status='PENDING'"));
        data.put("openDeliveryIssues", scalar("select count(*) from shipper_issue_logs where status='OPEN'"));
        return result(data);
    }

    private ToolResult adminModerationQueue() {
        var page = productChangeRequests.findByStatusOrderByCreatedAtAsc(ProductChangeRequestStatus.PENDING, PageRequest.of(0, 20));
        List<Map<String, Object>> rows = page.getContent().stream()
                .map(r -> Map.<String, Object>of("requestId", r.getId(), "action", r.getActionType(),
                        "productId", value(r.getTargetProductId()), "submittedBy", r.getRequestedBy() == null ? "unknown" : value(r.getRequestedBy().getEmail()),
                        "requestPayload", r.getRequestPayload() == null ? "" : r.getRequestPayload().substring(0, Math.min(800, r.getRequestPayload().length())),
                        "submittedAt", r.getCreatedAt() == null ? "unknown" : r.getCreatedAt())).toList();
        return result(Map.of("totalPending", page.getTotalElements(), "items", rows));
    }

    private ToolResult lowStockProducts() {
        List<AiProductDto> found = products.getInventoryHealth(5).values().stream().filter(List.class::isInstance).flatMap(v -> ((List<?>) v).stream())
                .filter(Map.class::isInstance).map(Map.class::cast).limit(20).map(this::safeInventory).toList();
        return new ToolResult(found, found);
    }

    private ToolResult publicProductContext(String query) {
        List<AiProductDto> found = products.searchProducts(query).stream().filter(p -> Boolean.TRUE.equals(p.getActive())).limit(3).map(this::safe).toList();
        return new ToolResult(found, found);
    }

    private ToolResult sellerProductContext(UUID sellerId, String query) {
        String q = query.trim();
        if (q.isBlank()) throw new IllegalArgumentException("A product name or ID is required");
        List<Map<String, Object>> owned = sellerCatalog.listSellerProducts(sellerId, q).stream().limit(5).map(p -> {
            Map<String, Object> row = new LinkedHashMap<>(); row.put("productId", p.getProductID()); row.put("productName", p.getProductName());
            row.put("category", p.getCategory()); row.put("brand", p.getBrand()); row.put("sku", p.getSku());
            row.put("currentPrice", p.getProductPrice()); row.put("stock", p.getStockQuantity()); return row;
        }).toList();
        return result(Map.of("ownedProducts", owned));
    }

    private Map<String, Object> sellerOrderSummary(SellerOrderDto o) {
        Map<String, Object> row = new LinkedHashMap<>(); row.put("orderNumber", o.getOrderNumber()); row.put("productId", o.getProductId());
        row.put("productName", o.getProductName()); row.put("quantity", o.getQuantity()); row.put("lineTotal", o.getLineTotal());
        row.put("orderStatus", o.getOrderStatus()); row.put("paymentStatus", o.getPaymentStatus()); row.put("createdAt", o.getCreatedAt()); return row;
    }

    private Map<String, Object> sellerAllocationSummary(SellerProductAllocation a) {
        return Map.of("productName", a.getSupplierOffer() == null || a.getSupplierOffer().getProduct() == null ? "unknown" : value(a.getSupplierOffer().getProduct().getProductName()),
                "allocated", n(a.getAllocatedQuantity()), "sold", n(a.getSoldQuantity()), "reserved", n(a.getReservedQuantity()),
                "remaining", Math.max(0, n(a.getAllocatedQuantity()) - n(a.getSoldQuantity()) - n(a.getReservedQuantity())));
    }

    private Map<String, Object> supplierAllocationSummary(SellerProductAllocation a) {
        return Map.of("productName", a.getSupplierOffer() == null || a.getSupplierOffer().getProduct() == null ? "unknown" : value(a.getSupplierOffer().getProduct().getProductName()),
                "seller", a.getListing() == null || a.getListing().getSeller() == null ? "unknown" : value(a.getListing().getSeller().getName()),
                "allocated", n(a.getAllocatedQuantity()), "sold", n(a.getSoldQuantity()), "reserved", n(a.getReservedQuantity()),
                "remaining", Math.max(0, n(a.getAllocatedQuantity()) - n(a.getSoldQuantity()) - n(a.getReservedQuantity())));
    }

    private Map<String, Object> supplierOfferSummary(SupplierProduct o) {
        return Map.of("productId", o.getProduct() == null ? "unknown" : value(o.getProduct().getProductID()),
                "productName", o.getProduct() == null ? "unknown" : value(o.getProduct().getProductName()),
                "wholesalePrice", o.getWholesalePrice() == null ? "not listed" : o.getWholesalePrice(),
                "stock", n(o.getStockQuantity()), "reserved", n(o.getReservedQuantity()),
                "available", Math.max(0, n(o.getStockQuantity()) - n(o.getReservedQuantity())),
                "minimumOrderQuantity", n(o.getMinimumOrderQuantity()), "approved", Boolean.TRUE.equals(o.getApproved()),
                "resaleEnabled", Boolean.TRUE.equals(o.getAllowResale()));
    }

    private Map<String, Object> deliverySummary(com.example.shop.modules.shipper.dto.ShipperDtos.AssignedOrderItem o,
            List<com.example.shop.modules.shipper.dto.ShipperDtos.IssueResponse> issues) {
        Map<String, Object> row = new LinkedHashMap<>(); row.put("orderNumber", o.getOrderNumber()); row.put("status", o.getOrderStatus());
        row.put("expectedDeliveryAt", o.getExpectedDeliveryAt()); row.put("pickedUpAt", o.getPickedUpAt()); row.put("deliveredAt", o.getDeliveredAt()); row.put("failedAt", o.getFailedAt());
        row.put("issues", issues.stream().map(i -> Map.of("type", i.getIssueType(), "status", i.getStatus(), "createdAt", i.getCreatedAt())).toList()); return row;
    }

    private Long scalar(String sql) { Long value = jdbc.queryForObject(sql, Long.class); return value == null ? 0L : value; }
    private ToolResult result(Object data) { return new ToolResult(data, List.of()); }
    private AiToolDefinition tool(String name, String description, Map<String, Object> schema) { return new AiToolDefinition(name, description, schema); }
    private UUID requireAuthenticated(User user) { if (user == null || user.getId() == null) throw new AccessDeniedException("Sign in is required"); return user.getId(); }
    private String role(User user) {
        if (user == null) return null;
        Set<String> authorities = user.getAuthorities().stream().map(a -> a.getAuthority()).collect(Collectors.toSet());
        for (String role : List.of("ADMIN", "SUPPLIER", "SELLER", "SHIPPER", "EMPLOYEE", "USER")) if (authorities.contains("ROLE_" + role)) return role;
        return null;
    }
    private Map<String, String> safeArgs(Map<String, String> args) {
        Map<String, String> safe = new HashMap<>(); String q = args == null ? null : args.get("query");
        if (q != null) { String trimmed = q.trim(); if (trimmed.length() > 120) throw new IllegalArgumentException("Invalid tool argument"); safe.put("query", trimmed); }
        return safe;
    }
    private int n(Integer value) { return value == null ? 0 : value; }
    private String value(String value) { return value == null ? "" : value; }
    private AiProductDto safe(ProductDto p) { int stock = n(p.getStockQuantity()); return new AiProductDto(p.getProductID(), p.getProductName(), p.getCategory(), p.getProductReviews(), p.getProductPrice(), stock, stock > 0, p.getFrontImg()); }
    private AiProductDto safeInventory(Map<?, ?> item) { String id = String.valueOf(item.get("productID")); String name = String.valueOf(item.get("productName")); int stock = item.get("stockQuantity") instanceof Number x ? x.intValue() : 0; return new AiProductDto(id, name, null, null, null, stock, stock > 0, null); }
}
