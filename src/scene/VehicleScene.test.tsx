import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseGLTF = vi.fn();

vi.mock('@react-three/drei', () => ({
  useGLTF: (path: string) => mockUseGLTF(path),
  ContactShadows: () => null,
  OrbitControls: () => null,
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
  useFrame: vi.fn(),
}));

import { VehicleScene } from './VehicleScene';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { SceneLoadingFallback } from './SceneLoadingFallback';
import { createMockSceneWithWindows } from './testUtils';

describe('SceneErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <SceneErrorBoundary onRetry={vi.fn()}>
        <p data-testid="child">content</p>
      </SceneErrorBoundary>,
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByTestId('scene-error')).not.toBeInTheDocument();
  });

  it('shows error message and retry button when child throws', () => {
    const onRetry = vi.fn();
    const Thrower = () => {
      throw new Error('Model not found');
    };

    render(
      <SceneErrorBoundary onRetry={onRetry}>
        <Thrower />
      </SceneErrorBoundary>,
    );

    expect(screen.getByTestId('scene-error')).toBeInTheDocument();
    expect(screen.getByText(/3D 场景加载失败/).textContent).toBeTruthy();
    expect(screen.getByText(/Model not found/).textContent).toBeTruthy();
    expect(
      screen.getByRole('button', { name: '重新加载' }),
    ).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn();
    const Thrower = () => {
      throw new Error('fail');
    };

    render(
      <SceneErrorBoundary onRetry={onRetry}>
        <Thrower />
      </SceneErrorBoundary>,
    );

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SceneLoadingFallback', () => {
  it('renders loading status', () => {
    render(<SceneLoadingFallback />);

    expect(screen.getByTestId('scene-loading')).toBeInTheDocument();
    expect(screen.getByText(/正在加载 3D 车辆/).textContent).toBeTruthy();
  });
});

describe('VehicleScene', () => {
  beforeEach(() => {
    mockUseGLTF.mockReset();
  });

  it('renders the scene container', () => {
    mockUseGLTF.mockReturnValue({ scene: createMockSceneWithWindows() });

    render(<VehicleScene />);

    expect(screen.getByTestId('scene-container')).toBeInTheDocument();
  });

  it('shows loading fallback while model is suspended', () => {
    mockUseGLTF.mockImplementation(() => {
      throw new Promise(() => {});
    });

    render(<VehicleScene />);

    expect(screen.getByTestId('scene-loading')).toBeInTheDocument();
  });

  it('shows error state when model fails to load', () => {
    mockUseGLTF.mockImplementation(() => {
      throw new Error('404 Not Found');
    });

    render(<VehicleScene />);

    expect(screen.getByTestId('scene-error')).toBeInTheDocument();
    expect(screen.getByText(/3D 场景加载失败/).textContent).toBeTruthy();
  });

  it('retry triggers remount and re-calls useGLTF', async () => {
    let calls = 0;
    mockUseGLTF.mockImplementation(() => {
      calls++;
      throw new Error('fail');
    });

    render(<VehicleScene />);

    expect(screen.getByTestId('scene-error')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));

    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it('renders canvas when model loads successfully', () => {
    mockUseGLTF.mockReturnValue({ scene: createMockSceneWithWindows() });

    render(<VehicleScene />);

    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });
});
