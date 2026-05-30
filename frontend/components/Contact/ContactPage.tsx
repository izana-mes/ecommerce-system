"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/providers/LocaleProvider";
import "./ContactPage.css";

const ContactPage: React.FC = () => {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const prefilledMessage = useMemo(() => {
    const order = (searchParams.get("order") || "").trim();
    if (!order) return "";
    return `${t("contact_prefill_order")}${order}:\n\n`;
  }, [searchParams, t]);
  const displayMessage = message || prefilledMessage;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    alert(
      `Thank You ${name} for Contacting Us. We will Get Back to You Soon.\n\nYour Mail Id - ${email}.\nYour Message is - ${displayMessage}`
    );

    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="contactSection jp-dot-bg">
      {/* FLOATING VERTICAL BADGE */}
      <div className="jp-vertical-badge">CONTACT&nbsp;/&nbsp;お問い合わせ</div>

      {/* ── PAGE HEADER ── */}
      <div className="contactHero">
        <div className="contactHeroInner">
          <div className="jp-title-wrap">
            <span className="jp-subtitle">CONTACT US&nbsp;&nbsp;/&nbsp;&nbsp;お問い合わせ</span>
            <h2 className="contactHeroTitle">{t("contact_us")}</h2>
            <p className="contactHeroSub">
              We&apos;d love to hear from you&nbsp;—&nbsp;send us a message anytime.
            </p>
          </div>
        </div>

        {/* Decorative fine line */}
        <div className="contactHeroDivider" />
      </div>

      {/* ── MARQUEE ── */}
      <div className="jp-marquee contact-marquee">
        <div className="jp-marquee-track">
          {[...Array(2)].map((_, i) =>
            ["GET IN TOUCH", "お問い合わせ", "SEND A MESSAGE", "メッセージを送る", "WE REPLY FAST", "迅速な対応"].map(
              (item) => (
                <span key={`${i}-${item}`} className="jp-marquee-item">
                  {item} <span>◆</span>
                </span>
              )
            )
          )}
        </div>
      </div>

      {/* ── MAP ── */}
      <div className="contactMap">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d49206.16593395236!2d2.5776979486328124!3d39.57346430000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x129793280de39c05%3A0x85d5f5ea839d6c2a!2sUOMO!5e0!3m2!1sen!2sin!4v1708798894132!5m2!1sen!2sin"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="map"
          allowFullScreen
        />
        <div className="contactMapOverlay">
          <span>MAP&nbsp;/&nbsp;地図</span>
        </div>
      </div>

      {/* ── INFO + FORM ── */}
      <div className="contactInfo">

        {/* ADDRESS CARDS */}
        <div className="contactAddress">

          <div className="contactAddressLabel">
            <span className="jp-subtitle" style={{ fontSize: "11px" }}>OUR LOCATIONS&nbsp;/&nbsp;店舗情報</span>
          </div>

          <div className="address">
            <div className="addressIcon">🇬🇧</div>
            <div>
              <h3>{t("contact_store_london")}</h3>
              <p>
                {t("contact_store_london_address_1")}
                <br /> {t("contact_store_london_address_2")}
              </p>
              <p className="addressContact">
                admin@dummymail.com&nbsp;&nbsp;·&nbsp;&nbsp;+44 20 7123 4567
              </p>
            </div>
          </div>

          <div className="addressDividerLine" />

          <div className="address">
            <div className="addressIcon">🇮🇳</div>
            <div>
              <h3>{t("contact_store_india")}</h3>
              <p>
                {t("contact_store_india_address_1")}
                <br /> {t("contact_store_india_address_2")}
              </p>
              <p className="addressContact">
                contact@dummymail.com&nbsp;&nbsp;·&nbsp;&nbsp;+91 98765 43210
              </p>
            </div>
          </div>

          {/* HOURS CARD */}
          <div className="contactHoursCard">
            <span className="jp-subtitle" style={{ fontSize: "11px", marginBottom: "14px" }}>STORE HOURS&nbsp;/&nbsp;営業時間</span>
            <div className="contactHoursRow">
              <span>Mon – Fri</span>
              <span>10:00 – 20:00</span>
            </div>
            <div className="contactHoursRow">
              <span>Sat – Sun</span>
              <span>11:00 – 18:00</span>
            </div>
            <div className="contactHoursRow holiday">
              <span>Holidays</span>
              <span>Closed</span>
            </div>
          </div>
        </div>

        {/* FORM */}
        <div className="contactForm">
          <div className="contactFormHeader">
            <span className="jp-subtitle" style={{ fontSize: "11px", marginBottom: "12px" }}>SEND A MESSAGE&nbsp;/&nbsp;メッセージ</span>
            <h3>{t("contact_get_in_touch")}</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="contactFormField">
              <label className="contactFormLabel">
                {t("contact_placeholder_name")}&nbsp;<span className="contactFormRequired">*</span>
              </label>
              <input
                type="text"
                value={name}
                placeholder={t("contact_placeholder_name")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setName(e.target.value)
                }
                required
              />
            </div>

            <div className="contactFormField">
              <label className="contactFormLabel">
                {t("contact_placeholder_email")}&nbsp;<span className="contactFormRequired">*</span>
              </label>
              <input
                type="email"
                value={email}
                placeholder={t("contact_placeholder_email")}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                required
              />
            </div>

            <div className="contactFormField">
              <label className="contactFormLabel">{t("contact_placeholder_message")}</label>
              <textarea
                rows={8}
                placeholder={t("contact_placeholder_message")}
                value={displayMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setMessage(e.target.value)
                }
              />
            </div>

            <button type="submit" className="contactSubmitBtn">
              <span className="contactSubmitEn">{t("contact_submit")}</span>
              <span className="contactSubmitJp">送信する</span>
              <span className="contactSubmitSheen" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
