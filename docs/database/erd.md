# Entity Relationship Diagram (ERD)

This document contains the Entity Relationship Diagram (ERD) describing the database schema. It has been verified against the actual Flyway SQL migrations.

## Core Database Schema Map

```mermaid
erDiagram
    users {
        uuid users_id PK
        varchar username UNIQUE
        varchar email NOT_NULL_UNIQUE
        varchar password_hash NOT_NULL
        varchar first_name
        varchar last_name
        varchar phone UNIQUE
        boolean is_active NOT_NULL
        boolean email_verified NOT_NULL
        varchar auth_provider
        varchar provider_id
        bigint loyalty_points NOT_NULL
        timestamp created_at
        timestamp updated_at
    }

    roles {
        uuid roles_id PK
        varchar roles_name NOT_NULL_UNIQUE
    }

    user_roles {
        uuid users_id PK_FK
        uuid roles_id PK_FK
    }

    products {
        bigserial id PK
        varchar product_id UNIQUE
        text front_img NOT_NULL
        text back_img
        varchar product_name NOT_NULL
        double_precision product_price NOT_NULL
        text product_reviews
        integer stock_quantity NOT_NULL
        boolean active NOT_NULL
        uuid supplier_user_id FK
        uuid seller_user_id
        varchar category NOT_NULL
        double_precision old_price
        text sizes
        timestamp created_at
        timestamp updated_at
    }

    wishlist_items {
        bigserial id PK
        varchar product_id NOT_NULL
        varchar product_name NOT_NULL
        double_precision product_price NOT_NULL
        varchar product_reviews
        uuid user_id FK
        timestamp created_at
        timestamp updated_at
    }

    cart_items {
        bigserial id PK
        varchar product_id NOT_NULL
        varchar product_name NOT_NULL
        double_precision product_price NOT_NULL
        varchar product_reviews
        integer quantity NOT_NULL
        uuid user_id FK
        timestamp created_at
        timestamp updated_at
    }

    orders {
        bigserial id PK
        varchar order_number UNIQUE
        uuid user_id
        varchar customer_email NOT_NULL
        varchar customer_first_name
        varchar customer_last_name
        varchar customer_phone
        varchar shipping_address_line1
        varchar shipping_address_line2
        varchar shipping_city
        varchar shipping_state
        varchar shipping_postal_code
        varchar shipping_country
        text notes
        numeric subtotal NOT_NULL
        numeric shipping_fee NOT_NULL
        numeric vat NOT_NULL
        numeric total_amount NOT_NULL
        char currency NOT_NULL
        varchar payment_method NOT_NULL
        varchar payment_status NOT_NULL
        varchar order_status NOT_NULL
        varchar tracking_secret UNIQUE
        varchar shipping_carrier
        varchar shipping_tracking_public
        timestamp shipped_at
        numeric delivery_latitude
        numeric delivery_longitude
        varchar delivery_location_label
        numeric delivery_location_accuracy_meters
        bigint delivery_location_captured_at
        uuid shipper_user_id FK
        timestamp expected_delivery_at
        timestamp picked_up_at
        timestamp delivered_at
        timestamp failed_at
        boolean delivery_success
        varchar failure_reason
        integer points_redeemed NOT_NULL
        numeric points_discount_amount NOT_NULL
        integer points_earned NOT_NULL
        varchar coupon_code
        numeric discount_amount NOT_NULL
        bigint coupon_assignment_id
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    order_items {
        bigserial id PK
        bigint order_id FK
        varchar product_id NOT_NULL
        varchar product_name NOT_NULL
        numeric unit_price NOT_NULL
        integer quantity NOT_NULL
        numeric line_total NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    payments {
        bigserial id PK
        bigint order_id FK
        varchar payment_reference
        varchar provider
        varchar method NOT_NULL
        numeric amount NOT_NULL
        char currency NOT_NULL
        varchar status NOT_NULL
        timestamp paid_at
        jsonb metadata
        varchar paypal_order_id UNIQUE
        varchar paypal_capture_id UNIQUE
        varchar payer_email
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    payment_webhook_events {
        bigserial id PK
        varchar provider NOT_NULL
        varchar event_key NOT_NULL
        varchar order_number
        jsonb payload
        timestamp created_at NOT_NULL
    }

    inventories {
        bigserial id PK
        varchar product_id UNIQUE
        integer available_stock NOT_NULL
        integer reserved_stock NOT_NULL
        integer packed_stock NOT_NULL
        integer in_transit_stock NOT_NULL
        integer returned_stock NOT_NULL
        integer damaged_stock NOT_NULL
        bigint version NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    inventory_reservations {
        bigserial id PK
        varchar reservation_code UNIQUE
        varchar order_number NOT_NULL
        uuid user_id
        varchar status NOT_NULL
        timestamp expires_at NOT_NULL
        timestamp released_at
        varchar release_reason
        bigint version NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    inventory_reservation_items {
        bigserial id PK
        bigint reservation_id FK
        varchar product_id NOT_NULL
        integer quantity NOT_NULL
    }

    inventory_transactions {
        bigserial id PK
        varchar product_id NOT_NULL
        varchar reservation_code
        varchar order_number
        varchar transaction_type NOT_NULL
        integer quantity NOT_NULL
        integer before_available_stock NOT_NULL
        integer after_available_stock NOT_NULL
        integer before_reserved_stock NOT_NULL
        integer after_reserved_stock NOT_NULL
        jsonb metadata
        timestamp created_at NOT_NULL
    }

    coupons {
        bigserial id PK
        varchar code UNIQUE
        varchar title NOT_NULL
        text description
        varchar discount_type NOT_NULL
        numeric discount_value NOT_NULL
        numeric min_order_amount NOT_NULL
        numeric max_discount_amount
        integer usage_limit
        integer usage_count NOT_NULL
        timestamp starts_at
        timestamp expires_at
        boolean is_active NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    coupon_assignments {
        bigserial id PK
        bigint coupon_id FK
        varchar user_id NOT_NULL
        varchar user_email NOT_NULL
        varchar notification_title
        text notification_message
        varchar issued_by_email
        timestamp issued_at NOT_NULL
        timestamp acknowledged_at
        timestamp used_at
        bigint used_order_id
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    refresh_tokens {
        uuid refresh_tokens_id PK
        uuid users_id FK
        text refresh_tokens_hash NOT_NULL
        boolean is_revoked NOT_NULL
        timestamp expires_at NOT_NULL
        timestamp last_used_at
        timestamp created_at
    }

    email_verification_tokens {
        uuid verification_token_id PK
        uuid users_id FK
        text token_hash NOT_NULL
        boolean is_used NOT_NULL
        timestamp expires_at NOT_NULL
        timestamp created_at
        timestamp updated_at
    }

    password_reset_tokens {
        uuid password_reset_tokens_id PK
        uuid users_id FK
        text tokens_hash NOT_NULL
        boolean is_used NOT_NULL
        timestamp expires_at NOT_NULL
        timestamp created_at
    }

    otp_verification {
        uuid otp_verification_id PK
        varchar email NOT_NULL
        varchar otp_code NOT_NULL
        boolean is_used NOT_NULL
        timestamp expires_at NOT_NULL
        timestamp created_at
        timestamp updated_at
    }

    audit_events {
        bigserial id PK
        varchar event_type NOT_NULL
        varchar entity_type NOT_NULL
        varchar entity_id
        varchar actor
        jsonb details
        timestamp created_at NOT_NULL
    }

    product_change_requests {
        uuid product_change_requests_id PK
        varchar action_type NOT_NULL
        varchar target_product_id
        text request_payload NOT_NULL
        varchar status NOT_NULL
        uuid requested_by_user_id FK
        uuid reviewed_by_user_id FK
        varchar reviewer_note
        timestamp reviewed_at
        timestamp created_at
        timestamp updated_at
    }

    attendance_shifts {
        varchar shift_id PK
        varchar employee_email NOT_NULL
        varchar employee_name NOT_NULL
        varchar employee_role NOT_NULL
        varchar employee_user_id NOT_NULL
        varchar shift_date NOT_NULL
        bigint clock_in_at NOT_NULL
        bigint clock_out_at
        integer total_work_minutes NOT_NULL
        integer total_break_minutes NOT_NULL
        text note
        bigint created_at NOT_NULL
        bigint updated_at NOT_NULL
    }

    attendance_breaks {
        break_id varchar PK
        shift_id varchar NOT_NULL
        started_at bigint NOT_NULL
        ended_at bigint
        duration_minutes integer NOT_NULL
        created_at bigint NOT_NULL
        updated_at bigint NOT_NULL
    }

    attendance_action_logs {
        action_log_id varchar PK
        shift_id varchar
        employee_user_id varchar NOT_NULL
        employee_email varchar NOT_NULL
        employee_name varchar NOT_NULL
        action_type varchar NOT_NULL
        note text
        location_label varchar
        latitude numeric NOT_NULL
        longitude numeric NOT_NULL
        accuracy_meters numeric
        client_recorded_at bigint
        recorded_at bigint NOT_NULL
        created_at bigint NOT_NULL
    }

    shifts {
        uuid id PK
        uuid assignee_user_id FK
        varchar assignee_code NOT_NULL
        varchar assignee_role NOT_NULL
        date shift_date NOT_NULL
        timestamp start_at NOT_NULL
        timestamp end_at NOT_NULL
        varchar timezone NOT_NULL
        varchar location NOT_NULL
        text note
        varchar status NOT_NULL
        varchar source NOT_NULL
        uuid import_batch_id
        uuid created_by FK
        uuid updated_by FK
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    shift_import_batches {
        uuid id PK
        varchar file_name NOT_NULL
        varchar file_type NOT_NULL
        varchar status NOT_NULL
        integer total_rows NOT_NULL
        integer valid_rows NOT_NULL
        integer invalid_rows NOT_NULL
        integer imported_rows NOT_NULL
        text error_summary
        uuid created_by FK
        timestamp created_at NOT_NULL
        timestamp completed_at
    }

    shift_swap_requests {
        uuid id PK
        uuid shift_id FK
        uuid requester_user_id FK
        uuid target_user_id FK
        varchar status NOT_NULL
        text reason
        uuid reviewer_user_id FK
        text reviewer_note
        timestamp created_at NOT_NULL
        timestamp reviewed_at
    }

    shift_leave_requests {
        uuid id PK
        uuid requester_user_id FK
        date start_date NOT_NULL
        date end_date NOT_NULL
        varchar status NOT_NULL
        text reason
        uuid reviewer_user_id FK
        text reviewer_note
        timestamp created_at NOT_NULL
        timestamp reviewed_at
    }

    meetings {
        uuid meeting_id PK
        uuid series_id
        varchar title NOT_NULL
        text description
        timestamp start_at NOT_NULL
        timestamp end_at NOT_NULL
        varchar timezone NOT_NULL
        varchar priority NOT_NULL
        varchar visibility NOT_NULL
        varchar status NOT_NULL
        varchar meeting_room
        text online_link
        varchar related_type
        varchar related_id
        varchar repeat_rule
        varchar chat_conversation_id
        varchar comment_thread_id
        text notes
        varchar created_by NOT_NULL
        varchar updated_by
        timestamp reminder_sent_at
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
        timestamp cancelled_at
    }

    meeting_participants {
        uuid meeting_id PK_FK
        varchar participant_email PK
        uuid participant_user_id
        varchar display_name
        varchar role NOT_NULL
        varchar attendance_status NOT_NULL
        varchar online_status NOT_NULL
        timestamp joined_at
        timestamp left_at
        boolean is_late NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    meeting_attachments {
        uuid attachment_id PK
        uuid meeting_id FK
        varchar file_name NOT_NULL
        text file_url NOT_NULL
        varchar content_type
        varchar uploaded_by
        timestamp created_at NOT_NULL
    }

    meeting_action_items {
        uuid action_item_id PK
        uuid meeting_id FK
        text body NOT_NULL
        varchar assigned_to
        timestamp due_at
        varchar status NOT_NULL
        varchar created_by NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    meeting_activity_events {
        bigint id PK
        uuid meeting_id FK
        varchar event_type NOT_NULL
        varchar actor NOT_NULL
        jsonb details NOT_NULL
        timestamp created_at NOT_NULL
    }

    social_conversations {
        varchar conversation_id PK
        varchar type NOT_NULL
        varchar title
        text avatar_url
        varchar order_id
        varchar created_by_user_id
        varchar status NOT_NULL
        varchar last_message_id
        timestamp last_message_at
        varchar pinned_message_id
        jsonb metadata NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
        timestamp deleted_at
    }

    social_conversation_members {
        varchar conversation_id PK_FK
        varchar user_id PK
        varchar role NOT_NULL
        timestamp joined_at NOT_NULL
        varchar last_read_message_id
        timestamp last_read_at
        timestamp muted_until
        integer mention_unread_count NOT_NULL
        integer message_unread_count NOT_NULL
        boolean is_online NOT_NULL
        timestamp last_seen_at
        timestamp deleted_at
    }

    social_messages {
        varchar message_id PK
        varchar conversation_id NOT_NULL
        varchar sender_user_id
        varchar sender_role NOT_NULL
        text body
        varchar body_format NOT_NULL
        varchar type NOT_NULL
        varchar reply_to_message_id
        varchar forwarded_from_message_id
        jsonb link_preview
        jsonb metadata NOT_NULL
        timestamp edited_at
        timestamp deleted_for_everyone_at
        timestamp created_at NOT_NULL
    }

    social_message_attachments {
        varchar attachment_id PK
        varchar message_id NOT_NULL
        varchar uploader_user_id
        varchar kind NOT_NULL
        varchar file_name
        varchar content_type
        bigint byte_size NOT_NULL
        text storage_key NOT_NULL
        text public_url
        integer width
        integer height
        integer duration_ms
        varchar checksum_sha256
        varchar scan_status NOT_NULL
        timestamp created_at NOT_NULL
    }

    social_message_receipts {
        varchar message_id PK_FK
        varchar user_id PK
        timestamp delivered_at
        timestamp read_at
        timestamp deleted_for_self_at
    }

    social_reactions {
        varchar reaction_id PK
        varchar target_type NOT_NULL
        varchar target_id NOT_NULL
        varchar user_id NOT_NULL
        varchar reaction NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    social_reaction_counts {
        varchar target_type PK
        varchar target_id PK
        varchar reaction PK
        integer count NOT_NULL
        timestamp updated_at NOT_NULL
    }

    social_comment_threads {
        varchar thread_id PK
        varchar target_type NOT_NULL
        varchar target_id NOT_NULL
        varchar status NOT_NULL
        integer comment_count NOT_NULL
        timestamp last_comment_at
        timestamp created_at NOT_NULL
    }

    social_comments {
        varchar comment_id PK
        varchar thread_id NOT_NULL
        varchar parent_comment_id
        varchar author_user_id
        varchar author_role NOT_NULL
        text body
        varchar body_format NOT_NULL
        varchar path
        integer depth NOT_NULL
        integer reply_count NOT_NULL
        integer like_count NOT_NULL
        numeric relevance_score NOT_NULL
        timestamp edited_at
        timestamp deleted_at
        timestamp created_at NOT_NULL
    }

    social_mentions {
        varchar mention_id PK
        varchar source_type NOT_NULL
        varchar source_id NOT_NULL
        varchar conversation_id
        varchar thread_id
        varchar mentioned_user_id
        varchar mentioned_role
        varchar mentioned_username
        varchar created_by_user_id
        varchar priority NOT_NULL
        timestamp escalation_due_at
        timestamp acknowledged_at
        timestamp created_at NOT_NULL
    }

    social_notifications {
        varchar notification_id PK
        varchar recipient_user_id NOT_NULL
        varchar actor_user_id
        varchar type NOT_NULL
        varchar title NOT_NULL
        text body
        varchar group_key
        jsonb payload NOT_NULL
        varchar priority NOT_NULL
        timestamp read_at
        timestamp delivered_at
        timestamp created_at NOT_NULL
    }

    social_typing_status {
        varchar conversation_id PK
        varchar user_id PK
        timestamp expires_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    workflow_tasks {
        bigserial id PK
        varchar task_key UNIQUE
        varchar title NOT_NULL
        text description
        varchar status NOT_NULL
        varchar priority NOT_NULL
        varchar assigned_to
        varchar created_by NOT_NULL
        timestamp due_at
        timestamp completed_at
        timestamp escalated_at
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    workflow_task_events {
        bigserial id PK
        bigint task_id FK
        varchar event_type NOT_NULL
        varchar actor NOT_NULL
        text notes
        timestamp created_at NOT_NULL
    }

    app_notifications {
        bigserial id PK
        varchar recipient NOT_NULL
        varchar title NOT_NULL
        text message NOT_NULL
        varchar channel NOT_NULL
        varchar source_type
        varchar source_id
        boolean is_read NOT_NULL
        timestamp read_at
        timestamp created_at NOT_NULL
    }

    shipper_incidents {
        bigserial id PK
        bigint order_id FK
        varchar incident_type NOT_NULL
        varchar severity NOT_NULL
        varchar status NOT_NULL
        varchar details
        varchar created_by NOT_NULL
        varchar resolved_by
        timestamp created_at NOT_NULL
        timestamp resolved_at
        timestamp updated_at NOT_NULL
    }

    shipper_location_history {
        bigserial id PK
        uuid shipper_user_id FK
        bigint order_id FK
        numeric latitude NOT_NULL
        numeric longitude NOT_NULL
        numeric speed
        numeric heading
        numeric accuracy_meters
        varchar source NOT_NULL
        timestamp recorded_at NOT_NULL
        timestamp created_at NOT_NULL
    }

    shipper_issue_logs {
        bigserial id PK
        bigint order_id FK
        uuid shipper_user_id FK
        varchar issue_type NOT_NULL
        varchar message
        varchar status NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    shipper_help_requests {
        bigserial id PK
        bigint order_id FK
        uuid shipper_user_id FK
        varchar message NOT_NULL
        varchar priority NOT_NULL
        varchar status NOT_NULL
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
    }

    order_status_logs {
        bigserial id PK
        bigint order_id FK
        varchar previous_status
        varchar new_status NOT_NULL
        varchar note
        varchar changed_by NOT_NULL
        timestamp created_at NOT_NULL
    }

    seller_balance {
        bigserial id PK
        uuid seller_user_id UNIQUE_FK
        numeric available_balance NOT_NULL
        numeric pending_balance NOT_NULL
        numeric total_earned NOT_NULL
        varchar currency NOT_NULL
        timestamp updated_at NOT_NULL
    }

    seller_transactions {
        bigserial id PK
        uuid seller_user_id FK
        varchar order_number
        varchar product_id
        varchar type NOT_NULL
        numeric gross_amount NOT_NULL
        numeric commission_amount NOT_NULL
        numeric net_amount NOT_NULL
        text description
        timestamp created_at NOT_NULL
    }

    supplier_balance {
        bigserial id PK
        uuid supplier_user_id UNIQUE
        numeric available_balance NOT_NULL
        numeric pending_balance NOT_NULL
        numeric total_earned NOT_NULL
        varchar currency NOT_NULL
        timestamp updated_at NOT_NULL
    }

    supplier_transactions {
        bigserial id PK
        uuid supplier_user_id NOT_NULL
        varchar order_number
        varchar product_id
        varchar type NOT_NULL
        numeric gross_amount NOT_NULL
        numeric commission_amount NOT_NULL
        numeric net_amount NOT_NULL
        text description
        timestamp created_at NOT_NULL
    }

    chatbot_conversations {
        varchar conversation_id PK
        varchar user_email
        varchar guest_id
        timestamp created_at NOT_NULL
        timestamp updated_at NOT_NULL
        timestamp last_message_at NOT_NULL
    }

    chatbot_messages {
        varchar message_id PK
        varchar conversation_id NOT_NULL
        varchar message_role NOT_NULL
        text body
        timestamp created_at NOT_NULL
    }

    fraud_order_assessments {
        bigint order_id PK
        varchar order_number NOT_NULL
        varchar customer_email
        varchar payment_method
        char currency
        numeric total_amount NOT_NULL
        integer risk_score NOT_NULL
        varchar risk_level NOT_NULL
        boolean manual_review_required NOT_NULL
        text risk_reasons
        varchar review_status NOT_NULL
        text review_note
        varchar reviewed_by
        timestamp reviewed_at
        timestamp assessed_at NOT_NULL
        timestamp updated_at NOT_NULL
    }


    %% Core Auth Relations
    users ||--o{ user_roles : assigns
    roles ||--o{ user_roles : links
    users ||--o{ refresh_tokens : owns
    users ||--o{ email_verification_tokens : verifies
    users ||--o{ password_reset_tokens : resets

    %% Catalog & User Activity Relations
    users ||--o{ wishlist_items : adds
    users ||--o{ cart_items : places
    users ||--o{ products : supplies_or_sells

    %% Orders & Payments Relations
    orders ||--o{ order_items : contains
    orders ||--o{ payments : secures
    orders ||--o{ shipper_incidents : has
    orders ||--o{ shipper_location_history : tracks
    orders ||--o{ shipper_issue_logs : records
    orders ||--o{ shipper_help_requests : submits
    orders ||--o{ order_status_logs : transitions
    users ||--o{ orders : delivers

    %% Inventory Reservation Relations
    inventory_reservations ||--o{ inventory_reservation_items : reserves
    
    %% Coupon Relations
    coupons ||--o{ coupon_assignments : issues
    
    %% Staff Shifts & Swaps Relations
    users ||--o{ shifts : assigned_to
    shifts ||--o{ shift_swap_requests : swaps
    users ||--o{ shift_swap_requests : requests_or_reviews
    users ||--o{ shift_leave_requests : submits_or_reviews
    users ||--o{ shift_import_batches : creates

    %% Meetings Relations
    meetings ||--o{ meeting_participants : invites
    meetings ||--o{ meeting_attachments : holds
    meetings ||--o{ meeting_action_items : assigns
    meetings ||--o{ meeting_activity_events : logs

    %% Enterprise Messaging Relations
    social_conversations ||--o{ social_conversation_members : joins
    social_conversations ||--o{ social_messages : publishes
    social_messages ||--o{ social_message_attachments : includes
    social_messages ||--o{ social_message_receipts : registers

    %% Workflow Relations
    workflow_tasks ||--o{ workflow_task_events : triggers

    %% Finance Relations
    users ||--o{ seller_balance : manages
    users ||--o{ seller_transactions : ledger
```
