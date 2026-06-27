import { useCallback, useRef } from 'react';

export const DRAG_THRESHOLD_PX = 5;

export interface DragDetector {
  /** Ref that is true after pointerup if the pointer moved > DRAG_THRESHOLD_PX. Reset on next pointerdown. */
  isDragRef: React.MutableRefObject<boolean>;
  /** Attach to the container element that wraps the Canvas. */
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export function useDragDetector(): DragDetector {
  const isDragRef = useRef(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
    isDragRef.current = false;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const origin = pointerOriginRef.current;
    pointerOriginRef.current = null;

    if (!origin) return;

    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    isDragRef.current = Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX;
  }, []);

  return { isDragRef, onPointerDown, onPointerUp };
}
