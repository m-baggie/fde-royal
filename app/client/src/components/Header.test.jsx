import { render, screen } from '@testing-library/react';
import Header from './Header';

describe('Header', () => {
  it("renders text 'Royal Caribbean'", () => {
    render(<Header onUploadClick={() => {}} />);
    expect(screen.getByText('Royal Caribbean')).toBeInTheDocument();
  });

  it("renders text 'DAM Asset Intelligence'", () => {
    render(<Header onUploadClick={() => {}} />);
    expect(screen.getByText('DAM Asset Intelligence')).toBeInTheDocument();
  });

  it("renders a button with text 'Upload'", () => {
    render(<Header onUploadClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });
});
