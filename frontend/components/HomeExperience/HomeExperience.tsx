"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, MeshDistortMaterial, Sparkles, Stars, useGLTF } from "@react-three/drei";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ChevronRight,
  Layers3,
  Orbit,
  ShieldCheck,
  Sparkles as SparklesIcon,
  Zap,
} from "lucide-react";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Layers3,
    title: "Adaptive product canvas",
    copy: "Create merchandising scenes that shift tone, depth, and hierarchy as the shopper moves.",
    accent: "cyan",
  },
  {
    icon: Orbit,
    title: "Spatial shopping flow",
    copy: "Camera-led transitions make each collection feel like a guided premium presentation.",
    accent: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise-grade commerce",
    copy: "Polished storefront motion paired with reliable dashboards, orders, and operational tooling.",
    accent: "mint",
  },
  {
    icon: Zap,
    title: "Realtime momentum",
    copy: "Fast reveal systems, glow states, and responsive interactions keep every screen feeling alive.",
    accent: "gold",
  },
];

const stats = [
  { value: 98, suffix: "%", label: "engagement lift" },
  { value: 42, suffix: "k", label: "monthly product views" },
  { value: 12, suffix: "ms", label: "interaction latency" },
  { value: 4.9, suffix: "/5", label: "buyer experience" },
];

const testimonials = [
  {
    quote: "The homepage feels like a product launch deck that shoppers can actually touch.",
    name: "Mina Takeda",
    role: "Growth Lead, Aurora Retail",
  },
  {
    quote: "Every scroll beat feels intentional. It turns browsing into a premium brand moment.",
    name: "Daniel Cruz",
    role: "Founder, Northstar Goods",
  },
  {
    quote: "Our catalog finally has the cinematic energy we wanted without losing clarity.",
    name: "Anika Rao",
    role: "Creative Director, Luma Market",
  },
  {
    quote: "The motion system makes the store feel expensive, fast, and memorable.",
    name: "Theo Nguyen",
    role: "Product Manager, Vanta Supply",
  },
];

function ProductModel() {
  const groupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);
  const gltf = useGLTF("/shirt_baked_2.glb");
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useFrame(({ pointer, clock }, delta) => {
    const time = clock.getElapsedTime();

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.28;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, pointer.y * 0.22, 0.05);
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, pointer.x * 0.35, 0.04);
      groupRef.current.position.y = Math.sin(time * 0.8) * 0.08;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.x = time * 0.35;
      outerRingRef.current.rotation.z = time * 0.18;
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.y = -time * 0.42;
      innerRingRef.current.rotation.z = time * 0.22;
    }
  });

  return (
    <group>
      <Float speed={1.35} rotationIntensity={0.28} floatIntensity={0.35}>
        <group ref={groupRef} scale={2.05} position={[0, -0.32, 0]}>
          <primitive object={scene} />
        </group>
      </Float>

      <mesh position={[0, 0, -0.34]} rotation={[0.45, 0.3, 0]}>
        <icosahedronGeometry args={[1.18, 3]} />
        <MeshDistortMaterial
          color="#c9f8ff"
          emissive="#44e8ff"
          emissiveIntensity={0.8}
          distort={0.22}
          speed={1.2}
          transparent
          opacity={0.36}
          roughness={0.08}
          metalness={0.82}
        />
      </mesh>

      <mesh ref={outerRingRef} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[2.25, 0.018, 24, 160]} />
        <meshStandardMaterial color="#39f5ff" emissive="#17d9ff" emissiveIntensity={2.2} metalness={0.8} roughness={0.12} />
      </mesh>

      <mesh ref={innerRingRef} rotation={[0.6, 0.2, 0.1]}>
        <torusGeometry args={[1.55, 0.012, 24, 160]} />
        <meshStandardMaterial color="#c7a8ff" emissive="#8b5cf6" emissiveIntensity={2.4} metalness={0.9} roughness={0.08} />
      </mesh>

      <mesh position={[0, -1.12, -0.18]} scale={[1.7, 0.14, 1.7]}>
        <sphereGeometry args={[1, 48, 48]} />
        <MeshDistortMaterial color="#132032" distort={0.35} speed={2} transparent opacity={0.38} roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
}

function ShowcaseCore() {
  const rigRef = useRef<THREE.Group>(null);
  const panels = useMemo(() => new Array(9).fill(null), []);

  useFrame(({ clock, pointer }) => {
    const time = clock.getElapsedTime();

    if (rigRef.current) {
      rigRef.current.rotation.y = time * 0.16 + pointer.x * 0.18;
      rigRef.current.rotation.x = pointer.y * 0.12;
    }
  });

  return (
    <group ref={rigRef}>
      {panels.map((_, index) => {
        const angle = (index / panels.length) * Math.PI * 2;
        const radius = 2.25 + (index % 2) * 0.34;
        return (
          <Float key={index} speed={1 + index * 0.08} floatIntensity={0.22} rotationIntensity={0.18}>
            <mesh position={[Math.cos(angle) * radius, Math.sin(index) * 0.36, Math.sin(angle) * radius]} rotation={[0.18, -angle, 0]}>
              <boxGeometry args={[0.68, 0.88, 0.06]} />
              <meshStandardMaterial
                color={index % 3 === 0 ? "#35ecff" : index % 3 === 1 ? "#9a7cff" : "#9fffd8"}
                emissive={index % 3 === 0 ? "#0ca7d7" : index % 3 === 1 ? "#6338ff" : "#18b981"}
                emissiveIntensity={0.9}
                metalness={0.72}
                roughness={0.16}
              />
            </mesh>
          </Float>
        );
      })}

      <mesh>
        <icosahedronGeometry args={[0.96, 2]} />
        <MeshDistortMaterial color="#e9f3ff" distort={0.18} speed={1.4} roughness={0.08} metalness={0.86} envMapIntensity={1.8} />
      </mesh>
    </group>
  );
}

function ImmersiveCanvas({ variant = "hero" }: { variant?: "hero" | "showcase" }) {
  return (
    <Canvas
      camera={{ position: [0, 0, variant === "hero" ? 5.7 : 5.1], fov: variant === "hero" ? 42 : 48 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 3, 5]} intensity={1.3} color="#eef6ff" />
        <pointLight position={[-3, 1.8, 3]} intensity={18} color="#5ee7ff" distance={8} />
        <pointLight position={[3, -2, 2]} intensity={12} color="#8b5cf6" distance={7} />
        {variant === "hero" ? <ProductModel /> : <ShowcaseCore />}
        <Sparkles count={80} scale={6} size={1.6} speed={0.45} color="#91f6ff" />
        <Stars radius={60} depth={30} count={800} factor={3} saturation={0} fade speed={0.4} />
        <Environment preset="city" />
      </Suspense>
    </Canvas>
  );
}

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView || !ref.current) {
      return;
    }

    const target = { count: 0 };
    const tween = gsap.to(target, {
      count: value,
      duration: 1.8,
      ease: "power3.out",
      onUpdate: () => {
        if (!ref.current) {
          return;
        }

        ref.current.textContent = `${value % 1 === 0 ? Math.round(target.count) : target.count.toFixed(1)}${suffix}`;
      },
    });

    return () => {
      tween.kill();
    };
  }, [inView, suffix, value]);

  return <span ref={ref}>0{suffix}</span>;
}

function RevealSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      className={`home-xp-section ${className}`}
      initial={{ opacity: 0, filter: "blur(18px)", scale: 0.96 }}
      whileInView={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      viewport={{ amount: 0.42, once: false }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

export default function HomeExperience() {
  const rootRef = useRef<HTMLDivElement>(null);
  const testimonialTrackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, -160]);
  const heroScale = useTransform(scrollYProgress, [0, 0.22], [1, 0.88]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, -420]);

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        ".home-xp-card",
        { y: 70, opacity: 0, rotateX: 10 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ".home-xp-features",
            start: "top 70%",
          },
        }
      );

      gsap.to(".home-xp-showcase-camera", {
        y: -90,
        rotateX: 4,
        ease: "none",
        scrollTrigger: {
          trigger: ".home-xp-showcase",
          scrub: 1.1,
          start: "top bottom",
          end: "bottom top",
        },
      });

      if (testimonialTrackRef.current) {
        const distance = testimonialTrackRef.current.scrollWidth - window.innerWidth + 64;
        gsap.to(testimonialTrackRef.current, {
          x: () => -Math.max(distance, 0),
          ease: "none",
          scrollTrigger: {
            trigger: ".home-xp-testimonials",
            pin: true,
            scrub: 1,
            start: "top top",
            end: () => `+=${Math.max(distance, 900)}`,
            invalidateOnRefresh: true,
          },
        });
      }
    }, rootRef);

    return () => context.revert();
  }, []);

  return (
    <div ref={rootRef} className="home-xp-root">
      <motion.div className="home-xp-aurora home-xp-aurora-one" style={{ y: glowY }} />
      <motion.div className="home-xp-aurora home-xp-aurora-two" style={{ y: heroY }} />

      <section className="home-xp-hero">
        <div className="home-xp-particles" aria-hidden="true">
          {Array.from({ length: 34 }).map((_, index) => (
            <span key={index} style={{ "--i": index } as React.CSSProperties} />
          ))}
        </div>

        <motion.div className="home-xp-hero-copy" style={{ y: heroY, scale: heroScale }}>
          <motion.p className="home-xp-kicker" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            Spatial commerce OS
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 32, filter: "blur(16px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            The future of ecommerce feels cinematic.
          </motion.h1>
          <motion.p
            className="home-xp-subtitle"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.28 }}
          >
            A premium storefront experience with immersive 3D, presentation-like scroll transitions, luminous dashboards, and motion that makes every product feel considered.
          </motion.p>

          <motion.div className="home-xp-actions" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.45 }}>
            <Link href="/" className="home-xp-button home-xp-button-primary">
              Go to home page <ArrowRight size={18} />
            </Link>
            <a href="/dashboard" className="home-xp-button home-xp-button-ghost">
              View dashboard <ChevronRight size={18} />
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="home-xp-hero-stage"
          initial={{ opacity: 0, scale: 0.82 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <ImmersiveCanvas />
        </motion.div>

        <motion.div
          className="home-xp-hologram-object"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.76, rotateX: 18 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 1.1, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="home-xp-hologram-ring home-xp-hologram-ring-one" />
          <span className="home-xp-hologram-ring home-xp-hologram-ring-two" />
          <span className="home-xp-hologram-ring home-xp-hologram-ring-three" />
          <span className="home-xp-hologram-core">
            <i />
            <i />
            <i />
          </span>
        </motion.div>

        <div className="home-xp-scroll-cue">
          <span />
          <p>Scroll the presentation</p>
        </div>
      </section>

      <RevealSection className="home-xp-features">
        <div className="home-xp-section-heading">
          <p>Motion-led storefronts</p>
          <h2>Every section behaves like a guided product keynote.</h2>
        </div>

        <div className="home-xp-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={`home-xp-card home-xp-card-${feature.accent}`}>
                <div className="home-xp-card-icon">
                  <Icon size={24} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            );
          })}
        </div>
      </RevealSection>

      <RevealSection className="home-xp-showcase">
        <div className="home-xp-showcase-copy">
          <p>Interactive 3D showcase</p>
          <h2>Depth, light, and scroll-synced camera movement create the illusion of a live studio.</h2>
          <div className="home-xp-checks">
            {["Dynamic lights", "Soft shadows", "Pointer response", "Scrubbed motion"].map((item) => (
              <span key={item}>
                <Check size={16} /> {item}
              </span>
            ))}
          </div>
        </div>
        <div className="home-xp-showcase-camera">
          <ImmersiveCanvas variant="showcase" />
        </div>
      </RevealSection>

      <RevealSection className="home-xp-stats">
        <div className="home-xp-dashboard-shell">
          <div className="home-xp-dashboard-top">
            <span><BarChart3 size={18} /> Live storefront telemetry</span>
            <span className="home-xp-live-dot">Active</span>
          </div>
          <div className="home-xp-stats-grid">
            {stats.map((stat) => (
              <article key={stat.label} className="home-xp-stat">
                <strong><Counter value={stat.value} suffix={stat.suffix} /></strong>
                <span>{stat.label}</span>
              </article>
            ))}
          </div>
          <div className="home-xp-dashboard-map">
            {Array.from({ length: 28 }).map((_, index) => (
              <span key={index} style={{ "--i": index } as React.CSSProperties} />
            ))}
          </div>
        </div>
      </RevealSection>

      <section className="home-xp-section home-xp-testimonials">
        <div className="home-xp-section-heading home-xp-testimonial-heading">
          <p>Customer signal</p>
          <h2>A horizontal story rail built for momentum.</h2>
        </div>
        <div ref={testimonialTrackRef} className="home-xp-testimonial-track">
          {testimonials.map((testimonial, index) => (
            <article key={testimonial.name} className="home-xp-testimonial-card">
              <SparklesIcon size={22} />
              <p>&quot;{testimonial.quote}&quot;</p>
              <div>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </div>
              <small>{String(index + 1).padStart(2, "0")}</small>
            </article>
          ))}
        </div>
      </section>

      <RevealSection className="home-xp-final">
        <div className="home-xp-final-orbit" aria-hidden="true">
          <Boxes size={38} />
        </div>
        <p>Ready for launch</p>
        <h2>Turn your storefront into the most memorable room on the internet.</h2>
        <Link href="/" className="home-xp-button home-xp-button-primary">
          Visit the home page <ArrowRight size={18} />
        </Link>
      </RevealSection>
    </div>
  );
}

useGLTF.preload("/shirt_baked_2.glb");
