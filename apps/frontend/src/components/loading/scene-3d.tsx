"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Group } from "three";

const Scene3D: React.FC = () => {
  const groupRef = useRef<Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.pointer.x * 0.05;
      groupRef.current.rotation.x = -state.pointer.y * 0.05;
      groupRef.current.rotation.z += delta * 0.02;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <Sparkles count={30} scale={10} size={1} speed={0.1} color="#D7BF75" />
    </group>
  );
};

export default Scene3D;
