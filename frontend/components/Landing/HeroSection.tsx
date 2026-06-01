"use client";

import { useRef, Suspense, lazy } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

const Scene3D = lazy(() => import("./Scene3D"));

const BADGE_TEXT = "Introducing Nexus 3.0";

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useRef(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 60, damping: 20 });

  const canvasY = useTransform(smoothProgress, [0, 1], ["0%", "30%"]);
  const canvasOpacity = useTransform(smoothProgress, [0, 0.7], [1, 0]);
  const textY = useTransform(smoothProgress, [0, 1], ["0%", "-20%"]);
  const textOpacity = useTransform(smoothProgress, [0, 0.5], [1, 0]);
  const scaleDown = useTransform(smoothProgress, [0, 0.6], [1, 0.88]);

  smoothProgress.on("change", (v) => {
    scrollProgress.current = v;
  });

  return (
    <section
      ref={containerRef}
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950/40"
      style={{ paddingTop: "80px" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 40%, transparent 70%)",
        }}
      />

      <motion.div
        className="absolute inset-0 z-10"
        style={{ y: canvasY, opacity: canvasOpacity, scale: scaleDown }}
      >
        <Suspense fallback={null}>
          <Scene3D scrollProgress={scrollProgress} />
        </Suspense>
      </motion.div>

      <motion.div
        className="relative z-20 text-center max-w-7xl mx-auto px-6"
        style={{ y: textY, opacity: textOpacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 bg-white/5 border border-indigo-500/30 backdrop-blur-md text-xs font-semibold text-indigo-300 tracking-widest uppercase"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          {BADGE_TEXT}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter leading-none mb-6 text-white font-mono"
        >
          <span className="block">Think</span>
          <span className="block bg-gradient-to-r from-indigo-200 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Beyond</span>
          <span className="block opacity-35 text-slate-300">Limits</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto leading-relaxed mb-10"
        >
          A new dimension of digital experience. Crafted with precision,
          powered by imagination, designed for the future.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.72 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.a
            href="#features"
            whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(99,102,241,0.5)" }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-3.5 rounded-full font-semibold text-white relative overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: "0 0 25px rgba(99,102,241,0.35)",
            }}
          >
            <span className="relative z-10">Explore Now</span>
            <span className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
          </motion.a>

          <motion.a
            href="#showcase"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-3.5 rounded-full font-semibold text-slate-300 bg-white/5 border border-white/10 hover:text-white transition-colors duration-300 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
            </svg>
            Watch Demo
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20 flex justify-center items-center gap-10 md:gap-16"
        >
          {[
            { value: "50K+", label: "Users" },
            { value: "99.9%", label: "Uptime" },
            { value: "4.9★", label: "Rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent font-mono">
                {stat.value}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-widest font-mono">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      >
        <span className="text-[10px] text-slate-600 tracking-widest uppercase font-mono">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-px h-8 bg-gradient-to-b from-indigo-500 to-transparent"
        />
      </motion.div>
    </section>
  );
}
