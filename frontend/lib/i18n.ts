export type Locale = "en" | "ja";

export type TranslationKey =
  | "announcement_bar"
  | "nav_home"
  | "nav_shop"
  | "nav_about"
  | "nav_blog"
  | "nav_contact"
  | "nav_chatbot"
  | "nav_support"
  | "nav_admin"
  | "nav_shipper"
  | "nav_fulfillment"
  | "nav_assistant"
  | "nav_inbox"
  | "nav_attendance"
  | "nav_expenses"
  | "search_placeholder"
  | "search_aria"
  | "account_aria"
  | "cart_aria"
  | "wishlist_aria"
  | "language_label"
  | "theme_to_dark"
  | "theme_to_light"
  | "home_fast_dispatch"
  | "home_fast_dispatch_desc"
  | "home_flexible_returns"
  | "home_flexible_returns_desc"
  | "home_member_rewards"
  | "home_member_rewards_desc"
  | "home_starting_at_19"
  | "home_womens_tshirts"
  | "home_shop_now"
  | "home_starting_at_39"
  | "home_mens_sportswear"
  | "home_hot_list"
  | "home_women"
  | "home_collection"
  | "home_men"
  | "home_kids"
  | "home_egift"
  | "home_cards"
  | "home_surprise_gift"
  | "home_new_trend"
  | "home_summer_sale"
  | "home_limited_offer"
  | "home_discover_more"
  | "home_deal_of_the_week"
  | "home_spring"
  | "home_days"
  | "home_hours"
  | "home_minutes"
  | "home_seconds"
  | "home_our_trendy"
  | "home_products"
  | "home_all"
  | "home_new_arrivals"
  | "home_best_seller"
  | "home_top_rated"
  | "home_add_to_cart"
  | "home_limited"
  | "home_edition"
  | "home_loading_products"
  | "home_buy_now"
  | "home_processing"
  | "home_view_in_shop"
  | "home_id"
  | "home_price"
  | "home_reviews"
  | "home_status"
  | "home_active"
  | "home_inactive"
  | "about_title"
  | "about_our_story"
  | "about_story_desc_1"
  | "about_story_desc_2"
  | "about_our_mission"
  | "about_mission_desc"
  | "about_our_vision"
  | "about_vision_desc"
  | "about_the_company"
  | "about_company_desc"
  | "about_company_partners"
  | "contact_us"
  | "contact_store_london"
  | "contact_store_london_address_1"
  | "contact_store_london_address_2"
  | "contact_store_india"
  | "contact_store_india_address_1"
  | "contact_store_india_address_2"
  | "contact_get_in_touch"
  | "contact_placeholder_name"
  | "contact_placeholder_email"
  | "contact_placeholder_message"
  | "contact_submit"
  | "shop_home"
  | "shop_the_shop"
  | "shop_filter"
  | "shop_filter_by"
  | "shop_default_sorting"
  | "shop_featured"
  | "shop_best_selling"
  | "shop_alpha_az"
  | "shop_alpha_za"
  | "shop_price_low_high"
  | "shop_price_high_low"
  | "shop_date_old_new"
  | "shop_date_new_old"
  | "shop_out_of_stock"
  | "shop_unavailable"
  | "shop_limit_reached"
  | "shop_add_to_cart"
  | "shop_category_dresses"
  | "shop_buy_now"
  | "shop_processing"
  | "shop_user_review"
  | "shop_user_reviews"
  | "shop_prev"
  | "shop_next"
  | "shop_product_id"
  | "shop_product_price"
  | "shop_product_reviews"
  | "shop_user_rating"
  | "shop_remaining_stock"
  | "shop_status"
  | "shop_active"
  | "shop_inactive"
  | "shop_focus_link"
  | "shop_view_in_list"
  | "shop_rate_comment"
  | "shop_write_comment"
  | "shop_submit_review"
  | "shop_loading_reviews"
  | "shop_no_reviews"
  | "shop_unlike"
  | "shop_like"
  | "shop_dislike"
  | "shop_reply"
  | "shop_write_reply"
  | "shop_post_reply"
  | "shop_cancel"
  | "shop_save"
  | "shop_your_description"
  | "shop_write_description"
  | "shop_save_description"
  | "cart_title"
  | "cart_tab_1"
  | "cart_tab_1_desc"
  | "cart_tab_2"
  | "cart_tab_2_desc"
  | "cart_tab_3"
  | "cart_tab_3_desc"
  | "cart_table_product"
  | "cart_table_action"
  | "cart_table_price"
  | "cart_table_quantity"
  | "cart_table_subtotal"
  | "cart_buy_now"
  | "cart_empty"
  | "cart_shop_now"
  | "cart_coupon_placeholder"
  | "cart_applying_coupon"
  | "cart_apply_coupon"
  | "cart_update_cart"
  | "cart_totals"
  | "cart_shipping"
  | "cart_change_address"
  | "cart_vat"
  | "cart_discount"
  | "cart_total"
  | "cart_proceed_checkout"
  | "checkout_billing_details"
  | "checkout_first_name"
  | "checkout_last_name"
  | "checkout_company"
  | "checkout_country"
  | "checkout_country_india"
  | "checkout_country_canada"
  | "checkout_country_uk"
  | "checkout_country_us"
  | "checkout_country_turkey"
  | "checkout_street1"
  | "checkout_street2"
  | "checkout_city"
  | "checkout_postal"
  | "checkout_phone"
  | "checkout_email"
  | "checkout_create_account"
  | "checkout_ship_different"
  | "checkout_notes"
  | "checkout_required_error"
  | "checkout_your_order"
  | "checkout_buy_now_mode"
  | "checkout_products"
  | "checkout_subtotals"
  | "checkout_direct_bank"
  | "checkout_direct_bank_desc"
  | "checkout_check_payments"
  | "checkout_check_payments_desc"
  | "checkout_cod"
  | "checkout_cod_desc"
  | "checkout_paypal"
  | "checkout_paypal_desc"
  | "checkout_vnpay"
  | "checkout_vnpay_desc"
  | "checkout_momo"
  | "checkout_momo_desc"
  | "checkout_privacy_1"
  | "checkout_privacy_2"
  | "checkout_privacy_3"
  | "checkout_placing_order"
  | "checkout_place_order"
  | "order_completed"
  | "order_thank_you"
  | "order_number"
  | "order_date"
  | "order_payment_method"
  | "order_details"
  | "wishlist_title"
  | "wishlist_empty"
  | "wishlist_continue_shopping"
  | "wishlist_add_to_cart"
  | "auth_login"
  | "auth_register"
  | "auth_verify_email"
  | "auth_google_login"
  | "auth_email_placeholder"
  | "auth_password_placeholder"
  | "auth_remember_me"
  | "auth_lost_password"
  | "auth_logging_in"
  | "auth_log_in_btn"
  | "auth_no_account"
  | "auth_create_account"
  | "auth_username_placeholder"
  | "auth_password_min_length"
  | "auth_first_name_optional"
  | "auth_last_name_optional"
  | "auth_privacy_1"
  | "auth_privacy_2"
  | "auth_privacy_3"
  | "auth_registering"
  | "auth_verification_code_placeholder"
  | "auth_otp_instruction"
  | "auth_verifying"
  | "auth_verify_code"
  | "auth_resend_code"
  | "auth_forgot_password"
  | "auth_reset_instruction"
  | "auth_sending"
  | "auth_send_reset_token"
  | "auth_reset_instruction_2"
  | "auth_reset_token_placeholder"
  | "auth_new_password_placeholder"
  | "auth_confirm_password_placeholder"
  | "auth_updating"
  | "auth_reset_password"
  | "auth_back_to"
  | "profile_title"
  | "profile_email"
  | "profile_name"
  | "profile_role"
  | "profile_orders"
  | "profile_view_history"
  | "profile_logout_success"
  | "profile_logout"
  | "orders_history"
  | "orders_back_profile"
  | "orders_loading"
  | "orders_none"
  | "orders_status"
  | "orders_payment"
  | "orders_subtotal"
  | "orders_shipping"
  | "orders_vat"
  | "orders_total"
  | "orders_each"
  | "orders_prev"
  | "orders_page"
  | "orders_page_of"
  | "orders_next"
  | "orders_cancel"
  | "orders_edit"
  | "orders_cancelling"
  | "orders_updating"
  | "orders_cancel_confirm"
  | "orders_track"
  | "orders_track_auth"
  | "orders_reorder"
  | "orders_reorder_loading"
  | "orders_support"
  | "track_title"
  | "track_meta_hint"
  | "track_loading"
  | "track_error"
  | "track_order_number"
  | "track_created"
  | "track_status_order"
  | "track_status_payment"
  | "track_shipping_to"
  | "track_delivery_pin"
  | "track_timeline"
  | "track_step_placed"
  | "track_step_payment"
  | "track_step_processing"
  | "track_step_shipped"
  | "track_step_complete"
  | "track_items"
  | "track_map_title"
  | "track_home"
  | "checkout_trust_title"
  | "checkout_trust_secure"
  | "checkout_trust_dispatch"
  | "checkout_trust_returns"
  | "checkout_trust_returns_link"
  | "checkout_delivery_title"
  | "checkout_delivery_sub"
  | "checkout_delivery_captured"
  | "checkout_shipping_est_default"
  | "checkout_shipping_est_india"
  | "checkout_shipping_est_canada"
  | "checkout_shipping_est_uk"
  | "checkout_shipping_est_us"
  | "checkout_shipping_est_turkey"
  | "order_track_link"
  | "order_track_copy_hint"
  | "contact_prefill_order";

type Dictionary = Record<TranslationKey, string>;

export const translations: Record<Locale, Dictionary> = {
  en: {
    announcement_bar: "Free shipping on orders over $80 and easy 30-day returns.",
    nav_home: "HOME",
    nav_shop: "SHOP",
    nav_about: "ABOUT",
    nav_blog: "BLOG",
    nav_contact: "CONTACT",
    nav_chatbot: "CHATBOT",
    nav_support: "SUPPORT",
    nav_admin: "ADMIN",
    nav_shipper: "SHIPPER",
    nav_fulfillment: "FULFILLMENT",
    nav_assistant: "ASSISTANT",
    nav_inbox: "INBOX",
    nav_attendance: "ATTENDANCE",
    nav_expenses: "EXPENSES",
    search_placeholder: "Search products",
    search_aria: "Search products",
    account_aria: "Account",
    cart_aria: "Cart",
    wishlist_aria: "Wishlist",
    language_label: "Language",
    theme_to_dark: "Switch to dark mode",
    theme_to_light: "Switch to light mode",
    home_fast_dispatch: "Fast Dispatch",
    home_fast_dispatch_desc: "Orders placed before 2PM ship the same day.",
    home_flexible_returns: "Flexible Returns",
    home_flexible_returns_desc: "30-day returns with instant store credit option.",
    home_member_rewards: "Member Rewards",
    home_member_rewards_desc: "Earn points on every purchase and unlock perks.",
    home_starting_at_19: "Starting At $19",
    home_womens_tshirts: "Women's T-shirts",
    home_shop_now: "Shop Now",
    home_starting_at_39: "Starting At $39",
    home_mens_sportswear: "Men's Sportswear",
    home_hot_list: "HOT LIST",
    home_women: "WOMEN",
    home_collection: "COLLECTION",
    home_men: "MEN",
    home_kids: "KIDS",
    home_egift: "E-GIFT",
    home_cards: "CARDS",
    home_surprise_gift: "Surprise someone with the gift they really want.",
    home_new_trend: "New Trend",
    home_summer_sale: "Summer Sale Stylish",
    home_limited_offer: "Limited Time Offer - Up to 60% off & Free Shipping",
    home_discover_more: "Discover More",
    home_deal_of_the_week: "DEAL OF THE WEEK",
    home_spring: "Spring",
    home_days: "days",
    home_hours: "hours",
    home_minutes: "minutes",
    home_seconds: "seconds",
    home_our_trendy: "OUR TRENDY",
    home_products: "PRODUCTS",
    home_all: "ALL",
    home_new_arrivals: "NEW ARRIVALS",
    home_best_seller: "BEST SELLER",
    home_top_rated: "TOP RATED",
    home_add_to_cart: "Add to cart",
    home_limited: "LIMITED",
    home_edition: "EDITION",
    home_loading_products: "Loading products...",
    home_buy_now: "Buy Now",
    home_processing: "Processing...",
    home_view_in_shop: "View in shop",
    home_id: "ID:",
    home_price: "Price:",
    home_reviews: "Reviews:",
    home_status: "Status:",
    home_active: "Active",
    home_inactive: "Inactive",
    about_title: "About Uomo",
    about_our_story: "Our Story",
    about_story_desc_1: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    about_story_desc_2: "Saw wherein fruitful good days image them, midst, waters upon, saw.",
    about_our_mission: "Our Mission",
    about_mission_desc: "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    about_our_vision: "Our Vision",
    about_vision_desc: "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    about_the_company: "The Company",
    about_company_desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    about_company_partners: "Company Partners",
    contact_us: "Contact Us",
    contact_store_london: "Store in London",
    contact_store_london_address_1: "1418 River Drive, Suite 35 Cottonhall, CA 9622",
    contact_store_london_address_2: "United Kingdom",
    contact_store_india: "Store in India",
    contact_store_india_address_1: "A-791, Bandra Reclamation Rd, Mumbai",
    contact_store_india_address_2: "Maharashtra",
    contact_get_in_touch: "Get In Touch",
    contact_placeholder_name: "Name *",
    contact_placeholder_email: "Email address *",
    contact_placeholder_message: "Your Message",
    contact_submit: "Submit",
    shop_home: "Home",
    shop_the_shop: "The Shop",
    shop_filter: "Filter",
    shop_filter_by: "Filter By",
    shop_default_sorting: "Default Sorting",
    shop_featured: "Featured",
    shop_best_selling: "Best Selling",
    shop_alpha_az: "Alphabetically, A-Z",
    shop_alpha_za: "Alphabetically, Z-A",
    shop_price_low_high: "Price, Low to high",
    shop_price_high_low: "Price, high to low",
    shop_date_old_new: "Date, old to new",
    shop_date_new_old: "Date, new to old",
    shop_out_of_stock: "Out of stock",
    shop_unavailable: "Unavailable",
    shop_limit_reached: "Limit reached",
    shop_add_to_cart: "Add to Cart",
    shop_category_dresses: "Dresses",
    shop_buy_now: "Buy Now",
    shop_processing: "Processing...",
    shop_user_review: "user review",
    shop_user_reviews: "user reviews",
    shop_prev: "Prev",
    shop_next: "Next",
    shop_product_id: "ID:",
    shop_product_price: "Price:",
    shop_product_reviews: "Reviews:",
    shop_user_rating: "User Rating:",
    shop_remaining_stock: "Remaining Stock:",
    shop_status: "Status:",
    shop_active: "Active",
    shop_inactive: "Inactive",
    shop_focus_link: "Focus Link:",
    shop_view_in_list: "View in product list",
    shop_rate_comment: "Rate & Comment",
    shop_write_comment: "Write your comment about this product...",
    shop_submit_review: "Submit Review",
    shop_loading_reviews: "Loading reviews...",
    shop_no_reviews: "No user reviews yet. Be the first to comment.",
    shop_unlike: "Unlike",
    shop_like: "Like",
    shop_dislike: "Dislike",
    shop_reply: "Reply",
    shop_write_reply: "Write your reply...",
    shop_post_reply: "Post Reply",
    shop_cancel: "Cancel",
    shop_save: "Save",
    shop_your_description: "Your Product Description",
    shop_write_description: "Write any product description you want...",
    shop_save_description: "Save Description",
    cart_title: "Cart",
    cart_tab_1: "Shopping Bag",
    cart_tab_1_desc: "Manage Your Items List",
    cart_tab_2: "Shipping and Checkout",
    cart_tab_2_desc: "Checkout Your Items List",
    cart_tab_3: "Confirmation",
    cart_tab_3_desc: "Review And Submit Your Order",
    cart_table_product: "Product",
    cart_table_action: "Action",
    cart_table_price: "Price",
    cart_table_quantity: "Quantity",
    cart_table_subtotal: "Subtotal",
    cart_buy_now: "Buy Now",
    cart_empty: "Your cart is empty!",
    cart_shop_now: "Shop Now",
    cart_coupon_placeholder: "Coupon Code",
    cart_applying_coupon: "Applying...",
    cart_apply_coupon: "Apply Coupon",
    cart_update_cart: "Update Cart",
    cart_totals: "Cart Totals",
    cart_shipping: "Shipping",
    cart_change_address: "CHANGE ADDRESS",
    cart_vat: "VAT",
    cart_discount: "Discount",
    cart_total: "Total",
    cart_proceed_checkout: "Proceed to Checkout",
    checkout_billing_details: "Billing Details",
    checkout_first_name: "First Name",
    checkout_last_name: "Last Name",
    checkout_company: "Company Name (optional)",
    checkout_country: "Country / Region",
    checkout_country_india: "India",
    checkout_country_canada: "Canada",
    checkout_country_uk: "United Kingdom",
    checkout_country_us: "United States",
    checkout_country_turkey: "Turkey",
    checkout_street1: "Street Address*",
    checkout_street2: "Apartment, suite, unit, etc. (optional)",
    checkout_city: "Town / City *",
    checkout_postal: "Postcode / ZIP *",
    checkout_phone: "Phone *",
    checkout_email: "Your Mail *",
    checkout_create_account: "Create An Account?",
    checkout_ship_different: "Ship to a different Address",
    checkout_notes: "Order Notes (Optional)",
    checkout_required_error: "Please fill all required billing fields marked with *.",
    checkout_your_order: "Your Order",
    checkout_buy_now_mode: "Buy now mode: checking out selected item only.",
    checkout_products: "PRODUCTS",
    checkout_subtotals: "SUBTOTALS",
    checkout_direct_bank: "Direct Bank Transfer",
    checkout_direct_bank_desc: "Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.",
    checkout_check_payments: "Check Payments",
    checkout_check_payments_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_cod: "Cash on delivery",
    checkout_cod_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_paypal: "Paypal",
    checkout_paypal_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_vnpay: "VNPAY (Sandbox)",
    checkout_vnpay_desc: "Thanh toan qua cong VNPAY test. Ban se duoc chuyen huong sang VNPAY.",
    checkout_momo: "MOMO (Sandbox)",
    checkout_momo_desc: "Thanh toan qua cong MoMo test. Ban se duoc chuyen huong sang MoMo.",
    checkout_privacy_1: "Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our ",
    checkout_privacy_2: "Privacy Policy",
    checkout_privacy_3: ".",
    checkout_placing_order: "Placing Order...",
    checkout_place_order: "Place Order",
    order_completed: "Your order is completed!",
    order_thank_you: "Thank you. Your order has been received.",
    order_number: "Order Number",
    order_date: "Date",
    order_payment_method: "Payment Method",
    order_details: "Order Details",
    wishlist_title: "My Wishlist",
    wishlist_empty: "Your wishlist is empty",
    wishlist_continue_shopping: "Continue Shopping",
    wishlist_add_to_cart: "Add to Cart",
    auth_login: "Login",
    auth_register: "Register",
    auth_verify_email: "Verify Email",
    auth_google_login: "Continue with Google",
    auth_email_placeholder: "Email address *",
    auth_password_placeholder: "Password *",
    auth_remember_me: "Remember me",
    auth_lost_password: "Lost password?",
    auth_logging_in: "Logging in...",
    auth_log_in_btn: "Log In",
    auth_no_account: "No account yet? ",
    auth_create_account: "Create Account",
    auth_username_placeholder: "Username *",
    auth_password_min_length: "Password * (min 6 characters)",
    auth_first_name_optional: "First Name (optional)",
    auth_last_name_optional: "Last Name (optional)",
    auth_privacy_1: "Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our ",
    auth_privacy_2: "privacy policy",
    auth_privacy_3: ".",
    auth_registering: "Registering...",
    auth_verification_code_placeholder: "6-digit verification code *",
    auth_otp_instruction: "Enter the 6-digit OTP sent to your email address.",
    auth_verifying: "Verifying...",
    auth_verify_code: "Verify Code",
    auth_resend_code: "Resend Code",
    auth_forgot_password: "Forgot Your Password?",
    auth_reset_instruction: "Enter your account email and we will send you a reset token.",
    auth_sending: "Sending...",
    auth_send_reset_token: "Send Reset Token",
    auth_reset_instruction_2: "After receiving the token, reset your password below.",
    auth_reset_token_placeholder: "Reset token *",
    auth_new_password_placeholder: "New password *",
    auth_confirm_password_placeholder: "Confirm new password *",
    auth_updating: "Updating...",
    auth_reset_password: "Reset Password",
    auth_back_to: "Back to ",
    profile_title: "My Profile",
    profile_email: "Email:",
    profile_name: "Name:",
    profile_role: "Role:",
    profile_orders: "Orders:",
    profile_view_history: "View Purchase History",
    profile_logout_success: "Logged out successfully",
    profile_logout: "Log Out",
    orders_history: "Purchase History",
    orders_back_profile: "Back to Profile",
    orders_loading: "Loading your orders...",
    orders_none: "No orders yet.",
    orders_status: "Status: ",
    orders_payment: " | Payment: ",
    orders_subtotal: "Subtotal: ",
    orders_shipping: " | Shipping: ",
    orders_vat: " | VAT: ",
    orders_total: "Total: ",
    orders_each: " each",
    orders_prev: "Previous",
    orders_page: "Page ",
    orders_page_of: " / ",
    orders_next: "Next",
    orders_cancel: "Cancel Order",
    orders_edit: "Edit Shipping",
    orders_cancelling: "Cancelling...",
    orders_updating: "Updating...",
    orders_cancel_confirm: "Are you sure you want to cancel this order?",
    orders_track: "Track shipment",
    orders_track_auth: "Open tracking page",
    orders_reorder: "Buy again",
    orders_reorder_loading: "Adding to cart…",
    orders_support: "Help with this order",
    track_title: "Order tracking",
    track_meta_hint: "This page was opened with your private tracking link. Do not share the URL.",
    track_loading: "Loading order status…",
    track_error: "We could not load this order. Check your link or sign in and open the order from your account.",
    track_order_number: "Order number",
    track_created: "Placed on",
    track_status_order: "Fulfillment",
    track_status_payment: "Payment",
    track_shipping_to: "Ship to",
    track_delivery_pin: "Delivery pin on map",
    track_timeline: "Progress",
    track_step_placed: "Order placed",
    track_step_payment: "Payment confirmed",
    track_step_processing: "Processing",
    track_step_shipped: "Shipped",
    track_step_complete: "Delivered",
    track_items: "Items",
    track_map_title: "Approximate delivery area",
    track_home: "Back to home",
    checkout_trust_title: "Why you can shop with confidence",
    checkout_trust_secure: "Payments are processed securely; we never store your full card details on our servers.",
    checkout_trust_dispatch: "Typical dispatch is 1–2 business days after payment clears (carrier times vary by region).",
    checkout_trust_returns: "Easy returns within 30 days on qualifying items. See our",
    checkout_trust_returns_link: "terms and policies",
    checkout_delivery_title: "Delivery timing",
    checkout_delivery_sub: "Estimates below are typical business-day ranges once your order leaves our warehouse.",
    checkout_delivery_captured: "You shared a delivery location from your device to help couriers find you.",
    checkout_shipping_est_default: "Most orders arrive within 5–10 business days worldwide.",
    checkout_shipping_est_india: "India: typically 4–7 business days after dispatch.",
    checkout_shipping_est_canada: "Canada: typically 5–9 business days after dispatch.",
    checkout_shipping_est_uk: "United Kingdom: typically 3–6 business days after dispatch.",
    checkout_shipping_est_us: "United States: typically 4–8 business days after dispatch.",
    checkout_shipping_est_turkey: "Turkey: typically 5–9 business days after dispatch.",
    order_track_link: "Track this order anytime",
    order_track_copy_hint: "Bookmark this page or check your email for the same link.",
    contact_prefill_order: "Regarding my order "},
  ja: {
    announcement_bar: "80ドル以上のご注文は送料無料、30日間の返品保証。",
    nav_home: "ホーム",
    nav_shop: "ショップ",
    nav_about: "会社情報",
    nav_blog: "ブログ",
    nav_contact: "お問い合わせ",
    nav_chatbot: "チャットボット",
    nav_support: "サポート",
    nav_admin: "管理",
    nav_shipper: "配送",
    nav_fulfillment: "発送",
    nav_assistant: "アシスタント",
    nav_inbox: "受信箱",
    nav_attendance: "勤怠",
    nav_expenses: "支出管理",
    search_placeholder: "商品を検索",
    search_aria: "商品を検索",
    account_aria: "アカウント",
    cart_aria: "カート",
    wishlist_aria: "ウィッシュリスト",
    language_label: "言語",
    theme_to_dark: "ダークモードに切り替え",
    theme_to_light: "ライトモードに切り替え",
    home_fast_dispatch: "迅速な発送",
    home_fast_dispatch_desc: "午後2時までのご注文は即日発送いたします。",
    home_flexible_returns: "柔軟な返品対応",
    home_flexible_returns_desc: "30日間の返品保証、ストアクレジットへの即時還元オプション付き。",
    home_member_rewards: "メンバーシップ特典",
    home_member_rewards_desc: "ご購入ごとにポイントが貯まり、様々な特典をご利用いただけます。",
    home_starting_at_19: "19ドルから",
    home_womens_tshirts: "レディース Tシャツ",
    home_shop_now: "今すぐ購入",
    home_starting_at_39: "39ドルから",
    home_mens_sportswear: "メンズ スポーツウェア",
    home_hot_list: "ホットリスト",
    home_women: "レディース",
    home_collection: "コレクション",
    home_men: "メンズ",
    home_kids: "キッズ",
    home_egift: "Eギフト",
    home_cards: "カード",
    home_surprise_gift: "本当に欲しいものを贈って、大切な人を驚かせましょう。",
    home_new_trend: "ニュートレンド",
    home_summer_sale: "サマーセール スタイリッシュ",
    home_limited_offer: "期間限定の特典 - 最大60%オフ＆送料無料",
    home_discover_more: "もっと見る",
    home_deal_of_the_week: "今週の特別セール",
    home_spring: "スプリング",
    home_days: "日",
    home_hours: "時間",
    home_minutes: "分",
    home_seconds: "秒",
    home_our_trendy: "人気の",
    home_products: "商品",
    home_all: "すべて",
    home_new_arrivals: "新着商品",
    home_best_seller: "ベストセラー",
    home_top_rated: "高評価",
    home_add_to_cart: "カートに追加",
    home_limited: "限定",
    home_edition: "版",
    home_loading_products: "商品を読み込み中...",
    home_buy_now: "今すぐ購入",
    home_processing: "処理中...",
    home_view_in_shop: "ショップで見る",
    home_id: "ID:",
    home_price: "価格:",
    home_reviews: "レビュー:",
    home_status: "ステータス:",
    home_active: "有効",
    home_inactive: "無効",
    about_title: "Uomoについて",
    about_our_story: "私たちの物語",
    about_story_desc_1: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    about_story_desc_2: "実りある良い日々を見た、その中、水の上で、見た。",
    about_our_mission: "私たちの使命",
    about_mission_desc: "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    about_our_vision: "私たちのビジョン",
    about_vision_desc: "Quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    about_the_company: "会社について",
    about_company_desc: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    about_company_partners: "パートナー企業",
    contact_us: "お問い合わせ",
    contact_store_london: "ロンドンストア",
    contact_store_london_address_1: "1418 River Drive, Suite 35 Cottonhall, CA 9622",
    contact_store_london_address_2: "イギリス",
    contact_store_india: "インドストア",
    contact_store_india_address_1: "A-791, Bandra Reclamation Rd, Mumbai",
    contact_store_india_address_2: "マハラシュトラ州",
    contact_get_in_touch: "連絡を取り合う",
    contact_placeholder_name: "名前 *",
    contact_placeholder_email: "メールアドレス *",
    contact_placeholder_message: "メッセージ",
    contact_submit: "送信",
    shop_home: "ホーム",
    shop_the_shop: "ショップ",
    shop_filter: "フィルター",
    shop_filter_by: "フィルター条件",
    shop_default_sorting: "デフォルトの並べ替え",
    shop_featured: "注目",
    shop_best_selling: "ベストセラー",
    shop_alpha_az: "アルファベット順, A-Z",
    shop_alpha_za: "アルファベット順, Z-A",
    shop_price_low_high: "価格, 安い順",
    shop_price_high_low: "価格, 高い順",
    shop_date_old_new: "日付, 古い順",
    shop_date_new_old: "日付, 新しい順",
    shop_out_of_stock: "在庫切れ",
    shop_unavailable: "利用不可",
    shop_limit_reached: "上限に達しました",
    shop_add_to_cart: "カートに追加",
    shop_category_dresses: "ドレス",
    shop_buy_now: "今すぐ購入",
    shop_processing: "処理中...",
    shop_user_review: "ユーザーレビュー",
    shop_user_reviews: "ユーザーレビュー",
    shop_prev: "前へ",
    shop_next: "次へ",
    shop_product_id: "ID:",
    shop_product_price: "価格:",
    shop_product_reviews: "レビュー:",
    shop_user_rating: "ユーザー評価:",
    shop_remaining_stock: "残り在庫:",
    shop_status: "ステータス:",
    shop_active: "有効",
    shop_inactive: "無効",
    shop_focus_link: "フォーカスリンク:",
    shop_view_in_list: "商品リストで見る",
    shop_rate_comment: "評価とコメント",
    shop_write_comment: "この商品に対するコメントを書く...",
    shop_submit_review: "レビューを送信",
    shop_loading_reviews: "レビューを読み込み中...",
    shop_no_reviews: "まだレビューはありません。最初のコメントを書きましょう。",
    shop_unlike: "いいねを取り消す",
    shop_like: "いいね",
    shop_dislike: "低評価",
    shop_reply: "返信",
    shop_write_reply: "返信を書く...",
    shop_post_reply: "返信を投稿",
    shop_cancel: "キャンセル",
    shop_save: "保存",
    shop_your_description: "商品の説明",
    shop_write_description: "商品の説明を書いてください...",
    shop_save_description: "説明を保存",
    cart_title: "カート",
    cart_tab_1: "ショッピングバッグ",
    cart_tab_1_desc: "アイテムリストの管理",
    cart_tab_2: "配送とチェックアウト",
    cart_tab_2_desc: "アイテムのチェックアウト",
    cart_tab_3: "確認",
    cart_tab_3_desc: "注文内容の確認と送信",
    cart_table_product: "商品",
    cart_table_action: "アクション",
    cart_table_price: "価格",
    cart_table_quantity: "数量",
    cart_table_subtotal: "小計",
    cart_buy_now: "今すぐ購入",
    cart_empty: "カートは空です！",
    cart_shop_now: "今すぐ購入",
    cart_coupon_placeholder: "クーポンコード",
    cart_applying_coupon: "適用中...",
    cart_apply_coupon: "クーポンを適用",
    cart_update_cart: "カートを更新",
    cart_totals: "カート合計",
    cart_shipping: "送料",
    cart_change_address: "住所を変更",
    cart_vat: "消費税",
    cart_discount: "割引",
    cart_total: "合計",
    cart_proceed_checkout: "チェックアウトへ進む",
    checkout_billing_details: "請求先詳細",
    checkout_first_name: "名",
    checkout_last_name: "姓",
    checkout_company: "会社名（オプション）",
    checkout_country: "国 / 地域",
    checkout_country_india: "インド",
    checkout_country_canada: "カナダ",
    checkout_country_uk: "イギリス",
    checkout_country_us: "アメリカ",
    checkout_country_turkey: "トルコ",
    checkout_street1: "町名・番地*",
    checkout_street2: "アパート、マンション名、部屋番号など（オプション）",
    checkout_city: "市区町村*",
    checkout_postal: "郵便番号*",
    checkout_phone: "電話番号*",
    checkout_email: "メールアドレス*",
    checkout_create_account: "アカウントを作成しますか？",
    checkout_ship_different: "別の住所へ配送する",
    checkout_notes: "注文メモ（オプション）",
    checkout_required_error: "* が付加されている必須項目をすべて入力してください。",
    checkout_your_order: "ご注文内容",
    checkout_buy_now_mode: "今すぐ購入モード：選択したアイテムのみをチェックアウトします。",
    checkout_products: "商品",
    checkout_subtotals: "小計",
    checkout_direct_bank: "直接銀行振込",
    checkout_direct_bank_desc: "当社の銀行口座に直接お支払いください。お支払いのご依頼人名としてご注文IDをご使用ください。お支払いが確認されるまで商品は発送されません。",
    checkout_check_payments: "小切手支払い",
    checkout_check_payments_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_cod: "代金引換",
    checkout_cod_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_paypal: "Paypal",
    checkout_paypal_desc: "Phasellus sed volutpat orci. Fusce eget lore mauris vehicula elementum gravida nec dui. Aenean aliquam varius ipsum.",
    checkout_vnpay: "VNPAY（サンドボックス）",
    checkout_vnpay_desc: "VNPAYのテストゲートウェイで支払います。VNPAYにリダイレクトされます。",
    checkout_momo: "MOMO（サンドボックス）",
    checkout_momo_desc: "MoMoのテストゲートウェイで支払います。MoMoにリダイレクトされます。",
    checkout_privacy_1: "お客様の個人データは、ご注文の処理、本ウェブサイト全体での体験のサポート、および当社の",
    checkout_privacy_2: "プライバシーポリシー",
    checkout_privacy_3: "に記載されているその他の目的のために使用されます。",
    checkout_placing_order: "注文を確定しています...",
    checkout_place_order: "注文を確定する",
    order_completed: "注文が完了しました！",
    order_thank_you: "ありがとうございます。注文を受け付けました。",
    order_number: "注文番号",
    order_date: "日付",
    order_payment_method: "支払い方法",
    order_details: "注文の詳細",
    wishlist_title: "マイウィッシュリスト",
    wishlist_empty: "ウィッシュリストは空です",
    wishlist_continue_shopping: "買い物を続ける",
    wishlist_add_to_cart: "カートに追加",
    auth_login: "ログイン",
    auth_register: "登録",
    auth_verify_email: "メール認証",
    auth_google_login: "Googleでログイン",
    auth_email_placeholder: "メールアドレス *",
    auth_password_placeholder: "パスワード *",
    auth_remember_me: "ログイン状態を保持する",
    auth_lost_password: "パスワードをお忘れですか？",
    auth_logging_in: "ログイン中...",
    auth_log_in_btn: "ログイン",
    auth_no_account: "アカウントをお持ちでないですか？ ",
    auth_create_account: "アカウントを作成",
    auth_username_placeholder: "ユーザー名 *",
    auth_password_min_length: "パスワード * (最小6文字)",
    auth_first_name_optional: "名 (オプション)",
    auth_last_name_optional: "姓 (オプション)",
    auth_privacy_1: "お客様の個人データは、本ウェブサイト全体での体験のサポート、アカウントへのアクセスの管理、および当社の",
    auth_privacy_2: "プライバシーポリシー",

    auth_privacy_3: "に記載されているその他の目的のために使用されます。",
    auth_registering: "登録中...",
    auth_verification_code_placeholder: "6桁の認証コード *",
    auth_otp_instruction: "メールアドレスに送信された6桁のOTPを入力してください。",
    auth_verifying: "認証中...",
    auth_verify_code: "コードを認証",
    auth_resend_code: "コードを再送信",
    auth_forgot_password: "パスワードをお忘れですか？",
    auth_reset_instruction: "アカウントのメールアドレスを入力すると、リセットトークンが送信されます。",
    auth_sending: "送信中...",
    auth_send_reset_token: "リセットトークンを送信",
    auth_reset_instruction_2: "トークンを受け取ったら、以下からパスワードをリセットしてください。",
    auth_reset_token_placeholder: "リセットトークン *",
    auth_new_password_placeholder: "新しいパスワード *",
    auth_confirm_password_placeholder: "新しいパスワード（確認）*",
    auth_updating: "更新中...",
    auth_reset_password: "パスワードをリセット",
    auth_back_to: "戻る ",
    profile_title: "マイプロフィール",
    profile_email: "メールアドレス:",
    profile_name: "名前:",
    profile_role: "役割:",
    profile_orders: "注文:",
    profile_view_history: "購入履歴を見る",
    profile_logout_success: "正常にログアウトしました",
    profile_logout: "ログアウト",
    orders_history: "購入履歴",
    orders_back_profile: "プロフィールに戻る",
    orders_loading: "注文を読み込んでいます...",
    orders_none: "まだ注文はありません。",
    orders_status: "ステータス: ",
    orders_payment: " | 支払い: ",
    orders_subtotal: "小計: ",
    orders_shipping: " | 送料: ",
    orders_vat: " | 消費税: ",
    orders_total: "合計: ",
    orders_each: " それぞれ",
    orders_prev: "前へ",
    orders_page: "ページ ",
    orders_page_of: " / ",
    orders_next: "次へ",
    orders_cancel: "注文をキャンセル",
    orders_edit: "配送情報を編集",
    orders_cancelling: "キャンセル中...",
    orders_updating: "更新中...",
    orders_cancel_confirm: "この注文をキャンセルしてもよろしいですか？",
    orders_track: "配送状況を見る",
    orders_track_auth: "追跡ページを開く",
    orders_reorder: "もう一度購入",
    orders_reorder_loading: "カートに追加中…",
    orders_support: "この注文のサポート",
    track_title: "注文の追跡",
    track_meta_hint: "非公開の追跡リンクから開いています。URLは他人と共有しないでください。",
    track_loading: "ステータスを読み込み中…",
    track_error: "注文を読み込めませんでした。リンクを確認するか、ログインしてアカウントから開いてください。",
    track_order_number: "注文番号",
    track_created: "注文日",
    track_status_order: "出荷処理",
    track_status_payment: "お支払い",
    track_shipping_to: "お届け先",
    track_delivery_pin: "地図上のお届け位置",
    track_timeline: "進捗",
    track_step_placed: "注文を受け付けました",
    track_step_payment: "お支払いの確認",
    track_step_processing: "処理中",
    track_step_shipped: "発送済み",
    track_step_complete: "配達完了",
    track_items: "商品",
    track_map_title: "おおよそのお届けエリア",
    track_home: "ホームに戻る",
    checkout_trust_title: "安心してお買い物いただける理由",
    checkout_trust_secure: "お支払いは安全に処理されます。カードの完全な番号を当社サーバーに保存することはありません。",
    checkout_trust_dispatch: "入金確認後、通常1〜2営業日で出荷します（地域により配送会社の所要日数は異なります）。",
    checkout_trust_returns: "対象商品は30日以内の返品が可能です。詳細は",
    checkout_trust_returns_link: "利用規約とポリシー",
    checkout_delivery_title: "お届けの目安",
    checkout_delivery_sub: "以下は倉庫からの発送後の営業日ベースの目安です。",
    checkout_delivery_captured: "お届け先の参考として、端末から位置情報を共有済みです。",
    checkout_shipping_est_default: "多くの地域で発送後5〜10営業日程度です。",
    checkout_shipping_est_india: "インド: 発送後おおむね4〜7営業日。",
    checkout_shipping_est_canada: "カナダ: 発送後おおむね5〜9営業日。",
    checkout_shipping_est_uk: "イギリス: 発送後おおむね3〜6営業日。",
    checkout_shipping_est_us: "アメリカ: 発送後おおむね4〜8営業日。",
    checkout_shipping_est_turkey: "トルコ: 発送後おおむね5〜9営業日。",
    order_track_link: "いつでもこの注文を追跡",
    order_track_copy_hint: "このページをブックマークするか、同じリンクが記載されたメールをご確認ください。",
    contact_prefill_order: "次の注文について: "}};

export function getTranslation(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations.en[key];
}
