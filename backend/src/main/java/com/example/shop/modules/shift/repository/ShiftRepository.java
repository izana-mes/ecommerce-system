package com.example.shop.modules.shift.repository;

import com.example.shop.modules.shift.entity.Shift;
import com.example.shop.modules.shift.entity.ShiftStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ShiftRepository extends JpaRepository<Shift, UUID> {
    @Query("""
            select s from Shift s
            join fetch s.assignee a
            where (:assigneeId is null or a.id = :assigneeId)
              and (:status is null or s.status = :status)
              and s.startAt < :to
              and s.endAt > :from
            order by s.startAt asc
            """)
    List<Shift> search(@Param("assigneeId") UUID assigneeId,
                       @Param("status") ShiftStatus status,
                       @Param("from") Instant from,
                       @Param("to") Instant to);

    @Query("""
            select s from Shift s
            where s.assignee.id = :assigneeId
              and s.startAt < :endAt
              and s.endAt > :startAt
              and (:excludeId is null or s.id <> :excludeId)
            """)
    List<Shift> findOverlaps(@Param("assigneeId") UUID assigneeId,
                             @Param("startAt") Instant startAt,
                             @Param("endAt") Instant endAt,
                             @Param("excludeId") UUID excludeId);

}
