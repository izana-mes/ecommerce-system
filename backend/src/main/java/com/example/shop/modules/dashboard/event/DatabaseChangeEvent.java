package com.example.shop.modules.dashboard.event;

import org.springframework.context.ApplicationEvent;

/**
 * Event published when database entities related to dashboard stats are modified.
 */
public class DatabaseChangeEvent extends ApplicationEvent {

    /**
     * Create a new DatabaseChangeEvent.
     *
     * @param source the object on which the event initially occurred (cannot be null)
     */
    public DatabaseChangeEvent(Object source) {
        super(source);
    }
}
