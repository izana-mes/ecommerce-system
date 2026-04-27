package com.example.shop.modules.admin.controller;

import com.example.shop.common.response.ApiResponse;
import com.example.shop.modules.admin.entity.AdminNote;
import com.example.shop.modules.admin.service.AdminNoteService;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/notes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotesController {

    private final AdminNoteService adminNoteService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> getNotes(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        int pageIndex = Math.max(0, page - 1);
        int pageSize = Math.min(50, size);
        Page<AdminNote> result = adminNoteService.getNotes(pageIndex, pageSize);
        Map<String, Object> body = Map.of(
                "content", result.getContent(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                "number", result.getNumber(),
                "size", result.getSize()
        );
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminNote>> createNote(@RequestBody NoteRequest body) {
        String title = body.getTitle() != null ? body.getTitle().trim() : "";
        String content = body.getContent() != null ? body.getContent().trim() : "";
        if (title.isEmpty() && content.isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Title or content is required"));
        }
        AdminNote note = adminNoteService.createNote(title, content, Boolean.TRUE.equals(body.getIsPinned()));
        return ResponseEntity.ok(ApiResponse.success(note, "Note created"));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<String>> updateNote(@RequestBody NoteRequest body) {
        if (body.getId() == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Note id is required"));
        }
        adminNoteService.updateNote(body.getId(), body.getTitle(), body.getContent(), body.getIsPinned());
        return ResponseEntity.ok(ApiResponse.success("Note updated"));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<String>> deleteNote(@RequestBody NoteRequest body) {
        if (body.getId() == null) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Note id is required"));
        }
        adminNoteService.deleteNote(body.getId());
        return ResponseEntity.ok(ApiResponse.success("Note deleted"));
    }

    @Data
    @NoArgsConstructor
    public static class NoteRequest {
        private Long id;
        private String title;
        private String content;
        private Boolean is_pinned;

        public Boolean getIsPinned() { return is_pinned; }
    }
}
