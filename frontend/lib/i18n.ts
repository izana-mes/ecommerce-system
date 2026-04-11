export type Locale = "en" | "ja";

export type TranslationKey =
  | "announcement_bar"
  | "nav_home"
  | "nav_shop"
  | "nav_about"
  | "nav_blog"
  | "nav_contact"
  | "nav_admin"
  | "search_placeholder"
  | "search_aria"
  | "account_aria"
  | "cart_aria"
  | "wishlist_aria"
  | "language_label"
  | "theme_to_dark"
  | "theme_to_light";

type Dictionary = Record<TranslationKey, string>;

export const translations: Record<Locale, Dictionary> = {
  en: {
    announcement_bar: "Free shipping on orders over $80 and easy 30-day returns.",
    nav_home: "HOME",
    nav_shop: "SHOP",
    nav_about: "ABOUT",
    nav_blog: "BLOG",
    nav_contact: "CONTACT",
    nav_admin: "ADMIN",
    search_placeholder: "Search products",
    search_aria: "Search products",
    account_aria: "Account",
    cart_aria: "Cart",
    wishlist_aria: "Wishlist",
    language_label: "Language",
    theme_to_dark: "Switch to dark mode",
    theme_to_light: "Switch to light mode",
  },
  ja: {
    announcement_bar: "80ドル以上のご注文は送料無料、30日間の返品保証。",
    nav_home: "ホーム",
    nav_shop: "ショップ",
    nav_about: "会社情報",
    nav_blog: "ブログ",
    nav_contact: "お問い合わせ",
    nav_admin: "管理",
    search_placeholder: "商品を検索",
    search_aria: "商品を検索",
    account_aria: "アカウント",
    cart_aria: "カート",
    wishlist_aria: "ウィッシュリスト",
    language_label: "言語",
    theme_to_dark: "ダークモードに切り替え",
    theme_to_light: "ライトモードに切り替え",
  },
};

export function getTranslation(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations.en[key];
}
