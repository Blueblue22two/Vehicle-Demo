import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Vector3 } from 'three';

/** Default camera position — left-front 45° composition. */
const DEFAULT_POSITION = new Vector3(5, 2.5, 5);
/** Default camera look-at target (approximately vehicle center). */
const DEFAULT_TARGET = new Vector3(0, 0.5, 0);

const LERP_SPEED = 4;

/**
 * Renders a "重置视角" (reset view) button pinned to the top-right of the
 * viewport and smoothly animates the camera back to the default left-front
 * 45° composition on click.
 */
export function ResetCamera() {
  const { camera, size } = useThree();
  const [animating, setAnimating] = useState(false);
  const startPos = useRef(new Vector3());
  const targetPos = useRef(new Vector3());
  const elapsed = useRef(0);

  useEffect(() => {
    DEFAULT_POSITION.copy(camera.position);
  }, [camera]);

  const handleReset = useCallback(() => {
    startPos.current.copy(camera.position);
    targetPos.current.copy(DEFAULT_POSITION);
    elapsed.current = 0;
    setAnimating(true);
  }, [camera]);

  useFrame((_, delta) => {
    if (!animating) return;

    elapsed.current += delta * LERP_SPEED;
    const t = Math.min(elapsed.current, 1);

    // Smooth ease-out
    const eased = 1 - (1 - t) * (1 - t);

    camera.position.lerpVectors(startPos.current, targetPos.current, eased);

    // Point the camera toward the vehicle during animation
    camera.lookAt(DEFAULT_TARGET);

    if (t >= 1) {
      camera.position.copy(DEFAULT_POSITION);
      camera.lookAt(DEFAULT_TARGET);
      setAnimating(false);
    }
  });

  return (
    <Html
      calculatePosition={() => [size.width - 130, 50]}
      style={{ pointerEvents: 'auto' }}
    >
      <button
        className="reset-view-button"
        type="button"
        onClick={handleReset}
        aria-label="重置视角"
        data-testid="reset-view-button"
      >
        重置视角
      </button>
    </Html>
  );
}
