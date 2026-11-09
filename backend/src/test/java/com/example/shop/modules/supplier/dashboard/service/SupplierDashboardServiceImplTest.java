package com.example.shop.modules.supplier.dashboard.service;

import com.example.shop.modules.supplier.finance.repository.SupplierBalanceRepository;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SupplierDashboardServiceImplTest {
    @Test void bindsAuthenticatedSupplierIdAsUuidForSupplierOwnershipQueries() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        SupplierBalanceRepository balances = mock(SupplierBalanceRepository.class);
        UUID supplierId = UUID.randomUUID();
        when(balances.findBySupplierUserId(supplierId)).thenReturn(java.util.Optional.empty());
        new SupplierDashboardServiceImpl(jdbc, balances).getDashboard(supplierId, 30, 8);
        verify(jdbc, atLeast(2)).queryForObject(contains("COALESCE(oi.supplier_user_id, p.supplier_user_id)"), eq(Long.class), eq(supplierId));
        verify(jdbc, atLeastOnce()).queryForObject(contains("FROM supplier_products WHERE supplier_user_id = ?"), eq(Long.class), eq(supplierId));
        verify(balances).findBySupplierUserId(supplierId);
        verifyNoMoreInteractions(balances);
    }
}
