package com.example.shop.modules.expense.repository;

import com.example.shop.modules.expense.entity.UserExpense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserExpenseRepository extends JpaRepository<UserExpense, Long> {

    Page<UserExpense> findByUserIdOrderBySpentOnDescIdDesc(UUID userId, Pageable pageable);

    Optional<UserExpense> findByIdAndUserId(Long id, UUID userId);
}
