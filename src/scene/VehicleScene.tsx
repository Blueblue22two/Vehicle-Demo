import { Suspense, useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
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

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} color="#aaccff" />
      <directionalLight
        position={[8, 12, 6]}
        intensity={2.5}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-4, 3, -4]}
        intensity={0.8}
        color="#8899cc"
      />
    </>
  );
}

function SceneGround() {
  return (
    <>
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={8}
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
    />
  );
}

export function VehicleScene() {
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryKey((prev) => prev + 1);
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
            <CameraControls />
          </Canvas>
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
