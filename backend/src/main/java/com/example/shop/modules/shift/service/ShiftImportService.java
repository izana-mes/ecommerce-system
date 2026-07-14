package com.example.shop.modules.shift.service;

import com.example.shop.common.exception.BusinessException;
import com.example.shop.modules.shift.dto.ShiftDtos.*;
import com.example.shop.modules.shift.entity.Shift;
import com.example.shop.modules.shift.entity.ShiftImportBatch;
import com.example.shop.modules.shift.entity.ShiftImportStatus;
import com.example.shop.modules.shift.entity.ShiftRole;
import com.example.shop.modules.shift.entity.ShiftSource;
import com.example.shop.modules.shift.repository.ShiftRepository;
import com.example.shop.modules.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.apache.poi.ss.usermodel.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ShiftImportService {
    private static final List<String> REQUIRED_HEADERS = List.of(
            "employee_code", "role", "shift_date", "start_time", "end_time", "location", "note"
    );

    private final ShiftService shiftService;
    private final ShiftRepository shiftRepository;
    private final TransactionTemplate transactionTemplate;
    private final JdbcTemplate jdbcTemplate;

    public ImportPreviewResponse preview(MultipartFile file, String timezone) {
        List<RawRow> rawRows = parse(file);
        List<ImportRow> rows = validateRows(rawRows, timezone, null);
        long valid = rows.stream().filter(ImportRow::valid).count();
        return new ImportPreviewResponse(file.getOriginalFilename(), rows.size(), (int) valid, rows.size() - (int) valid, rows);
    }

    public ImportExecuteResponse execute(MultipartFile file, String timezone, User actor) {
        List<RawRow> rawRows = parse(file);
        ShiftImportBatch batch = shiftService.saveImportBatch(ShiftImportBatch.builder()
                .fileName(Optional.ofNullable(file.getOriginalFilename()).orElse("schedule-import"))
                .fileType(extension(file))
                .status(ShiftImportStatus.PREVIEWED)
                .totalRows(rawRows.size())
                .createdBy(actor)
                .build());
        List<ImportRow> rows = validateRows(rawRows, timezone, batch.getId());
        List<ImportRow> invalid = rows.stream().filter(row -> !row.valid()).toList();
        if (!invalid.isEmpty()) {
            batch.setStatus(ShiftImportStatus.FAILED);
            batch.setInvalidRows(invalid.size());
            batch.setValidRows(rows.size() - invalid.size());
            batch.setErrorSummary("Import rejected because " + invalid.size() + " row(s) failed validation.");
            batch.setCompletedAt(Instant.now());
            shiftService.saveImportBatch(batch);
            auditImport(batch, actor);
            throw new BusinessException(batch.getErrorSummary());
        }

        try {
            Integer imported = transactionTemplate.execute(status -> {
                int count = 0;
                for (RawRow raw : rawRows) {
                    ShiftRequest request = toRequest(raw, timezone);
                    Shift shift = shiftService.buildShift(request, actor, ShiftSource.IMPORT, batch.getId());
                    shiftService.validateNoConflict(shift, null);
                    shiftRepository.save(shift);
                    count += 1;
                }
                return count;
            });
            batch.setStatus(ShiftImportStatus.IMPORTED);
            batch.setValidRows(rows.size());
            batch.setImportedRows(imported == null ? 0 : imported);
            batch.setCompletedAt(Instant.now());
            shiftService.saveImportBatch(batch);
            auditImport(batch, actor);
            return new ImportExecuteResponse(batch.getId(), batch.getImportedRows(), 0, batch.getStatus().name());
        } catch (RuntimeException ex) {
            batch.setStatus(ShiftImportStatus.FAILED);
            batch.setErrorSummary(ex.getMessage());
            batch.setCompletedAt(Instant.now());
            shiftService.saveImportBatch(batch);
            auditImport(batch, actor);
            throw ex;
        }
    }

    private List<ImportRow> validateRows(List<RawRow> rows, String timezone, UUID batchId) {
        Set<String> seenKeys = new HashSet<>();
        List<Shift> staged = new ArrayList<>();
        List<ImportRow> result = new ArrayList<>();
        for (RawRow row : rows) {
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            require(row.employeeCode(), "employee_code", errors);
            require(row.role(), "role", errors);
            require(row.shiftDate(), "shift_date", errors);
            require(row.startTime(), "start_time", errors);
            require(row.endTime(), "end_time", errors);
            require(row.location(), "location", errors);

            ShiftRole role = null;
            try {
                role = row.role() == null ? null : ShiftRole.valueOf(row.role().trim().toUpperCase(Locale.ROOT));
            } catch (Exception ex) {
                errors.add("role must be employee or shipper");
            }
            try {
                if (row.shiftDate() != null) LocalDate.parse(row.shiftDate().trim());
            } catch (Exception ex) {
                errors.add("shift_date must use yyyy-MM-dd format");
            }
            try {
                if (row.startTime() != null) LocalTime.parse(row.startTime().trim());
                if (row.endTime() != null) LocalTime.parse(row.endTime().trim());
            } catch (Exception ex) {
                errors.add("start_time and end_time must use HH:mm format");
            }

            if (errors.isEmpty()) {
                try {
                    Shift shift = shiftService.buildShift(toRequest(row, timezone), null, ShiftSource.IMPORT, batchId);
                    String key = shift.getAssigneeCode().toLowerCase(Locale.ROOT) + "|" + shift.getStartAt() + "|" + shift.getEndAt();
                    if (!seenKeys.add(key)) {
                        errors.add("duplicate row in file");
                    }
                    if (!shiftRepository.findOverlaps(shift.getAssignee().getId(), shift.getStartAt(), shift.getEndAt(), null).isEmpty()) {
                        errors.add("overlaps existing shift");
                    }
                    boolean overlapsStaged = staged.stream().anyMatch(existing ->
                            existing.getAssignee().getId().equals(shift.getAssignee().getId())
                                    && existing.getStartAt().isBefore(shift.getEndAt())
                                    && existing.getEndAt().isAfter(shift.getStartAt()));
                    if (overlapsStaged) {
                        errors.add("overlaps another row in this file");
                    }
                    if (errors.isEmpty()) {
                        staged.add(shift);
                    }
                } catch (RuntimeException ex) {
                    errors.add(ex.getMessage());
                }
            }
            result.add(new ImportRow(row.rowNumber(), row.employeeCode(), role == null ? row.role() : role.name().toLowerCase(Locale.ROOT),
                    row.shiftDate(), row.startTime(), row.endTime(), row.location(), row.note(), errors, warnings));
        }
        return result;
    }

    private ShiftRequest toRequest(RawRow row, String timezone) {
        return new ShiftRequest(row.employeeCode(), ShiftRole.valueOf(row.role().trim().toUpperCase(Locale.ROOT)),
                LocalDate.parse(row.shiftDate().trim()), row.startTime().trim(), row.endTime().trim(), timezone,
                row.location(), row.note(), null);
    }

    private List<RawRow> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("Import file is required.");
        }
        String extension = extension(file);
        try {
            return switch (extension) {
                case "csv" -> parseCsv(file);
                case "xlsx" -> parseXlsx(file);
                default -> throw new BusinessException("Only .csv and .xlsx files are supported.");
            };
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("Could not parse import file: " + ex.getMessage());
        }
    }

    private List<RawRow> parseCsv(MultipartFile file) throws Exception {
        List<RawRow> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            CSVParser parser = CSVFormat.DEFAULT.builder()
                    .setTrim(true)
                    .setIgnoreEmptyLines(true)
                    .build()
                    .parse(reader);
            boolean first = true;
            for (CSVRecord record : parser) {
                List<String> values = new ArrayList<>();
                record.forEach(values::add);
                if (first && looksLikeHeader(String.join(",", values))) {
                    first = false;
                    continue;
                }
                first = false;
                rows.add(raw((int) record.getRecordNumber(), values));
            }
        }
        return rows;
    }

    private List<RawRow> parseXlsx(MultipartFile file) throws Exception {
        List<RawRow> rows = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            boolean first = true;
            for (Row row : sheet) {
                List<String> values = new ArrayList<>();
                for (int i = 0; i < REQUIRED_HEADERS.size(); i += 1) {
                    values.add(formatter.formatCellValue(row.getCell(i)).trim());
                }
                if (first && looksLikeHeader(String.join(",", values))) {
                    first = false;
                    continue;
                }
                first = false;
                if (values.stream().allMatch(String::isBlank)) {
                    continue;
                }
                rows.add(raw(row.getRowNum() + 1, values));
            }
        }
        return rows;
    }

    private RawRow raw(int rowNumber, List<String> values) {
        return new RawRow(rowNumber, read(values, 0), read(values, 1), read(values, 2), read(values, 3),
                read(values, 4), read(values, 5), read(values, 6));
    }

    private String read(List<String> values, int index) {
        return values.size() > index ? values.get(index).trim() : "";
    }

    private boolean looksLikeHeader(String line) {
        String normalized = line.toLowerCase(Locale.ROOT);
        return REQUIRED_HEADERS.stream().allMatch(normalized::contains);
    }

    private void require(String value, String field, List<String> errors) {
        if (value == null || value.isBlank()) {
            errors.add(field + " is required");
        }
    }

    private String extension(MultipartFile file) {
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("");
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private void auditImport(ShiftImportBatch batch, User actor) {
        String details = String.format(Locale.ROOT,
                "{\"status\":\"%s\",\"fileName\":\"%s\",\"totalRows\":%d,\"importedRows\":%d,\"invalidRows\":%d}",
                batch.getStatus(), escape(batch.getFileName()), batch.getTotalRows(), batch.getImportedRows(), batch.getInvalidRows());
        jdbcTemplate.update("INSERT INTO audit_events (event_type, entity_type, entity_id, actor, details) VALUES (?, ?, ?, ?, ?::jsonb)",
                "SHIFT_IMPORT_" + batch.getStatus().name(), "SHIFT_IMPORT", batch.getId().toString(),
                actor == null ? "system" : actor.getEmail(), details);
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private record RawRow(int rowNumber, String employeeCode, String role, String shiftDate, String startTime,
                          String endTime, String location, String note) {}
}
