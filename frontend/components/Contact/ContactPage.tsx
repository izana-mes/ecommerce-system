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
    <div className="contactSection">
      <h2>{t("contact_us")}</h2>

      {/* MAP */}
      <div className="contactMap" data-floating-banner>
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d49206.16593395236!2d2.5776979486328124!3d39.57346430000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x129793280de39c05%3A0x85d5f5ea839d6c2a!2sUOMO!5e0!3m2!1sen!2sin!4v1708798894132!5m2!1sen!2sin"
          width="800"
          height="600"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="map"
          allowFullScreen
        />
      </div>

      {/* INFO */}
      <div className="contactInfo">
        <div className="contactAddress">
          <div className="address">
            <h3>{t("contact_store_london")}</h3>
            <p>
              {t("contact_store_london_address_1")}
              <br /> {t("contact_store_london_address_2")}
            </p>
            <p>
              admin@dummymail.com
              <br />
              +44 20 7123 4567
            </p>
          </div>

          <div className="address">
            <h3>{t("contact_store_india")}</h3>
            <p>
              {t("contact_store_india_address_1")}
              <br /> {t("contact_store_india_address_2")}
            </p>
            <p>
              contact@dummymail.com
              <br />
              +44 20 7123 4567
            </p>
          </div>
        </div>

        {/* FORM */}
        <div className="contactForm">
          <h3>{t("contact_get_in_touch")}</h3>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={name}
              placeholder={t("contact_placeholder_name")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              required
            />

            <input
              type="email"
              value={email}
              placeholder={t("contact_placeholder_email")}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
            />

            <textarea
              rows={10}
              placeholder={t("contact_placeholder_message")}
              value={displayMessage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setMessage(e.target.value)
              }
            />

            <button type="submit">{t("contact_submit")}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
