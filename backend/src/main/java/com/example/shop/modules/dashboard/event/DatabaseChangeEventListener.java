package com.example.shop.modules.dashboard.event;

import com.example.shop.modules.dashboard.websocket.DashboardStatsBroadcaster;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Event listener that reacts to committed database changes and triggers statistics broadcasts.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseChangeEventListener {

    private final DashboardStatsBroadcaster statsBroadcaster;

    /**
     * Handle the database change event. Runs after the active transaction commits.
     *
     * @param event DatabaseChangeEvent containing the source of modification.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void handleDatabaseChange(DatabaseChangeEvent event) {
        log.debug("Database change detected, triggering statistics broadcast");
        statsBroadcaster.broadcast();
    }
}
