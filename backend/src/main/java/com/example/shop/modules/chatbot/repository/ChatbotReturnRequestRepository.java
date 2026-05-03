package com.example.shop.modules.chatbot.repository;

import com.example.shop.modules.chatbot.entity.ChatbotReturnRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatbotReturnRequestRepository extends JpaRepository<ChatbotReturnRequest, Long> {

    List<ChatbotReturnRequest> findByOrderNumberIgnoreCaseAndCustomerEmailIgnoreCase(
            String orderNumber, String customerEmail);

    List<ChatbotReturnRequest> findByCustomerEmailIgnoreCaseOrderByCreatedAtDesc(String customerEmail);
}
