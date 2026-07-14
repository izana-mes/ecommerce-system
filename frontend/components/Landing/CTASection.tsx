"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const LOGOS = ["Vercel", "Linear", "Stripe", "Notion", "Figma", "Loom"];

export default function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);

  return (
    <section id="cta" ref={ref} className="relative py-40 overflow-hidden bg-slate-950/20">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 pointer-events-none"
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.6) 0%, rgba(139,92,246,0.3) 40%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </motion.div>

      <div className="absolute inset-0 opacity-30 pointer-events-none"
           style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-indigo-500/10"
            style={{
              width: `${i * 300}px`,
              height: `${i * 300}px`,
              top: `${-i * 150}px`,
              left: `${-i * 150}px`,
            }}
            animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}
          />
        ))}
      </div>

      <motion.div style={{ scale }} className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10 mb-24"
        >
          <span className="text-xs text-slate-600 uppercase tracking-widest font-mono">Trusted by teams at</span>
          {LOGOS.map((logo, i) => (
            <motion.span
              key={logo}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="text-slate-500 font-semibold text-sm hover:text-slate-300 transition-colors cursor-default font-mono"
            >
              {logo}
            </motion.span>
          ))}
        </motion.div>

        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-block text-xs font-semibold text-indigo-400 tracking-[0.3em] uppercase mb-6">
              Start your journey
            </span>

            <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none mb-8 font-mono">
              <span className="text-white">Ready to</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 bg-clip-text text-transparent">transcend?</span>
            </h2>

            <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed mb-12">
              Join thousands of visionaries who have already stepped into the future. Your transformation begins with a single click.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <motion.button
              id="cta-primary-btn"
              whileHover={{ scale: 1.06, boxShadow: "0 0 60px rgba(99,102,241,0.6)" }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-full font-bold text-white text-base relative overflow-hidden group cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
                backgroundSize: "200% 200%",
                boxShadow: "0 0 30px rgba(99,102,241,0.4)",
              }}
            >
              <motion.span
                className="absolute inset-0"
                animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ duration: 4, repeat: Infinity }}
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
                  backgroundSize: "200% 200%",
                }}
              />
              <span className="relative z-10">Get Early Access — Free</span>
            </motion.button>

            <motion.button
              id="cta-secondary-btn"
              whileHover={{ scale: 1.04, borderColor: "rgba(99,102,241,0.5)" }}
              whileTap={{ scale: 0.97 }}
              className="px-10 py-4 rounded-full font-semibold text-slate-300 hover:text-white transition-all duration-300 bg-white/5 border border-white/10 cursor-pointer"
            >
              Talk to Sales
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-slate-500"
          >
            <div className="flex -space-x-2">
              {["#6366f1", "#8b5cf6", "#06b6d4", "#ec4899", "#f59e0b"].map((color, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: color, zIndex: 5 - i }}
                >
                  {["A", "B", "C", "D", "E"][i]}
                </div>
              ))}
            </div>
            <span>Join <strong className="text-slate-300 font-mono">50,000+</strong> creators already building</span>
            <span className="hidden sm:block text-slate-700">•</span>
            <span className="flex items-center gap-1">
              {"★★★★★".split("").map((s, i) => (
                <span key={i} className="text-amber-400">{s}</span>
              ))}
              <span className="ml-1 font-mono">4.9 / 5.0</span>
            </span>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.3 }}
        className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-8 text-xs text-slate-700 font-mono"
      >
        <span className="font-semibold text-slate-600">
          © 2025 Nexus
        </span>
        {["Privacy", "Terms", "Security"].map((l) => (
          <a key={l} href="#" className="hover:text-slate-500 transition-colors">
            {l}
          </a>
        ))}
      </motion.div>
    </section>
  );
}
