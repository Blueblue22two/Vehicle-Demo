import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../scene', () => ({
  VehicleScene: () => <div data-testid="vehicle-scene" />,
}));

vi.mock('@react-three/drei', () => ({
  useGLTF: () => ({ scene: {} }),
  useProgress: () => ({ progress: 100, active: false }),
  ContactShadows: () => null,
  OrbitControls: () => null,
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

import { App } from './App';

describe('App', () => {
  it('renders the header with brand and title', () => {
    render(<App />);

    expect(screen.getByText('NeoCabin')).toBeInTheDocument();
    expect(screen.getByText('3D 智舱车控 Demo')).toBeInTheDocument();
  });

  it('renders the vehicle scene', () => {
    render(<App />);

    expect(screen.getByTestId('vehicle-scene')).toBeInTheDocument();
  });

  it('renders the status panel with four windows', () => {
    render(<App />);

    expect(screen.getByText('左前窗')).toBeInTheDocument();
    expect(screen.getByText('右前窗')).toBeInTheDocument();
  });

  it('renders text command input', () => {
    render(<App />);

    expect(
      screen.getByRole('textbox', { name: '文本命令输入' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '发送命令' }),
    ).toBeInTheDocument();
  });

  it('renders the footer hint', () => {
    render(<App />);

    expect(screen.getByText(/拖动旋转/)).toBeInTheDocument();
  });

  it('renders the voice control button', () => {
    render(<App />);

    expect(screen.getByTestId('voice-button')).toBeInTheDocument();
    expect(screen.getByTestId('voice-status')).toBeInTheDocument();
  });
});
