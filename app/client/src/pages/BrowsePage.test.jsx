import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const { mockGetAssets, mockGetFilters } = vi.hoisted(() => ({
  mockGetAssets: vi.fn(),
  mockGetFilters: vi.fn(),
}));

vi.mock('../api/assets', () => ({
  getAssets: mockGetAssets,
  getFilters: mockGetFilters,
}));

import BrowsePage from './BrowsePage';

const DEFAULT_FILTERS = {
  categories: ['ships', 'promotions'],
  subcategories: { ships: ['allure', 'anthem'], promotions: ['asia'] },
  locations: ['Naples', 'Singapore'],
};

function makeAssets(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${i + 1}`,
    display_title: `Asset ${i + 1}`,
    category: 'ships',
    rights_status: 'owned',
    quality_issues: [],
    thumbnail_path: null,
  }));
}

beforeEach(() => {
  mockGetFilters.mockResolvedValue(DEFAULT_FILTERS);
  mockGetAssets.mockResolvedValue({ assets: [], total: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('BrowsePage', () => {
  it('renders 3 AssetCards when getAssets mock returns 3 assets', async () => {
    mockGetAssets.mockResolvedValue({ assets: makeAssets(3), total: 3 });
    render(<BrowsePage />);
    await waitFor(() =>
      expect(screen.getAllByTestId('asset-card')).toHaveLength(3)
    );
  });

  it('typing "sunset" in SearchBar triggers getAssets with q="sunset" after debounce', async () => {
    vi.useFakeTimers();
    mockGetAssets.mockResolvedValue({ assets: [], total: 0 });
    render(<BrowsePage />);

    // Flush initial effects
    await act(async () => {
      vi.runAllTimers();
    });

    const input = screen.getByPlaceholderText(
      'Search by keyword, location, mood, ship...'
    );
    fireEvent.change(input, { target: { value: 'sunset' } });

    // Advance past the 300ms debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    const calls = mockGetAssets.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall).toMatchObject({ q: 'sunset' });
  });

  it('clicking category chip "ships" calls getAssets with category="ships"', async () => {
    render(<BrowsePage />);
    await waitFor(() => expect(screen.getByText('ships')).toBeInTheDocument());

    mockGetAssets.mockClear();
    fireEvent.click(screen.getByText('ships'));

    await waitFor(() => {
      const calls = mockGetAssets.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toMatchObject({ category: 'ships' });
    });
  });

  it('clicking active filter chip × removes it and calls getAssets without that param', async () => {
    render(<BrowsePage />);
    await waitFor(() => expect(screen.getByText('ships')).toBeInTheDocument());

    // Set the category filter
    fireEvent.click(screen.getByText('ships'));
    await waitFor(() =>
      expect(screen.getByTestId('active-filter-chip')).toBeInTheDocument()
    );

    // Clear the mock and click × to remove the filter
    mockGetAssets.mockClear();
    const removeBtn = screen.getByRole('button', { name: /remove filter ships/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      const calls = mockGetAssets.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).not.toHaveProperty('category');
    });
  });

  it('shows 12 skeleton cards while loading is true', () => {
    // Never resolves — keeps loading=true and avoids post-test state updates
    mockGetAssets.mockReturnValue(new Promise(() => {}));
    mockGetFilters.mockReturnValue(new Promise(() => {}));
    render(<BrowsePage />);
    expect(screen.getAllByTestId('skeleton-card')).toHaveLength(12);
  });

  it('shows error banner when getAssets rejects', async () => {
    mockGetAssets.mockRejectedValue(new Error('Network Error'));
    render(<BrowsePage />);
    await waitFor(() =>
      expect(
        screen.getByText('Failed to load assets. Please try again.')
      ).toBeInTheDocument()
    );
  });
});
