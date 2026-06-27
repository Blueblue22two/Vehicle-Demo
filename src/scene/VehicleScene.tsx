import { Suspense, useCallback, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  MathUtils,
  Vector3,
} from 'three';
import { VehicleModel } from './VehicleModel';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneLoadingFallback } from './SceneLoadingFallback';
import { useDragDetector } from './useDragDetector';

const CANVAS_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const POLAR_MIN = (15 * Math.PI) / 180;
const POLAR_MAX = (75 * Math.PI) / 180;

/** Default camera position — left-front 45° view. */
const DEFAULT_CAMERA_POS = new Vector3(5, 2.5, 5);
const DEFAULT_TARGET = new Vector3(0, 0, 0);
const RESET_LERP_SPEED = 4; // higher = faster smooth reset

// ---------------------------------------------------------------------------
// Scene lights
// ---------------------------------------------------------------------------

function SceneLights() {
  return (
    <>
      {/* Cool ambient fill */}
      <ambientLight intensity={0.35} color="#8899cc" />
      {/* Key light — warm white from upper-right-front */}
      <directionalLight
        position={[8, 12, 6]}
        intensity={3.0}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
      />
      {/* Rim / backlight — cool blue from rear-left for edge definition */}
      <directionalLight
        position={[-6, 3, -4]}
        intensity={1.2}
        color="#6688cc"
      />
      {/* Subtle fill from below-front */}
      <directionalLight position={[2, 1, 8]} intensity={0.6} color="#aabbdd" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Scene ground
// ---------------------------------------------------------------------------

function SceneGround() {
  return (
    <>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.3} />
      </mesh>
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={8}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Camera controller with smooth reset animation
// ---------------------------------------------------------------------------

interface CameraControllerProps {
  /** Increment to trigger a reset animation. */
  resetTrigger: number;
  /** Called when the reset animation completes. */
  onResetComplete?: () => void;
}

function CameraController({
  resetTrigger,
  onResetComplete,
}: CameraControllerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- OrbitControls ref type from Drei is complex
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const animatingRef = useRef(false);
  const prevTriggerRef = useRef(resetTrigger);
  const startPosRef = useRef(new Vector3());
  const startTargetRef = useRef(new Vector3());
  const elapsedRef = useRef(0);

  // Save default state on first mount
  const defaultSavedRef = useRef(false);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Save default view state once after controls are initialised
    if (!defaultSavedRef.current && controls.target) {
      defaultSavedRef.current = true;
    }

    // Detect reset trigger
    if (resetTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = resetTrigger;
      animatingRef.current = true;
      elapsedRef.current = 0;
      startPosRef.current.copy(camera.position);
      startTargetRef.current.copy(controls.target);
      controls.enabled = false;
    }

    if (!animatingRef.current) return;

    elapsedRef.current += delta * RESET_LERP_SPEED;
    const t = MathUtils.clamp(elapsedRef.current, 0, 1);
    // ease-in-out cubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(startPosRef.current, DEFAULT_CAMERA_POS, eased);
    controls.target.lerpVectors(startTargetRef.current, DEFAULT_TARGET, eased);
    controls.update();

    if (t >= 1) {
      camera.position.copy(DEFAULT_CAMERA_POS);
      controls.target.copy(DEFAULT_TARGET);
      controls.update();
      controls.enabled = true;
      animatingRef.current = false;
      onResetComplete?.();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate
      enablePan={false}
      enableZoom
      minPolarAngle={POLAR_MIN}
      maxPolarAngle={POLAR_MAX}
      minDistance={3}
      maxDistance={12}
    />
  );
}

// ---------------------------------------------------------------------------
// Reset view button
// ---------------------------------------------------------------------------

function ResetViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="scene-reset-button"
      type="button"
      onClick={onClick}
      aria-label="重置视角"
      data-testid="reset-view-button"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
      <span>重置视角</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// VehicleScene (public)
// ---------------------------------------------------------------------------

export function VehicleScene() {
  const [retryKey, setRetryKey] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const handleResetView = useCallback(() => {
    setResetTrigger((prev) => prev + 1);
  }, []);

  const { isDragRef, onPointerDown, onPointerUp } = useDragDetector();

  return (
    <div
      className="scene-container"
      data-testid="scene-container"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <SceneErrorBoundary key={retryKey} onRetry={handleRetry}>
        <Suspense fallback={<SceneLoadingFallback />}>
          <Canvas
            style={CANVAS_STYLE}
            dpr={[1, 1.5]}
            gl={{
              antialias: true,
              toneMapping: ACESFilmicToneMapping,
              outputColorSpace: SRGBColorSpace,
            }}
            camera={{
              position: [5, 2.5, 5],
              fov: 40,
              near: 0.5,
              far: 50,
            }}
          >
            <SceneLights />
            <SceneGround />
            <VehicleModel isDragRef={isDragRef} />
            <CameraController resetTrigger={resetTrigger} />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
      <ResetViewButton onClick={handleResetView} />
    </div>
  );
}
