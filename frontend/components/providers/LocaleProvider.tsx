"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getTranslation, Locale, TranslationKey } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const attrLocale = document.documentElement.getAttribute("data-locale");
  if (attrLocale === "ja" || attrLocale === "en") return attrLocale;
  const stored = localStorage.getItem("locale");
  if (stored === "ja" || stored === "en") return stored;
  return navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const initialLocale = getInitialLocale();
    document.documentElement.setAttribute("data-locale", initialLocale);
    document.documentElement.setAttribute("lang", initialLocale === "ja" ? "ja" : "en");

    const timeoutId = window.setTimeout(() => {
      setLocaleState(initialLocale);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const setLocale = (nextLocale: Locale) => {
    document.documentElement.setAttribute("data-locale", nextLocale);
    document.documentElement.setAttribute("lang", nextLocale === "ja" ? "ja" : "en");
    localStorage.setItem("locale", nextLocale);
    setLocaleState(nextLocale);
  };

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TranslationKey) => getTranslation(locale, key)}),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
