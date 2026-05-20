"use client";
import { FormEvent, useState, useEffect, useCallback, useMemo } from "react";
import { useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import "./Navbar.css";
import { getUser, refreshCurrentUserFromServer, subscribeToAuthChanges } from "@/lib/auth";
import { useLocale } from "@/components/providers/LocaleProvider";
import { TranslationKey } from "@/lib/i18n";
import confetti from "canvas-confetti";

import { RiMenu2Line } from "react-icons/ri";
import { FiSearch } from "react-icons/fi";
import { FiCheckCircle } from "react-icons/fi";
import { FaRegUser } from "react-icons/fa6";
import { RiShoppingBagLine } from "react-icons/ri";
import { MdOutlineClose } from "react-icons/md";
import { FiHeart } from "react-icons/fi";
import { FiMoon, FiSun } from "react-icons/fi";

import Badge from "@mui/material/Badge";

const BASE_LINKS = [
  { href: "/", key: "nav_home" as TranslationKey },
  { href: "/shop", key: "nav_shop" as TranslationKey },
  { href: "/about", key: "nav_about" as TranslationKey },
  { href: "/blog", key: "nav_blog" as TranslationKey },
  { href: "/contact", key: "nav_contact" as TranslationKey },
];

const CUSTOMER_LINKS = [
  { href: "/chatbot", key: "nav_chatbot" as TranslationKey },
  { href: "/support-chat", key: "nav_support" as TranslationKey },
];

const STAFF_LINKS = [
  { href: "/staff/attendance", key: "nav_attendance" as TranslationKey },
  { href: "/staff/chatbot", key: "nav_assistant" as TranslationKey },
  { href: "/staff/support-chat", key: "nav_inbox" as TranslationKey },
  { href: "/staff/shipping", key: "nav_fulfillment" as TranslationKey },
];

/** Shippers only need site home, inbox (user/admin messages), and the delivery portal — not staff tools or shop chrome. */
const SHIPPER_NAV_LINKS = [
  { href: "/", key: "nav_home" as TranslationKey },
  { href: "/staff/support-chat", key: "nav_inbox" as TranslationKey },
  { href: "/shipper/dashboard", key: "nav_shipper" as TranslationKey },
];

export default function Navbar() {
  const { locale, setLocale, t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const cartItems = useSelector((state: RootState) => state.cart.itemsById);

  const [menuMobileOpen, setMenuMobileOpen] = useState(false);
  const [hasUser, setHasUser] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isStaffUser, setIsStaffUser] = useState(false);
  const [isShipperUser, setIsShipperUser] = useState(false);
  const [isSupplierUser, setIsSupplierUser] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSearchPopup, setShowSearchPopup] = useState(false);
  const [searchPopupText, setSearchPopupText] = useState("");
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [isOverHomeBanner, setIsOverHomeBanner] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [shopCategories, setShopCategories] = useState<string[]>([]);
  const lastScrollY = useRef(0);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      if (currentTheme === "dark" || currentTheme === "light") {
        setTheme(currentTheme);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const fetchSearchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/products/search-history?limit=8", {
        method: "GET",
        credentials: "include",
        cache: "no-store"});
      if (!response.ok) {
        setSearchHistory([]);
        return;
      }
      const data = await response.json();
      setSearchHistory(Array.isArray(data) ? data : []);
    } catch {
      setSearchHistory([]);
    }
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      const user = getUser();
      setHasUser(!!user);
      setIsAdminUser(user?.role === "admin");
      setIsStaffUser(user?.role === "employee");
      setIsShipperUser(user?.role === "shipper");
      setIsSupplierUser(user?.role === "supplier");
      void fetchSearchHistory();
      void refreshCurrentUserFromServer().then((refreshed) => {
        if (!refreshed) {
          setHasUser(false);
          setIsAdminUser(false);
          setIsStaffUser(false);
          setIsShipperUser(false);
          setIsSupplierUser(false);
          return;
        }
        setHasUser(true);
        setIsAdminUser(refreshed.role === "admin");
        setIsStaffUser(refreshed.role === "employee");
        setIsShipperUser(refreshed.role === "shipper");
        setIsSupplierUser(refreshed.role === "supplier");
        void fetchSearchHistory();
      });
    };

    syncAuthState();
    return subscribeToAuthChanges(syncAuthState);
  }, [fetchSearchHistory]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/products", { method: "GET", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }
        const data = await response.json().catch(() => []);
        return Array.isArray(data) ? data : [];
      })
      .then((products: Array<{ category?: string }>) => {
        if (cancelled) {
          return;
        }
        const categories = Array.from(
          new Set(
            products
              .map((item) => String(item?.category ?? "").trim())
              .filter(Boolean)
          )
        );
        setShopCategories(
          categories.length > 0
            ? categories.sort((a, b) => a.localeCompare(b))
            : ["Jackets", "Tops", "Dresses", "Shorts", "Knitwear"]
        );
      })
      .catch(() => {
        if (!cancelled) {
          setShopCategories(["Jackets", "Tops", "Dresses", "Shorts", "Knitwear"]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!showHistory || !query) {
      return;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(() => {
      void fetch(`/api/products/suggest?q=${encodeURIComponent(query)}&limit=8`, {
        method: "GET",
        cache: "no-store"})
        .then(async (response) => {
          if (!response.ok) {
            return [];
          }
          const data = await response.json();
          return Array.isArray(data) ? data : [];
        })
        .then((data: string[]) => {
          if (!isCancelled) {
            setSearchSuggestions(data);
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setSearchSuggestions([]);
          }
        });
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchHistory, searchTerm, showHistory]);

  const dropdownSuggestions = useMemo(() => {
    const query = searchTerm.trim();
    if (!showHistory) {
      return [];
    }
    if (!query) {
      return searchHistory;
    }
    return searchSuggestions;
  }, [searchHistory, searchSuggestions, searchTerm, showHistory]);

  const toggleMenuMobile = () => {
    setMenuMobileOpen((prev) => !prev);
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"});
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchTerm.trim();

    router.push(query ? `/shop?q=${encodeURIComponent(query)}` : "/shop");
    setShowHistory(false);
    if (query) {
      setSearchPopupText(query);
      setShowSearchPopup(true);
    }
    scrollToTop();
  };

  const closeMobileMenu = useCallback(() => {
    setMenuMobileOpen(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuMobileOpen ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [menuMobileOpen]);

  useEffect(() => {
    const updateBannerOverlap = () => {
      if (pathname !== "/") {
        setIsOverHomeBanner(false);
        return;
      }

      const navElement = navRef.current;
      const bannerElement = document.querySelector('[data-nav-blur-region="home-banner"]');

      if (!navElement || !bannerElement) {
        setIsOverHomeBanner(false);
        return;
      }

      const navRect = navElement.getBoundingClientRect();
      const bannerRect = bannerElement.getBoundingClientRect();
      const overlapsBanner = bannerRect.top < navRect.bottom - 12 && bannerRect.bottom > navRect.top + 12;

      setIsOverHomeBanner(overlapsBanner);
    };

    const handleScroll = () => {
      if (menuMobileOpen) {
        setIsNavHidden(false);
        updateBannerOverlap();
        return;
      }

      const currentY = window.scrollY;
      if (currentY <= 16) {
        setIsNavHidden(false);
        lastScrollY.current = currentY;
        updateBannerOverlap();
        return;
      }

      const scrollingDown = currentY > lastScrollY.current + 4;
      const scrollingUp = currentY < lastScrollY.current - 4;

      if (scrollingDown) {
        setIsNavHidden(true);
      } else if (scrollingUp) {
        setIsNavHidden(false);
      }

      lastScrollY.current = currentY;
      updateBannerOverlap();
    };

    updateBannerOverlap();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateBannerOverlap);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateBannerOverlap);
    };
  }, [menuMobileOpen, pathname]);

  const isPureShipper = isShipperUser && !isAdminUser && !isStaffUser;

  const navLinks = useMemo(() => {
    if (isPureShipper) {
      return [...SHIPPER_NAV_LINKS];
    }
    if (isAdminUser || isStaffUser || isShipperUser) {
      return [
        ...BASE_LINKS,
        ...STAFF_LINKS,
        ...(isAdminUser ? [{ href: "/admin", key: "nav_admin" as TranslationKey }] : []),
      ];
    }
    const isRetailCustomer =
      hasUser && !isAdminUser && !isStaffUser && !isShipperUser && !isSupplierUser;
    return [
      ...BASE_LINKS,
      ...(isRetailCustomer ? [{ href: "/expenses", key: "nav_expenses" as TranslationKey }] : []),
      ...CUSTOMER_LINKS,
    ];
  }, [hasUser, isAdminUser, isStaffUser, isShipperUser, isSupplierUser, isPureShipper]);

  const isCurrentLink = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      if (href === "/shipper/dashboard") {
        return pathname === "/shipper/dashboard" || pathname === "/shipper";
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const handleSelectHistory = async (value: string) => {
    setSearchTerm(value);
    setShowHistory(false);
    setSearchPopupText(value);
    setShowSearchPopup(true);
    try {
      const response = await fetch(`/api/products?q=${encodeURIComponent(value)}`, {
        method: "GET",
        cache: "no-store"});
      const data = await response.json().catch(() => []);
      const products = Array.isArray(data) ? data : [];

      const lowered = value.trim().toLowerCase();
      const exactMatch = products.find((product: { productName?: string; productID?: string }) => {
        const productName = String(product?.productName ?? "").trim().toLowerCase();
        const productID = String(product?.productID ?? "").trim().toLowerCase();
        return productName === lowered || productID === lowered;
      });

      const targetProduct = exactMatch ?? products[0];
      if (targetProduct?.productID) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          zIndex: 9999
        });
        router.push(
          `/shop?q=${encodeURIComponent(value)}&focus=${encodeURIComponent(targetProduct.productID)}`,
          { scroll: true }
        );
      } else {
        router.push(`/shop?q=${encodeURIComponent(value)}`, { scroll: true });
      }
    } catch {
      router.push(`/shop?q=${encodeURIComponent(value)}`, { scroll: true });
    }
  };

  useEffect(() => {
    if (!showSearchPopup) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setShowSearchPopup(false);
    }, 1800);
    return () => window.clearTimeout(timeoutId);
  }, [showSearchPopup]);

  return (
    <>
      <div className="announcementBar">
        {t("announcement_bar")}
      </div>
      <nav
        ref={navRef}
        className={`navBar ${isNavHidden ? "navBarHidden" : ""} ${isOverHomeBanner ? "navBarOverBanner" : ""}`}
      >
        <div className="logoContainer">
          <Link href="/" onClick={scrollToTop} aria-label="Uomo Home">
            <img src="/logo.png" alt="Uomo" />
          </Link>
        </div>

        <button
          className="mobileMenuButton"
          type="button"
          aria-label={menuMobileOpen ? "Close menu" : "Open menu"}
          onClick={toggleMenuMobile}
        >
          {menuMobileOpen ? <MdOutlineClose size={22} /> : <RiMenu2Line size={22} />}
        </button>

        <div className={`linkContainer ${menuMobileOpen ? "linkContainerOpen" : ""}`}>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href} className={link.href === "/shop" ? "shopNavItem" : ""}>
                <Link
                  href={link.href}
                  onClick={() => {
                    scrollToTop();
                    closeMobileMenu();
                  }}
                  className={isCurrentLink(link.href) ? "activeLink" : ""}
                >
                  {t(link.key)}
                </Link>
                {link.href === "/shop" && shopCategories.length > 0 ? (
                  <div className="shopCategoryDropdown">
                    {shopCategories.map((category) => (
                      <Link
                        key={category}
                        href={`/shop?category=${encodeURIComponent(category)}`}
                        onClick={() => {
                          scrollToTop();
                          closeMobileMenu();
                        }}
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="iconContainer">
          <button
            type="button"
            className="themeToggleButton"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("theme_to_light") : t("theme_to_dark")}
            title={theme === "dark" ? t("theme_to_light") : t("theme_to_dark")}
          >
            {theme === "dark" ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <label className="localeSelectWrap" aria-label={t("language_label")}>
            <select
              className="localeSelect"
              value={locale}
              onChange={(event) => setLocale(event.target.value === "ja" ? "ja" : "en")}
            >
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          {!isPureShipper ? (
            <div
              className="navSearchWrap"
              onBlur={() => setTimeout(() => setShowHistory(false), 120)}
            >
              <form className="navSearchForm" onSubmit={handleSearch}>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onFocus={() => {
                    setShowHistory(true);
                    void fetchSearchHistory();
                  }}
                  placeholder={t("search_placeholder")}
                  aria-label={t("search_aria")}
                />
                <button type="submit" aria-label={t("search_aria")}>
                  <FiSearch size={18} />
                </button>
              </form>
              {dropdownSuggestions.length > 0 && (
                <div className="searchHistoryDropdown">
                  {dropdownSuggestions.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className="searchHistoryItem"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        void handleSelectHistory(item);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
          <span>
            <Link href={hasUser ? "/profile" : "/login"} aria-label={t("account_aria")}>
              <FaRegUser size={22} onClick={scrollToTop} />
            </Link>
          </span>
          {!isPureShipper ? (
            <>
              <span>
                <Link href="/cart" aria-label={t("cart_aria")}>
                  <Badge
                    badgeContent={Object.values(cartItems).reduce((sum, item) => {
                      return sum + (item.quantity ?? 0);
                    }, 0)}
                    color="primary"
                    anchorOrigin={{
                      vertical: "bottom",
                      horizontal: "right"}}
                  >
                    <RiShoppingBagLine size={22} onClick={scrollToTop} />
                  </Badge>
                </Link>
              </span>
              <span>
                <Link href={"/wishlist"} aria-label={t("wishlist_aria")}>
                  <FiHeart size={22} onClick={scrollToTop} />
                </Link>
              </span>
            </>
          ) : null}
        </div>
      </nav>

      {menuMobileOpen ? <button className="mobileBackdrop" onClick={closeMobileMenu} aria-label="Close menu" /> : null}
      {showSearchPopup ? (
        <div className="searchSuccessPopup" role="status" aria-live="polite">
          <FiCheckCircle size={18} />
          <span>
            Search successful{searchPopupText ? `: ${searchPopupText}` : ""}
          </span>
        </div>
      ) : null}
    </>
  );
}
