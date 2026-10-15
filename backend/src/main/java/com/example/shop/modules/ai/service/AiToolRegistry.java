package com.example.shop.modules.ai.service;

import com.example.shop.modules.ai.dto.AiProductDto;
import com.example.shop.modules.cart.service.CartService;
import com.example.shop.modules.admin.service.AdminDashboardService;
import com.example.shop.modules.order.service.OrderService;
import com.example.shop.modules.product.dto.ProductDto;
import com.example.shop.modules.product.service.ProductService;
import com.example.shop.modules.review.service.ProductReviewService;
import com.example.shop.modules.user.entity.User;
import com.example.shop.modules.wishlist.service.WishlistService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import java.util.*;
import com.example.shop.modules.ai.provider.AiToolDefinition;

/** Strict read-only allowlist. Tool names and arguments never become SQL. */
@Service @RequiredArgsConstructor
public class AiToolRegistry {
    private static final Set<String> CUSTOMER=Set.of("search_products","get_catalog_summary","get_product_details","get_product_inventory_status","get_my_orders","get_my_order_status","get_my_cart","get_my_wishlist","recommend_products","get_product_reviews");
    private static final Set<String> ADMIN=Set.of("get_sales_summary","get_product_sales","get_order_statistics","get_customer_statistics","get_low_stock_products","get_product_marketing_insight","get_product_promotion_candidates");
    private final ProductService products; private final OrderService orders; private final CartService carts; private final WishlistService wishlist; private final ProductReviewService reviews; private final AdminDashboardService dashboard;
    public record ToolResult(Object data, List<AiProductDto> products) {}
    private static final Map<String,Object> QUERY_SCHEMA=Map.of("type","object","properties",Map.of("query",Map.of("type","string","description","Product name, category, identifier, or concise search phrase")),"additionalProperties",false);
    public List<AiToolDefinition> definitions(User user) {
        List<AiToolDefinition> all=new ArrayList<>(List.of(
                new AiToolDefinition("search_products","Find active catalog products by name, category, product ID, or attributes. Returns at most six safe product cards.",QUERY_SCHEMA),
                new AiToolDefinition("get_catalog_summary","Get active catalog products for counting, cheapest/most-expensive comparison, or shop-wide product analysis.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_product_details","Get a product's verified price, category, stock and public description. query must identify one product.",QUERY_SCHEMA),
                new AiToolDefinition("get_product_reviews","Get public review/rating summary for one product.",QUERY_SCHEMA),
                new AiToolDefinition("recommend_products","Find bounded product candidates for a shopping need or budget; use before recommending products.",QUERY_SCHEMA),
                new AiToolDefinition("get_my_orders","Get only the signed-in user's recent orders. No user identifiers are accepted.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_my_order_status","Get only the signed-in user's order history/status; query may contain their order number.",QUERY_SCHEMA),
                new AiToolDefinition("get_my_cart","Get only the signed-in user's cart.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_my_wishlist","Get only the signed-in user's wishlist.",Map.of("type","object","properties",Map.of(),"additionalProperties",false))));
        if(user!=null&&user.getAuthorities().stream().anyMatch(a->"ROLE_ADMIN".equals(a.getAuthority()))) all.addAll(List.of(
                new AiToolDefinition("get_sales_summary","Get current business overview: revenue, order counts, recent revenue and top selling products.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_low_stock_products","Get active products with low inventory.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_product_sales","Get product sales and performance analytics.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_customer_statistics","Get aggregate customer/order statistics without exposing customer records.",Map.of("type","object","properties",Map.of(),"additionalProperties",false)),
                new AiToolDefinition("get_product_marketing_insight","Get factual product data for a marketing or creator-profile analysis. query identifies a product.",QUERY_SCHEMA),
                new AiToolDefinition("get_product_promotion_candidates","Get product/catalog data for promotion prioritization.",Map.of("type","object","properties",Map.of(),"additionalProperties",false))));
        return all;
    }
    public ToolResult execute(String name, Map<String,String> args, User user) {
        if (!CUSTOMER.contains(name) && !ADMIN.contains(name)) throw new IllegalArgumentException("Unknown AI tool");
        if (ADMIN.contains(name) && (user==null || user.getAuthorities().stream().noneMatch(a->"ROLE_ADMIN".equals(a.getAuthority())))) throw new AccessDeniedException("This AI capability is restricted to administrators");
        String q=Optional.ofNullable(args.get("query")).orElse("").trim(); if(q.length()>120) throw new IllegalArgumentException("Invalid tool argument");
        if (name.equals("search_products") || name.equals("recommend_products") || name.equals("get_catalog_summary")) { List<AiProductDto> result=(name.equals("get_catalog_summary") ? products.getActiveProducts(50) : products.searchProducts(q)).stream().filter(p->Boolean.TRUE.equals(p.getActive())).limit(name.equals("get_catalog_summary") ? 50 : 6).map(this::safe).toList(); return new ToolResult(result,result); }
        if(name.equals("get_product_details") || name.equals("get_product_inventory_status") || name.equals("get_product_marketing_insight") || name.equals("get_product_promotion_candidates")) { List<AiProductDto> result=products.searchProducts(q).stream().filter(p->Boolean.TRUE.equals(p.getActive())).limit(1).map(this::safe).toList(); return new ToolResult(result,result); }
        if(name.equals("get_my_orders") || name.equals("get_my_order_status")) { requireUser(user); return new ToolResult(orders.getMyOrders(user,5),List.of()); }
        if(name.equals("get_my_cart")){requireUser(user);return new ToolResult(carts.getCart(user),List.of());}
        if(name.equals("get_my_wishlist")){requireUser(user);return new ToolResult(wishlist.getWishlist(user),List.of());}
        if(name.equals("get_product_reviews")){return new ToolResult(reviews.getReviews(q, 10, user),List.of());}
        if(name.equals("get_low_stock_products")){List<AiProductDto> r=products.getInventoryHealth(5).entrySet().stream().filter(e->"lowStockItems".equals(e.getKey())||"outOfStockItems".equals(e.getKey())).flatMap(e->e.getValue() instanceof List<?> values?values.stream():java.util.stream.Stream.empty()).filter(Map.class::isInstance).map(Map.class::cast).limit(20).map(this::safeInventory).toList(); return new ToolResult(r,r);}
        if(name.equals("get_order_statistics") || name.equals("get_sales_summary") || name.equals("get_product_sales")) return new ToolResult(dashboard.getDashboard(30, 20, 5),List.of());
        if(name.equals("get_customer_statistics")) return new ToolResult(orders.fulfillmentInsightsForStaff(),List.of());
        return new ToolResult("Information is unavailable",List.of());
    }
    private void requireUser(User user){if(user==null)throw new AccessDeniedException("Sign in is required for account data");}
    private AiProductDto safeInventory(Map<?,?> item){String id=String.valueOf(item.get("productID"));String name=String.valueOf(item.get("productName"));int stock=item.get("stockQuantity") instanceof Number n?n.intValue():0;return new AiProductDto(id,name,null,null,null,stock,stock>0,null);}
    private AiProductDto safe(ProductDto p){int stock=Optional.ofNullable(p.getStockQuantity()).orElse(0);return new AiProductDto(p.getProductID(),p.getProductName(),p.getCategory(),p.getProductReviews(),p.getProductPrice(),stock,stock>0,p.getFrontImg());}
}
