package com.example.shop.modules.productapproval.entity;

public enum ProductChangeRequestStatus {
    PENDING,
    APPROVED,
    REJECTED,
    /** Admin requested corrections before resubmission. */
    CHANGES_REQUESTED
}
