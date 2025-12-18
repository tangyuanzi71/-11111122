import React, { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { FloatingLetterData } from '../types';

// Explicitly declare R3F intrinsic elements to fix TypeScript errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any;
      ambientLight: any;
      pointLight: any;
    }
  }
}

// Constants
const BEAD_COUNT = 12;
const BRACELET_RADIUS = 3.5;
const LETTERS_PER_BEAD = 24;
const BEAD_RADIUS = 0.6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Helper: Random float
const rnd = (min: number, max: number) => Math.random() * (max - min) + min;

// Helper: Get point on sphere
const getPointOnSphere = (r: number) => {
  const theta = rnd(0, Math.PI * 2);
  const phi = rnd(0, Math.PI);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
};

interface BeadProps {
  position: [number, number, number];
  rotationVal: number;
  isScattered: boolean;
  scatterIntensity: number;
  onEmitLetter: (pos: THREE.Vector3) => void;
  index: number;
  globalRotation: number;
}

const Bead: React.FC<BeadProps> = ({ position, rotationVal, isScattered, scatterIntensity, onEmitLetter, index, globalRotation }) => {
  const groupRef = useRef<THREE.Group>(null);
  const lettersRef = useRef<THREE.Group>(null);
  
  // Memoize letter positions for this bead (Sphere shape)
  const letterConfigs = useMemo(() => {
    return new Array(LETTERS_PER_BEAD).fill(0).map(() => {
      const pos = getPointOnSphere(BEAD_RADIUS);
      return {
        char: ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
        pos: pos,
        rot: new THREE.Euler(rnd(0, Math.PI), rnd(0, Math.PI), rnd(0, Math.PI))
      };
    });
  }, []);

  // Check if we should emit a letter (visual effect of "pan")
  // We use a ref to track the last emission to avoid spamming
  const lastEmitRef = useRef(0);
  
  useFrame((state) => {
    if (!groupRef.current || !lettersRef.current) return;

    // 1. Handle Scattering (Explosion vs Reform)
    // If scattered, letters move away from the bead center
    // If reforming, they lerp back to their sphere position
    lettersRef.current.children.forEach((child, i) => {
      const config = letterConfigs[i];
      const targetPos = config.pos;
      
      if (isScattered) {
        // Explode outwards based on normal vector from center
        const dir = new THREE.Vector3().copy(targetPos).normalize();
        const scatterDist = 5 + Math.sin(state.clock.elapsedTime * 2 + i) * 2; // Breathing scatter
        
        child.position.lerp(
          new THREE.Vector3(
            targetPos.x + dir.x * scatterDist * scatterIntensity,
            targetPos.y + dir.y * scatterDist * scatterIntensity,
            targetPos.z + dir.z * scatterDist * scatterIntensity
          ),
          0.1
        );
        
        // Random rotation when scattered
        child.rotation.x += 0.01;
        child.rotation.y += 0.01;

      } else {
        // Return to sphere shell
        child.position.lerp(targetPos, 0.15);
        // Return to initial rotation (optional, or just stable)
        child.rotation.x = THREE.MathUtils.lerp(child.rotation.x, config.rot.x, 0.1);
        child.rotation.y = THREE.MathUtils.lerp(child.rotation.y, config.rot.y, 0.1);
      }
    });

    // 2. Handle Bead Rotation (The "Pan" / Rubbing effect)
    // The bead itself rotates around its local axis
    groupRef.current.rotation.x += rotationVal * 0.1;
    groupRef.current.rotation.y += rotationVal * 0.05;

    // 3. Emit Letter Logic
    // If rotation speed is high enough, occasionally emit a letter
    if (rotationVal > 0.01 && !isScattered) {
      const now = state.clock.elapsedTime;
      // Emit roughly every time the bead turns a certain amount
      if (now - lastEmitRef.current > (1.0 / (rotationVal * 10 + 0.1))) {
          // Calculate world position for emission
          const worldPos = new THREE.Vector3();
          groupRef.current.getWorldPosition(worldPos);
          onEmitLetter(worldPos);
          lastEmitRef.current = now;
      }
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <group ref={lettersRef}>
        {letterConfigs.map((config, i) => (
          <Text
            key={i}
            position={config.pos}
            rotation={config.rot}
            fontSize={0.25}
            color={isScattered ? "#888888" : "white"}
            anchorX="center"
            anchorY="middle"
          >
            {config.char}
          </Text>
        ))}
      </group>
    </group>
  );
};

interface BraceletSceneProps {
  handDistance: number; // 0 to 1 (normalized approx)
  isHandPresent: boolean;
}

export const DigitalBracelet: React.FC<BraceletSceneProps> = ({ handDistance, isHandPresent }) => {
  const [beadsRotation, setBeadsRotation] = useState(0);
  const [backgroundLetters, setBackgroundLetters] = useState<FloatingLetterData[]>([]);
  const containerRef = useRef<THREE.Group>(null);
  
  // Logic constants
  const PINCH_THRESHOLD = 0.06; // Threshold for "closed" hand
  const SCATTER_THRESHOLD = 0.18; // Threshold for "open" hand
  
  // State for animation
  const isScatteredRef = useRef(false);
  const rotationSpeedRef = useRef(0);
  const targetRotationRef = useRef(0);
  
  // Initialize some background ambient letters
  useEffect(() => {
    const initialBg: FloatingLetterData[] = [];
    for (let i = 0; i < 50; i++) {
      initialBg.push({
        id: `init-${i}`,
        char: ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
        x: rnd(-10, 10),
        y: rnd(-10, 10),
        z: rnd(-15, -5), // Behind the bracelet
        speedX: rnd(-0.02, 0.02),
        speedY: rnd(-0.02, 0.02),
        speedZ: rnd(-0.01, 0.01),
        scale: rnd(0.5, 1.5)
      });
    }
    setBackgroundLetters(initialBg);
  }, []);

  const handleEmitLetter = (origin: THREE.Vector3) => {
    const newLetter: FloatingLetterData = {
      id: `emit-${Date.now()}-${Math.random()}`,
      char: ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
      x: origin.x + rnd(-0.2, 0.2),
      y: origin.y + rnd(-0.2, 0.2),
      z: origin.z,
      speedX: rnd(-0.05, 0.05),
      speedY: rnd(0.05, 0.15), // Float up
      speedZ: rnd(-0.05, 0.05),
      scale: 1.0
    };
    
    // Add new letter and limit total count to avoid perf issues
    setBackgroundLetters(prev => [...prev.slice(-80), newLetter]);
  };

  useFrame((state, delta) => {
    // --- Interaction Logic ---
    if (isHandPresent) {
      if (handDistance > SCATTER_THRESHOLD) {
        // Open hand -> Scatter
        isScatteredRef.current = true;
        rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, 0, 0.1);
      } else if (handDistance < PINCH_THRESHOLD) {
        // Closed hand (Pinch) -> Reform & Rotate (Simulate "Pan")
        isScatteredRef.current = false;
        // The tighter the pinch/closer, the faster we simulate the rotation (or fixed speed)
        rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, 2.0, 0.05);
      } else {
        // In between -> Just reform, slow down rotation
        isScatteredRef.current = false;
        rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, 0, 0.05);
      }
    } else {
      // Idle state
      isScatteredRef.current = false;
      rotationSpeedRef.current = THREE.MathUtils.lerp(rotationSpeedRef.current, 0.2, 0.05); // Idle spin
    }

    // Apply rotation to the whole bracelet ring
    if (containerRef.current) {
      containerRef.current.rotation.z += rotationSpeedRef.current * delta * 0.5;
    }

    // --- Background Letter Animation ---
    // We modify the state indirectly by updating refs or simpler: re-render is expensive for 100 items every frame if using state.
    // Optimization: We will just let React Three Fiber handle the rendering, but for position updates,
    // since we stored data in State, we might trigger re-renders. 
    // BETTER APPROACH: Use a ref for the group of BG letters and update positions directly.
    // However, for this implementation complexity, we will trust R3F's efficiency with modest counts or use a simpler Float wrapper.
    // Let's rely on <Float> for ambient, but for the "emitted" ones, we need them to move away.
    // We will update the `backgroundLetters` state only when adding/removing, but animate via a ref in a sub-component? 
    // No, let's keep it simple: Render loop updates positions.
  });

  // Calculate bead positions in a ring
  const beads = useMemo(() => {
    return new Array(BEAD_COUNT).fill(0).map((_, i) => {
      const angle = (i / BEAD_COUNT) * Math.PI * 2;
      const x = Math.cos(angle) * BRACELET_RADIUS;
      const y = Math.sin(angle) * BRACELET_RADIUS;
      return { pos: [x, y, 0] as [number, number, number], index: i };
    });
  }, []);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} color="#4444ff" intensity={0.5} />

      {/* The Bracelet Ring */}
      <group ref={containerRef}>
        {beads.map((bead) => (
          <Bead
            key={bead.index}
            index={bead.index}
            position={bead.pos}
            rotationVal={rotationSpeedRef.current}
            isScattered={isScatteredRef.current}
            scatterIntensity={isHandPresent ? handDistance * 5 : 0} // Map distance to intensity
            onEmitLetter={handleEmitLetter}
            globalRotation={0}
          />
        ))}
      </group>

      {/* Background / Floating Letters */}
      {backgroundLetters.map((letter) => (
        <FloatingLetter 
          key={letter.id} 
          data={letter} 
          globalRotationSpeed={rotationSpeedRef.current}
        />
      ))}
      
      {/* Deep Background Stars for aesthetic */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
    </>
  );
};

// Component for a single floating background letter
const FloatingLetter: React.FC<{ data: FloatingLetterData, globalRotationSpeed: number }> = ({ data, globalRotationSpeed }) => {
  const ref = useRef<THREE.Group>(null);
  const pos = useRef(new THREE.Vector3(data.x, data.y, data.z));
  
  useFrame((state, delta) => {
    if (!ref.current) return;
    
    // Move
    pos.current.x += data.speedX;
    pos.current.y += data.speedY;
    pos.current.z += data.speedZ;
    
    ref.current.position.copy(pos.current);
    
    // Rotate (ambient + influence from bracelet speed)
    ref.current.rotation.x += delta * 0.2;
    ref.current.rotation.y += delta * 0.2 + (globalRotationSpeed * 0.05); // "With the rotation of beads, suspended letters rotate slightly"
  });

  return (
    <group ref={ref} position={[data.x, data.y, data.z]}>
      <Text
        color="#555"
        fontSize={0.3 * data.scale}
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.6}
      >
        {data.char}
      </Text>
    </group>
  );
};