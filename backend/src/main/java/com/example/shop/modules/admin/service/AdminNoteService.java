package com.example.shop.modules.admin.service;

import com.example.shop.modules.admin.entity.AdminNote;
import com.example.shop.modules.admin.repository.AdminNoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AdminNoteService {

    private final AdminNoteRepository adminNoteRepository;

    public Page<AdminNote> getNotes(int page, int size) {
        return adminNoteRepository.findAllByOrderByIsPinnedDescUpdatedAtDesc(PageRequest.of(page, size));
    }

    @Transactional
    public AdminNote createNote(String title, String content, boolean isPinned) {
        AdminNote note = AdminNote.builder()
                .title(title)
                .content(content)
                .isPinned(isPinned)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        return adminNoteRepository.save(note);
    }

    @Transactional
    public AdminNote updateNote(Long id, String title, String content, Boolean isPinned) {
        AdminNote note = adminNoteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Note not found: " + id));
        if (title != null) note.setTitle(title);
        if (content != null) note.setContent(content);
        if (isPinned != null) note.setIsPinned(isPinned);
        note.setUpdatedAt(LocalDateTime.now());
        return adminNoteRepository.save(note);
    }

    @Transactional
    public void deleteNote(Long id) {
        adminNoteRepository.deleteById(id);
    }
}
