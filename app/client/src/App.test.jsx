import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock API so BrowsePage/UploadModal don't attempt real network calls
vi.mock('./api/assets', () => ({
  getAssets: vi.fn(() => new Promise(() => {})),
  getFilters: vi.fn(() => new Promise(() => {})),
  uploadFiles: vi.fn(() => new Promise(() => {})),
  enrichAsset: vi.fn(() => new Promise(() => {})),
  getAssetDownloadUrl: (id) => `/api/assets/${id}/download`,
}));

import App from './App';

describe('App', () => {
  it("renders Header with 'Royal Caribbean' text", () => {
    render(<App />);
    expect(screen.getByText('Royal Caribbean')).toBeInTheDocument();
  });
});
