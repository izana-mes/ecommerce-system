package com.example.shop.modules.review.service;

import com.example.shop.modules.messaging.review.ReviewSubmittedEvent;
import com.example.shop.modules.messaging.review.ReviewSubmittedPublisher;
import com.example.shop.modules.product.entity.Product;
import com.example.shop.modules.product.repository.ProductRepository;
import com.example.shop.modules.review.dto.ProductReviewRequest;
import com.example.shop.modules.user.entity.User;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProductReviewServiceImplTest {

    private StringRedisTemplate redisTemplate;
    private ListOperations<String, String> listOperations;
    private ObjectMapper objectMapper;
    private ProductRepository productRepository;
    private ReviewSubmittedPublisher reviewSubmittedPublisher;
    private ProductReviewServiceImpl reviewService;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        redisTemplate = mock(StringRedisTemplate.class);
        listOperations = mock(ListOperations.class);
        objectMapper = new ObjectMapper();
        productRepository = mock(ProductRepository.class);
        reviewSubmittedPublisher = mock(ReviewSubmittedPublisher.class);

        when(redisTemplate.opsForList()).thenReturn(listOperations);

        reviewService = new ProductReviewServiceImpl(
                redisTemplate,
                objectMapper,
                productRepository,
                reviewSubmittedPublisher
        );
        ReflectionTestUtils.setField(reviewService, "maxEntries", 200);
        ReflectionTestUtils.setField(reviewService, "ttlDays", 180L);
    }

    @Test
    void addReviewPublishesReviewSubmittedEventWithEnrichedDetails() {
        Product product = Product.builder()
                .productID("P-500")
                .productName("Wireless Headphones")
                .build();
        when(productRepository.findByProductID("P-500")).thenReturn(Optional.of(product));

        User user = User.builder()
                .email("reviewer@example.com")
                .firstName("Jane")
                .lastName("Doe")
                .build();

        ProductReviewRequest request = new ProductReviewRequest();
        request.setRating(5);
        request.setComment("Excellent sound quality!");

        reviewService.addReview("P-500", request, user);

        verify(listOperations).leftPush(eq("reviews:product:P-500"), anyString());

        ArgumentCaptor<ReviewSubmittedEvent> eventCaptor = ArgumentCaptor.forClass(ReviewSubmittedEvent.class);
        verify(reviewSubmittedPublisher).publish(eventCaptor.capture());

        ReviewSubmittedEvent event = eventCaptor.getValue();
        assertThat(event.getProductId()).isEqualTo("P-500");
        assertThat(event.getProductName()).isEqualTo("Wireless Headphones");
        assertThat(event.getRating()).isEqualTo(5);
        assertThat(event.getComment()).isEqualTo("Excellent sound quality!");
        assertThat(event.getCustomerEmail()).isEqualTo("reviewer@example.com");
    }
}
