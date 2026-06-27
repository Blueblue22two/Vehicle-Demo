import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DRAG_THRESHOLD_PX, useDragDetector } from '../useDragDetector';
import type { DragDetector } from '../useDragDetector';
import { createMockSceneWithWindows } from '../testUtils';

interface OrbitControlsProps {
  enableRotate?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  minDistance?: number;
  maxDistance?: number;
}

let capturedOrbitProps: OrbitControlsProps | null = null;

function getProps(): OrbitControlsProps {
  if (!capturedOrbitProps)
    throw new Error('OrbitControls props were not captured');
  return capturedOrbitProps;
}

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: createMockSceneWithWindows() }),
  ContactShadows: () => null,
  OrbitControls: (props: OrbitControlsProps) => {
    capturedOrbitProps = props;
    return null;
  },
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: () => ({
    camera: { position: { copy: vi.fn(), lerpVectors: vi.fn() } },
  }),
}));

import { VehicleScene } from '../VehicleScene';

// Helper to simulate pointer events on a DOM element
function firePointerEvent(
  element: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
) {
  const event = new MouseEvent(type, {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

describe('OrbitControls', () => {
  it('configures rotation enabled, pan disabled, zoom enabled', () => {
    capturedOrbitProps = null;
    render(<VehicleScene />);

    expect(getProps()).toMatchObject({
      enableRotate: true,
      enablePan: false,
      enableZoom: true,
    });
  });

  it('restricts polar angle to 15°–75°', () => {
    capturedOrbitProps = null;
    render(<VehicleScene />);

    expect(getProps().minPolarAngle).toBe((15 * Math.PI) / 180);
    expect(getProps().maxPolarAngle).toBe((75 * Math.PI) / 180);
  });

  it('sets safe camera distance bounds', () => {
    capturedOrbitProps = null;
    render(<VehicleScene />);

    expect(getProps().minDistance).toBe(3);
    expect(getProps().maxDistance).toBe(12);
  });

  it('CameraControls is rendered inside the Canvas', () => {
    capturedOrbitProps = null;
    render(<VehicleScene />);

    expect(getProps()).toBeTruthy();
  });
});

describe('useDragDetector', () => {
  function DragTestComponent({
    onDetector,
  }: {
    onDetector: (d: DragDetector) => void;
  }) {
    const detector = useDragDetector();
    onDetector(detector);
    return (
      <div
        data-testid="drag-target"
        onPointerDown={detector.onPointerDown}
        onPointerUp={detector.onPointerUp}
      >
        target
      </div>
    );
  }

  it('marks isDrag as false when pointer moves ≤5 px', () => {
    let detector: DragDetector | null = null;
    render(
      <DragTestComponent
        onDetector={(d) => {
          detector = d;
        }}
      />,
    );

    const target = screen.getByTestId('drag-target');

    firePointerEvent(target, 'pointerdown', 100, 100);
    firePointerEvent(target, 'pointerup', 104, 103); // dx=4, dy=3 → dist=5

    expect(detector!.isDragRef.current).toBe(false);
  });

  it('marks isDrag as true when pointer moves >5 px', () => {
    let detector: DragDetector | null = null;
    render(
      <DragTestComponent
        onDetector={(d) => {
          detector = d;
        }}
      />,
    );

    const target = screen.getByTestId('drag-target');

    firePointerEvent(target, 'pointerdown', 100, 100);
    firePointerEvent(target, 'pointerup', 106, 100); // dx=6 → dist=6 > 5

    expect(detector!.isDragRef.current).toBe(true);
  });

  it('resets isDrag to false on next pointerdown', () => {
    let detector: DragDetector | null = null;
    render(
      <DragTestComponent
        onDetector={(d) => {
          detector = d;
        }}
      />,
    );

    const target = screen.getByTestId('drag-target');

    firePointerEvent(target, 'pointerdown', 100, 100);
    firePointerEvent(target, 'pointerup', 120, 100);
    expect(detector!.isDragRef.current).toBe(true);

    firePointerEvent(target, 'pointerdown', 200, 200);
    expect(detector!.isDragRef.current).toBe(false);
    firePointerEvent(target, 'pointerup', 202, 201);
    expect(detector!.isDragRef.current).toBe(false);
  });

  it('handles pointerup without prior pointerdown gracefully', () => {
    let detector: DragDetector | null = null;
    render(
      <DragTestComponent
        onDetector={(d) => {
          detector = d;
        }}
      />,
    );

    const target = screen.getByTestId('drag-target');

    expect(() => {
      firePointerEvent(target, 'pointerup', 100, 100);
    }).not.toThrow();
    expect(detector!.isDragRef.current).toBe(false);
  });

  it('exports the correct threshold constant', () => {
    expect(DRAG_THRESHOLD_PX).toBe(5);
  });
});
