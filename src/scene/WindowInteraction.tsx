import { useCallback, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Object3D } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { WindowId } from '../domain/vehicle';
import { useVehicleStore } from '../domain/vehicle';
import { WINDOW_NODE_CONFIGS, ANIMATION_DURATION_MS } from './windowConfig';
import type { WindowNodeConfig } from './windowConfig';

interface MaterialLike {
  emissive?: { set: (color: string) => void };
  emissiveIntensity?: number;
}

interface MeshLike {
  isMesh: boolean;
  position: { y: number };
  material: MaterialLike | MaterialLike[];
}

interface WindowEntry {
  mesh: MeshLike;
  config: WindowNodeConfig;
  initialY: number;
}

interface ActiveAnimation {
  startY: number;
  targetY: number;
  elapsed: number;
}

const EASE_IN_OUT_CUBIC = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const HOVER_EMISSIVE = '#225577';
const HOVER_INTENSITY = 0.45;

function isMeshLike(child: Object3D): child is Object3D & MeshLike {
  return (child as Object3D & { isMesh?: boolean }).isMesh === true;
}

function findFirstMesh(node: Object3D): MeshLike | null {
  if (isMeshLike(node)) return node;
  for (const child of node.children) {
    const found = findFirstMesh(child);
    if (found) return found;
  }
  return null;
}

function applyHover(mesh: MeshLike) {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const mat of materials) {
    if (mat.emissive) {
      mat.emissive.set(HOVER_EMISSIVE);
    }
    if (typeof mat.emissiveIntensity === 'number') {
      mat.emissiveIntensity = HOVER_INTENSITY;
    }
  }
}

function clearHover(mesh: MeshLike) {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const mat of materials) {
    if (mat.emissive) {
      mat.emissive.set('#000000');
    }
    if (typeof mat.emissiveIntensity === 'number') {
      mat.emissiveIntensity = 0;
    }
  }
}

function findWindowId(hit: Object3D): WindowId | null {
  let current: Object3D | null = hit;
  while (current) {
    for (const config of WINDOW_NODE_CONFIGS) {
      if (current.name === config.nodeName) return config.windowId;
    }
    current = current.parent;
  }
  return null;
}

export interface WindowInteractionAPI {
  onPointerEnter: (e: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * Hook that discovers window meshes in the loaded scene, wires hover/click
 * with drag-guard, and drives ease-in-out position animation synchronised
 * with the vehicle store state machine.
 *
 * Returns R3F-compatible event handlers.  Attach them to the `<primitive>`
 * that renders the model scene.
 */
export function useWindowInteraction(
  sceneRoot: Object3D,
  isDragRef: React.MutableRefObject<boolean>,
): WindowInteractionAPI {
  const windowsRef = useRef<Map<WindowId, WindowEntry>>(new Map());
  const animatingRef = useRef<Map<WindowId, ActiveAnimation>>(new Map());
  const hoveredRef = useRef<Set<WindowId>>(new Set());
  const initializedRef = useRef(false);
  const transitions = useVehicleStore((state) => state.transitions);
  const windowStates = useVehicleStore((state) => state.windows);

  // --- Registry: discover window meshes once after scene is available ---
  useEffect(() => {
    if (initializedRef.current) return;
    const map = new Map<WindowId, WindowEntry>();
    const activeAnimations = animatingRef.current;
    const hoveredWindows = hoveredRef.current;

    for (const config of WINDOW_NODE_CONFIGS) {
      const node = sceneRoot.getObjectByName(config.nodeName);
      if (!node) {
        console.error(
          `[WindowInteraction] Window node "${config.nodeName}" not found in loaded model. ` +
            'Window interaction disabled.',
        );
        continue;
      }

      const mesh = findFirstMesh(node);
      if (!mesh) {
        console.error(
          `[WindowInteraction] Window "${config.nodeName}" has no Mesh descendant. ` +
            'Window interaction disabled.',
        );
        continue;
      }

      map.set(config.windowId, {
        mesh,
        config,
        initialY: mesh.position.y,
      });
    }

    if (map.size < 4) {
      console.warn(
        `[WindowInteraction] Only ${map.size}/4 window nodes found. ` +
          'Available node names: ' +
          Array.from(
            new Set(
              (function collectNames(obj: Object3D): string[] {
                const names: string[] = [];
                obj.traverse((child) => {
                  if (child.name) names.push(child.name);
                });
                return names;
              })(sceneRoot),
            ),
          )
            .filter((n) => n.includes('window') || n.includes('Window'))
            .join(', '),
      );
    }

    windowsRef.current = map;
    initializedRef.current = true;

    return () => {
      const store = useVehicleStore.getState();
      for (const [windowId] of activeAnimations) {
        store.failWindowTransition(windowId);
      }
      activeAnimations.clear();

      for (const [, entry] of map) {
        clearHover(entry.mesh);
      }
      hoveredWindows.clear();
      initializedRef.current = false;
    };
  }, [sceneRoot]);

  // --- Transition consumer: every input source uses the same animation path ---
  useEffect(() => {
    const activeAnimations = animatingRef.current;

    // A reset, failure, or another lifecycle event may remove a transition
    // before its animation finishes. Cancel it and restore the stable pose.
    for (const [windowId] of activeAnimations) {
      if (transitions[windowId]) continue;

      activeAnimations.delete(windowId);
      const entry = windowsRef.current.get(windowId);
      const stableState = windowStates[windowId];
      if (entry && stableState !== 'transitioning') {
        entry.mesh.position.y =
          stableState === 'open'
            ? entry.initialY + entry.config.openOffset
            : entry.initialY;
      }
    }

    for (const config of WINDOW_NODE_CONFIGS) {
      const windowId = config.windowId;
      const transition = transitions[windowId];
      if (!transition || activeAnimations.has(windowId)) continue;

      const entry = windowsRef.current.get(windowId);
      if (!entry) {
        // Never leave a command permanently transitioning when its model node
        // cannot be animated.
        useVehicleStore.getState().failWindowTransition(windowId);
        continue;
      }

      activeAnimations.set(windowId, {
        startY: entry.mesh.position.y,
        targetY:
          transition.target === 'open'
            ? entry.initialY + entry.config.openOffset
            : entry.initialY,
        elapsed: 0,
      });
    }
  }, [transitions, windowStates]);

  // --- Pointer events: hover ---
  const handlePointerEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    const windowId = findWindowId(e.object);
    if (!windowId) return;

    const entry = windowsRef.current.get(windowId);
    if (!entry) return;

    applyHover(entry.mesh);
    hoveredRef.current.add(windowId);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerLeave = useCallback((e: ThreeEvent<PointerEvent>) => {
    const windowId = findWindowId(e.object);
    if (!windowId) return;

    const entry = windowsRef.current.get(windowId);
    if (!entry) return;

    clearHover(entry.mesh);
    hoveredRef.current.delete(windowId);

    if (hoveredRef.current.size === 0) {
      document.body.style.cursor = '';
    }
  }, []);

  // --- Pointer events: click ---
  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      const windowId = findWindowId(e.object);
      if (!windowId) return;

      if (isDragRef.current) return;

      const store = useVehicleStore.getState();
      const current = store.windows[windowId];
      if (current === 'transitioning') return;

      store.executeCommand({
        source: 'pointer',
        target: windowId,
        action: 'toggle',
      });
    },
    [isDragRef],
  );

  // --- Animation driver ---
  useFrame((_, delta) => {
    const animating = animatingRef.current;
    if (animating.size === 0) return;

    const deltaMs = delta * 1000;
    const completed: WindowId[] = [];
    const entries = Array.from(animating.entries());

    for (let i = 0; i < entries.length; i++) {
      const [windowId, anim] = entries[i];

      anim.elapsed += deltaMs;
      const progress = Math.min(anim.elapsed / ANIMATION_DURATION_MS, 1);
      const eased = EASE_IN_OUT_CUBIC(progress);

      const entry = windowsRef.current.get(windowId);
      if (entry) {
        entry.mesh.position.y =
          anim.startY + (anim.targetY - anim.startY) * eased;
      }

      if (progress >= 1) {
        if (entry) {
          entry.mesh.position.y = anim.targetY;
        }
        completed.push(windowId);
      }
    }

    for (const windowId of completed) {
      animating.delete(windowId);
      useVehicleStore.getState().completeWindowTransition(windowId);
    }
  });

  return {
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
    onClick: handleClick,
  };
}
