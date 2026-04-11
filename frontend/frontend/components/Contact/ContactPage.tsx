"use client";

import React, { useState } from "react";
import "./ContactPage.css";

const ContactPage: React.FC = () => {
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    alert(
      `Thank You ${name} for Contacting Us. We will Get Back to You Soon.\n\nYour Mail Id - ${email}.\nYour Message is - ${message}`
    );

    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="contactSection">
      <h2>Contact Us</h2>

      {/* MAP */}
      <div className="contactMap">
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
            <h3>Store in London</h3>
            <p>
              1418 River Drive, Suite 35 Cottonhall, CA 9622
              <br /> United Kingdom
            </p>
            <p>
              admin@dummymail.com
              <br />
              +44 20 7123 4567
            </p>
          </div>

          <div className="address">
            <h3>Store in India</h3>
            <p>
              A-791, Bandra Reclamation Rd, Mumbai
              <br /> Maharashtra
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
          <h3>Get In Touch</h3>

          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={name}
              placeholder="Name *"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setName(e.target.value)
              }
              required
            />

            <input
              type="email"
              value={email}
              placeholder="Email address *"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
            />

            <textarea
              rows={10}
              placeholder="Your Message"
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setMessage(e.target.value)
              }
            />

            <button type="submit">Submit</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;