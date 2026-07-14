"use client";

import { useEffect, useState } from "react";
import { motion, useScroll } from "framer-motion";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "About", href: "#cta" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useEffect(() => {
    const unsub = scrollY.on("change", (v) => setScrolled(v > 40));
    return unsub;
  }, [scrollY]);

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-3 bg-slate-950/80 border-b border-white/5 backdrop-blur-md"
          : "py-5 bg-transparent border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <motion.a
          href="#"
          className="flex items-center gap-2 group"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 opacity-90 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 blur-md opacity-50 group-hover:opacity-80 transition-opacity scale-125" />
            <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">N</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white font-mono">
            Nexus
          </span>
        </motion.a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <motion.a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors duration-200 relative group"
              whileHover={{ y: -1 }}
            >
              {link.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-indigo-400 to-purple-400 group-hover:w-full transition-all duration-300" />
            </motion.a>
          ))}
        </div>

        <motion.a
          href="#cta"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative px-5 py-2 rounded-full text-sm font-semibold text-white overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))",
            boxShadow: "0 0 20px rgba(99,102,241,0.4)",
          }}
        >
          <span className="relative z-10">Get Started</span>
          <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
        </motion.a>
      </div>
    </motion.nav>
  );
}
