import { vi } from 'vitest';
import type { WindowId } from '../domain/vehicle';
import { WINDOW_NODE_CONFIGS } from './windowConfig';

interface MockMesh {
  isMesh: true;
  name: string;
  position: { y: number };
  material: {
    emissive: { set: ReturnType<typeof vi.fn> };
    emissiveIntensity: number;
  };
}

interface MockNode {
  name: string;
  children: MockMesh[];
}

/**
 * Builds a minimal mock scene object that satisfies the interface
 * WindowInteraction expects: `getObjectByName` returning nodes with
 * `children` arrays of mesh-like objects.
 */
export function createMockSceneWithWindows() {
  const nodes: Record<string, MockNode> = {};

  for (const config of WINDOW_NODE_CONFIGS) {
    const mesh: MockMesh = {
      isMesh: true,
      name: `${config.nodeName}_mesh`,
      position: { y: 0.5 },
      material: {
        emissive: { set: vi.fn() },
        emissiveIntensity: 0,
      },
    };
    nodes[config.nodeName] = {
      name: config.nodeName,
      children: [mesh],
    };
  }

  return {
    traverse: vi.fn(),
    getObjectByName: (name: string) => nodes[name] ?? null,
  };
}

/**
 * Returns a mock GLTF result whose `scene` includes the four window nodes.
 */
export function mockGltfWithWindows() {
  return { scene: createMockSceneWithWindows() };
}

/**
 * Map from PRD WindowId to mock mesh for test assertions.
 */
export function getMockWindowMesh(
  scene: ReturnType<typeof createMockSceneWithWindows>,
  windowId: WindowId,
) {
  const config = WINDOW_NODE_CONFIGS.find((c) => c.windowId === windowId);
  if (!config) throw new Error(`Unknown windowId: ${windowId}`);
  const node = scene.getObjectByName(config.nodeName);
  if (!node) throw new Error(`Node ${config.nodeName} not found`);
  return node.children[0];
}
