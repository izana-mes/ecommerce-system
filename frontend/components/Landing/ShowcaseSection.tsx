"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const showcaseItems = [
  {
    id: 1,
    label: "Interface Design",
    title: "Craft beauty in every pixel",
    description:
      "Our design system harmonises aesthetics and function. Every interface emerges from the intersection of art and engineering.",
    accent: "#6366f1",
    accentRgb: "99,102,241",
    number: "01",
  },
  {
    id: 2,
    label: "Performance",
    title: "Speed redefined at the core",
    description:
      "Architectured for the extreme. Nexus achieves what others consider theoretical — true real-time performance without compromise.",
    accent: "#06b6d4",
    accentRgb: "6,182,212",
    number: "02",
  },
  {
    id: 3,
    label: "Collaboration",
    title: "Teams that move as one",
    description:
      "Multiplayer-first design. Everyone sees the same world, simultaneously. Work converges, not diverges.",
    accent: "#8b5cf6",
    accentRgb: "139,92,246",
    number: "03",
  },
];

function ShowcaseCard({
  item,
  index,
}: {
  item: (typeof showcaseItems)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.92, 1, 1, 0.92]);

  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={ref}
      style={{ opacity, scale }}
      className={`flex flex-col ${isEven ? "md:flex-row" : "md:flex-row-reverse"} items-center gap-12 md:gap-20 py-16`}
    >
      <motion.div style={{ y }} className="flex-1 w-full">
        <div
          className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950/60 border"
          style={{
            borderColor: `rgba(${item.accentRgb},0.2)`,
            boxShadow: `0 0 60px rgba(${item.accentRgb},0.12), 0 0 120px rgba(${item.accentRgb},0.05)`,
          }}
        >
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `radial-gradient(circle at 50% 50%, rgba(${item.accentRgb},0.08) 0%, transparent 70%)`,
            }}
          />

          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="w-full max-w-sm space-y-3">
              {[80, 60, 90, 45, 70].map((width, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  className="h-2 rounded-full origin-left"
                  style={{
                    width: `${width}%`,
                    background:
                      i === 0
                        ? `linear-gradient(90deg, ${item.accent}, transparent)`
                        : `rgba(255,255,255,${0.04 + i * 0.02})`,
                  }}
                />
              ))}
              <div className="flex items-end gap-1.5 pt-4 h-16">
                {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                    className="flex-1 rounded-t-sm origin-bottom"
                    style={{
                      height: `${h}%`,
                      background:
                        i === 9
                          ? `linear-gradient(to top, ${item.accent}, rgba(${item.accentRgb},0.3))`
                          : `rgba(${item.accentRgb},${0.15 + i * 0.02})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            className="absolute top-4 right-6 text-7xl font-black opacity-[0.04] font-mono"
            style={{ color: item.accent }}
          >
            {item.number}
          </div>

          <div
            className="absolute top-0 left-0 w-24 h-1"
            style={{ background: `linear-gradient(90deg, ${item.accent}, transparent)` }}
          />
        </div>
      </motion.div>

      <div className="flex-1 w-full">
        <motion.span
          initial={{ opacity: 0, x: isEven ? -20 : 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-block text-xs font-semibold tracking-[0.3em] uppercase mb-4"
          style={{ color: item.accent }}
        >
          {item.label}
        </motion.span>

        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl md:text-5xl font-black tracking-tight text-white mb-5 leading-tight font-mono"
        >
          {item.title}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-slate-400 text-lg leading-relaxed mb-8"
        >
          {item.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex items-center gap-3"
        >
          <div
            className="h-px flex-1 max-w-[60px]"
            style={{ background: `linear-gradient(90deg, ${item.accent}, transparent)` }}
          />
          <span
            className="text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5"
            style={{ color: item.accent }}
          >
            Discover more
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="relative py-24 overflow-hidden bg-slate-950/40">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 70%)",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8 }}
          className="text-center mb-8"
        >
          <span className="inline-block text-xs font-semibold text-purple-400 tracking-[0.3em] uppercase mb-4">
            Showcase
          </span>
          <h2 className="text-5xl md:text-6xl font-black tracking-tighter text-white font-mono">
            See it in{" "}
            <span className="bg-gradient-to-r from-purple-300 via-purple-400 to-indigo-400 bg-clip-text text-transparent">motion</span>
          </h2>
        </motion.div>

        <div className="divide-y divide-white/5">
          {showcaseItems.map((item, i) => (
            <ShowcaseCard key={item.id} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
