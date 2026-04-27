package com.example.shop.modules.admin.repository;

import com.example.shop.modules.admin.entity.AdminNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminNoteRepository extends JpaRepository<AdminNote, Long> {
    Page<AdminNote> findAllByOrderByIsPinnedDescUpdatedAtDesc(Pageable pageable);
}
