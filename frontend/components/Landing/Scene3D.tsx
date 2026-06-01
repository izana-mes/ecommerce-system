"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";

function OrbMesh({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  useFrame((state, delta) => {
    time.current += delta;
    const scroll = scrollProgress.current;

    if (meshRef.current) {
      meshRef.current.rotation.x = time.current * 0.12;
      meshRef.current.rotation.y = time.current * 0.18;
      meshRef.current.rotation.z = scroll * Math.PI * 0.5;
      meshRef.current.scale.setScalar(1 + scroll * 0.3);
      meshRef.current.position.y = Math.sin(time.current * 0.6) * 0.12;
    }

    if (ringRef.current) {
      ringRef.current.rotation.x = time.current * 0.2 + scroll * 1.5;
      ringRef.current.rotation.y = time.current * 0.1;
      ringRef.current.rotation.z = time.current * 0.15;
    }

    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -time.current * 0.15;
      ring2Ref.current.rotation.y = time.current * 0.25 + scroll;
      ring2Ref.current.rotation.z = -time.current * 0.1;
    }
  });

  return (
    <group>
      <Sphere ref={meshRef} args={[1, 128, 128]}>
        <MeshDistortMaterial
          color="#3b3fdb"
          attach="material"
          distort={0.35}
          speed={1.5}
          roughness={0.1}
          metalness={0.9}
          envMapIntensity={1.5}
        />
      </Sphere>

      <Sphere args={[1.15, 32, 32]}>
        <meshStandardMaterial
          color="#6366f1"
          transparent
          opacity={0.05}
          roughness={1}
        />
      </Sphere>

      <mesh ref={ringRef}>
        <torusGeometry args={[1.6, 0.02, 16, 100]} />
        <meshStandardMaterial
          color="#818cf8"
          emissive="#6366f1"
          emissiveIntensity={1.5}
          metalness={1}
          roughness={0}
        />
      </mesh>

      <mesh ref={ring2Ref}>
        <torusGeometry args={[2.0, 0.012, 16, 100]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#0891b2"
          emissiveIntensity={2}
          metalness={1}
          roughness={0}
        />
      </mesh>

      <pointLight color="#6366f1" intensity={3} distance={5} />
      <pointLight color="#06b6d4" intensity={2} distance={8} position={[3, 2, 0]} />
      <pointLight color="#8b5cf6" intensity={2} distance={6} position={[-3, -2, 2]} />
    </group>
  );
}

function SceneContent({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={0.5} />
      <Environment preset="city" />
      <OrbMesh scrollProgress={scrollProgress} />
    </>
  );
}

export default function Scene3D({ scrollProgress }: { scrollProgress: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <SceneContent scrollProgress={scrollProgress} />
      </Suspense>
    </Canvas>
  );
}
