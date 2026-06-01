"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: "AI-Powered Core",
    description: "Intelligent systems that learn and adapt in real-time, delivering personalised experiences at every interaction.",
    gradient: "from-indigo-500 to-purple-500",
    glow: "rgba(99,102,241,0.25)",
    delay: 0,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Lightning Performance",
    description: "Sub-millisecond response times with global edge deployment. Speed is not a feature — it's the foundation.",
    gradient: "from-cyan-500 to-blue-500",
    glow: "rgba(6,182,212,0.25)",
    delay: 0.1,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Zero-Trust Security",
    description: "Military-grade encryption with quantum-resistant protocols. Your data is protected at every layer.",
    gradient: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.25)",
    delay: 0.2,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: "Deep Analytics",
    description: "Real-time insights with predictive modelling. Understand trends before they happen and act decisively.",
    gradient: "from-blue-500 to-indigo-500",
    glow: "rgba(59,130,246,0.25)",
    delay: 0.3,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Modular Architecture",
    description: "Composable, extensible building blocks. Scale from prototype to enterprise without rewriting a line.",
    gradient: "from-purple-500 to-pink-500",
    glow: "rgba(168,85,247,0.25)",
    delay: 0.4,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Global Edge Network",
    description: "300+ PoPs worldwide with intelligent routing. Delivering your experience at the speed of light.",
    gradient: "from-teal-500 to-cyan-500",
    glow: "rgba(20,184,166,0.25)",
    delay: 0.5,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export default function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" className="relative py-32 overflow-hidden bg-slate-950/20">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(99,102,241,0.08) 0%, transparent 70%)",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <span className="inline-block text-xs font-semibold text-indigo-400 tracking-[0.3em] uppercase mb-4">
            Why Nexus
          </span>
          <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-5 font-mono">
            Built different.{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-indigo-400 to-purple-400 bg-clip-text text-transparent">By design.</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
            Every feature is a statement of intent. We don't add features — we craft experiences.
          </p>
        </motion.div>

        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={cardVariants}
              whileHover={{
                y: -8,
                scale: 1.02,
                boxShadow: `0 20px 60px ${f.glow}`,
              }}
              className="group relative p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md cursor-pointer overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${f.glow} 0%, transparent 70%)`,
                }}
              />

              <div
                className={`relative w-12 h-12 rounded-xl mb-5 flex items-center justify-center bg-gradient-to-br ${f.gradient}`}
                style={{ boxShadow: `0 8px 20px ${f.glow}` }}
              >
                <span className="text-white">{f.icon}</span>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 relative z-10 font-mono">
                {f.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed relative z-10">
                {f.description}
              </p>

              <motion.div
                initial={{ opacity: 0, x: -10 }}
                whileHover={{ opacity: 1, x: 0 }}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-indigo-400"
              >
                Learn more
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
