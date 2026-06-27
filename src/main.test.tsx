import type { ReactElement } from 'react';
import { StrictMode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

const renderApp = vi.fn();

vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: renderApp }),
}));

vi.mock('./app/App', () => ({
  App: () => null,
}));

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>';
  renderApp.mockClear();
  vi.resetModules();
});

it('mounts the app without a StrictMode wrapper around the WebGL canvas', async () => {
  await import('./main');

  expect(renderApp).toHaveBeenCalledTimes(1);

  const element = renderApp.mock.calls[0]?.[0] as ReactElement;
  expect(element.type).not.toBe(StrictMode);
});
