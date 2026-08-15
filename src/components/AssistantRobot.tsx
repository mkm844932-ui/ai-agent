import React, { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { speechService } from '../services/speechService';
import { AppPhase } from '../types';
import * as THREE from 'three';

interface AssistantRobotProps {
  phase: AppPhase;
}

// ─── GLTF Loaded Human Presenter ───
const HumanPresenterModel: React.FC<{ phase: AppPhase; volume: number }> = ({ phase, volume }) => {
  const group = useRef<THREE.Group>(null);
  
  const { scene, animations } = useGLTF('/assets/models/human-assistant.glb');
  const { actions } = useAnimations(animations, group);
  const currentAction = useRef<string>('');

  useEffect(() => {
    if (!actions) return;

    const available = Object.keys(actions);
    let nextAction = available[0] || '';

    if (phase === 'answering') {
      const agreeAction = available.find(a => a.toLowerCase().includes('agree') || a.toLowerCase().includes('talk') || a.toLowerCase().includes('wave'));
      if (agreeAction) nextAction = agreeAction;
    } else {
      const idleAction = available.find(a => a.toLowerCase().includes('idle')) || available[0];
      if (idleAction) nextAction = idleAction;
    }

    const prev = currentAction.current;
    if (prev !== nextAction && nextAction) {
      if (actions) {
        if (prev && actions[prev]) {
          actions[prev]!.fadeOut(0.3);
        }
        if (actions[nextAction]) {
          actions[nextAction]!.reset().fadeIn(0.3).play();
          currentAction.current = nextAction;
        }
      }
    }
  }, [phase, actions]);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    if (group.current) {
      const head = (group.current.getObjectByName('mixamorigHead') ||
                    group.current.getObjectByName('Head') ||
                    group.current.getObjectByName('head')) as THREE.Object3D | undefined;

      if (head) {
        if (phase === 'answering') {
          head.position.y = (Math.sin(elapsed * 12) * 0.03) * volume;
          head.rotation.x = (Math.cos(elapsed * 9) * 0.05) * volume;
        } else {
          head.position.y = 0;
          head.rotation.x = Math.sin(elapsed * 0.8) * 0.02;
        }
      }
    }
  });

  return (
    <group ref={group} dispose={null}>
      {/* Properly scaled and positioned human model (Xbot GLB is ~1.8m tall in unit scale) */}
      <primitive object={scene} scale={1.1} position={[0, -1.15, 0]} />
    </group>
  );
};

// ─── Procedural Futuristic Human Presenter Fallback (Zero delay load) ───
const ProceduralHumanModel: React.FC<{ phase: AppPhase; volume: number }> = ({ phase, volume }) => {
  const headRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    if (headRef.current) {
      if (phase === 'answering') {
        headRef.current.position.y = 1.05 + (Math.sin(elapsed * 12) * 0.03) * volume;
        headRef.current.rotation.x = (Math.cos(elapsed * 8) * 0.05) * volume;
      } else {
        headRef.current.position.y = 1.05 + Math.sin(elapsed * 1.5) * 0.02;
        headRef.current.rotation.y = Math.sin(elapsed * 0.8) * 0.08;
      }
    }

    if (leftArmRef.current && rightArmRef.current) {
      if (phase === 'answering') {
        leftArmRef.current.rotation.z = Math.PI / 6 + Math.sin(elapsed * 2.5) * 0.1;
        rightArmRef.current.rotation.z = -Math.PI / 6 - Math.cos(elapsed * 2.5) * 0.1;
      } else {
        leftArmRef.current.rotation.z = Math.PI / 7 + Math.sin(elapsed * 1.2) * 0.03;
        rightArmRef.current.rotation.z = -Math.PI / 7 - Math.cos(elapsed * 1.2) * 0.03;
      }
    }
  });

  const eyeColor = phase === 'listening' ? '#f43f5e' : phase === 'answering' ? '#10b981' : '#8b5cf6';

  return (
    <group position={[0, -0.6, 0]}>
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.8} />
        
        {/* Eyes */}
        <mesh position={[-0.12, 0.05, 0.34]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
        <mesh position={[0.12, 0.05, 0.34]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color={eyeColor} />
        </mesh>
      </mesh>

      {/* Humanoid Torso / Jacket */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.32, 0.26, 0.85, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Shoulders & Arms */}
      <mesh ref={leftArmRef} position={[-0.42, 0.6, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#334155" />
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.45, 16]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </mesh>

      <mesh ref={rightArmRef} position={[0.42, 0.6, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#334155" />
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.06, 0.05, 0.45, 16]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </mesh>
    </group>
  );
};

export const AssistantRobot: React.FC<AssistantRobotProps> = ({ phase }) => {
  const [audioVolume, setAudioVolume] = useState(0);

  useEffect(() => {
    speechService.setCallbacks({
      onAudioVolume: (vol) => {
        setAudioVolume(vol);
      }
    });
  }, []);

  return (
    <div className="w-full h-64 md:h-72 relative flex items-center justify-center bg-slate-950/20 rounded-2xl border border-slate-900/30 overflow-hidden shadow-inner">
      <Canvas camera={{ position: [0, 0.3, 2.5], fov: 42 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[5, 10, 3]} intensity={1.8} />
        <pointLight position={[-5, -2, -5]} intensity={0.5} color="#38bdf8" />

        <Suspense fallback={<ProceduralHumanModel phase={phase} volume={audioVolume} />}>
          <HumanPresenterModel phase={phase} volume={audioVolume} />
        </Suspense>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          target={[0, 0.1, 0]}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 3}
        />
      </Canvas>

      {/* Visual Status Indicator */}
      <div className="absolute bottom-2.5 px-3 py-0.5 rounded-full bg-slate-900/90 backdrop-blur border border-slate-800 text-[9px] uppercase font-bold tracking-wider text-slate-400 select-none pointer-events-none shadow-md">
        {phase === 'listening' && <span className="text-rose-500 animate-pulse">● Listening</span>}
        {phase === 'processing' && <span className="text-sky-400">⚙ Thinking</span>}
        {phase === 'idle' && <span>● Ready</span>}
        {phase === 'answering' && <span className="text-emerald-400 animate-pulse">🔊 Explaining</span>}
      </div>
    </div>
  );
};

useGLTF.preload('/assets/models/human-assistant.glb');
