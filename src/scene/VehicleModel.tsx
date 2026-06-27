import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Group, type Object3D, Vector3 } from 'three';
import type { GLTF } from 'three-stdlib';

const MODEL_PATH = '/models/vehicle.glb';
const TARGET_MAX_DIMENSION = 3.5;

function computeWorldBounds(root: Object3D): Box3 {
  const box = new Box3();
  root.traverse((child) => {
    if ((child as Object3D & { isMesh?: boolean }).isMesh) {
      box.expandByObject(child);
    }
  });
  return box;
}

export function VehicleModel() {
  const { scene } = useGLTF(MODEL_PATH) as GLTF;

  const { position, scale } = useMemo(() => {
    const box = computeWorldBounds(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const computedScale = TARGET_MAX_DIMENSION / maxDim;

    return {
      position: new Vector3(
        -center.x * computedScale,
        -box.min.y * computedScale,
        -center.z * computedScale,
      ),
      scale: new Vector3().setScalar(computedScale),
    };
  }, [scene]);

  // Wrap in a Group to avoid mutating the cached scene's transform
  const group = useMemo(() => new Group(), []);

  useLayoutEffect(() => {
    group.position.copy(position);
    group.scale.copy(scale);
    group.add(scene);

    return () => {
      group.remove(scene);
    };
  }, [group, scene, position, scale]);

  return <primitive object={group} />;
}
