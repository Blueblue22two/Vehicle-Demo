import { Suspense, useCallback, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { VehicleModel } from './VehicleModel';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneLoadingFallback } from './SceneLoadingFallback';
import { ResetCamera } from './ResetCamera';
import { useDragDetector } from './useDragDetector';
import { getPerformanceConfig } from './performanceConfig';

const CANVAS_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
};

const POLAR_MIN = (15 * Math.PI) / 180;
const POLAR_MAX = (75 * Math.PI) / 180;

interface SceneLightsProps {
  shadowMapSize: number;
  shadowsEnabled: boolean;
}

/**
 * Three-light setup for studio-style cockpit illumination.
 * Shadow quality adapts to the detected performance tier.
 */
function SceneLights({ shadowMapSize, shadowsEnabled }: SceneLightsProps) {
  return (
    <>
      <ambientLight intensity={0.5} color="#aaccff" />
      <directionalLight
        position={[10, 14, 8]}
        intensity={3.0}
        color="#fff8f0"
        castShadow={shadowsEnabled}
        shadow-mapSize-width={shadowMapSize}
        shadow-mapSize-height={shadowMapSize}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0004}
      />
      <directionalLight
        position={[-5, 4, -6]}
        intensity={shadowsEnabled ? 1.0 : 1.2}
        color="#8899cc"
      />
    </>
  );
}

function SceneGround({ shadowsEnabled }: { shadowsEnabled: boolean }) {
  return (
    <>
      {shadowsEnabled && (
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
        >
          <planeGeometry args={[20, 20]} />
          <shadowMaterial transparent opacity={0.3} />
        </mesh>
      )}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={shadowsEnabled ? 0.5 : 0.3}
        scale={12}
        blur={2.5}
        far={10}
      />
    </>
  );
}

function CameraControls() {
  return (
    <OrbitControls
      enableRotate
      enablePan={false}
      enableZoom
      minPolarAngle={POLAR_MIN}
      maxPolarAngle={POLAR_MAX}
      minDistance={3}
      maxDistance={12}
      target={[0, 0.5, 0]}
    />
  );
}

export function VehicleScene() {
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
  }, []);

  const { isDragRef, onPointerDown, onPointerUp } = useDragDetector();

  const perf = useMemo(() => getPerformanceConfig(), []);

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
            dpr={[1, perf.maxDpr]}
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
            <SceneLights
              shadowMapSize={perf.shadowMapSize}
              shadowsEnabled={perf.shadowsEnabled}
            />
            <SceneGround shadowsEnabled={perf.shadowsEnabled} />
            <VehicleModel isDragRef={isDragRef} />
            <CameraControls />
            <ResetCamera />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
