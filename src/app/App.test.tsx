import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the product heading', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: '3D 智舱车控 Demo' }),
    ).toBeInTheDocument();
  });
});
