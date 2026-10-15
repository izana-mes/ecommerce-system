package com.example.shop.modules.ai.dto;

/** Deliberately small public projection; never a JPA entity. */
public record AiProductDto(String id, String name, String category, String description,
                           Double price, Integer stockQuantity, boolean inStock, String imageUrl) {}
