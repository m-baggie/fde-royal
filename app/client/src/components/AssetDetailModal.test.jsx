import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// Hoist mock functions so they are available inside the vi.mock factory
const { mockGetAsset, mockEnrichAsset } = vi.hoisted(() => ({
  mockGetAsset: vi.fn(),
  mockEnrichAsset: vi.fn(),
}));

vi.mock('../api/assets', () => ({
  getAsset: mockGetAsset,
  enrichAsset: mockEnrichAsset,
}));

import AssetDetailModal from './AssetDetailModal';

// Default asset returned by getAsset
const ASSET = {
  id: 'asset-1',
  filename: 'allure-sunset.jpg',
  display_title: 'Allure of the Seas Sunset',
  web_image_path: null,
  thumbnail_path: '/thumbnails/allure-sunset.jpg',
  width: 1920,
  height: 1080,
  file_size: 2048000,
  file_format: 'JPEG',
  original_title: 'Allure Sunset',
  original_description: 'Ship at sunset',
  original_creator: 'Brand Team',
  original_rights_owner: 'Royal Caribbean',
  original_usage_terms: null,
  original_tags: null,
  original_location: 'Naples',
  enriched_title: 'Allure of the Seas — Golden Sunset',
  enriched_description: null,
  enriched_tags: null,
  enriched_location: null,
  enriched_creator_normalized: null,
  enriched_channel: null,
  enriched_format: null,
  enrichment_source: null,
  quality_issues: [],
  cdn_url: 'https://assets.dm.rccl.com/RoyalCaribbeanCruises/allure-sunset.jpg',
  rights_status: 'owned',
};

beforeEach(() => {
  mockGetAsset.mockResolvedValue(ASSET);
  mockEnrichAsset.mockResolvedValue({});
  // Mock clipboard API
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.style.overflow = '';
});

async function renderModal(props = {}) {
  const onClose = props.onClose || vi.fn();
  const selectedAssetId = props.selectedAssetId ?? 'asset-1';
  render(<AssetDetailModal selectedAssetId={selectedAssetId} onClose={onClose} />);
  // Wait for asset to load
  await waitFor(() => expect(screen.getByTestId('asset-detail-modal')).toBeInTheDocument());
  await waitFor(() => expect(screen.queryByTestId('modal-spinner')).not.toBeInTheDocument());
  return { onClose };
}

describe('AssetDetailModal', () => {
  it('renders display_title from mocked getAsset response', async () => {
    await renderModal();
    expect(screen.getByText('Allure of the Seas Sunset')).toBeInTheDocument();
  });

  it('ESC keydown triggers onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking × button triggers onClose', async () => {
    const onClose = vi.fn();
    await renderModal({ onClose });
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Copy button shows "Copied!" immediately after click', async () => {
    await renderModal();
    const copyBtn = screen.getByTestId('copy-cdn-btn');
    expect(copyBtn).toHaveTextContent('Copy');
    fireEvent.click(copyBtn);
    expect(copyBtn).toHaveTextContent('Copied!');
  });

  it('"Enrich with AI" button is visible when enrichment_source is null', async () => {
    mockGetAsset.mockResolvedValue({ ...ASSET, enrichment_source: null });
    await renderModal();
    expect(screen.getByTestId('enrich-btn')).toBeInTheDocument();
  });

  it('quality_issues badge "No Rights Data" renders when "missing_rights" in quality_issues', async () => {
    mockGetAsset.mockResolvedValue({ ...ASSET, quality_issues: ['missing_rights'] });
    await renderModal();
    expect(screen.getByTestId('quality-badge-missing_rights')).toHaveTextContent('No Rights Data');
  });

  it('CDN URL section is not rendered when cdn_url is null', async () => {
    mockGetAsset.mockResolvedValue({ ...ASSET, cdn_url: null });
    await renderModal();
    expect(screen.queryByTestId('cdn-url-code')).not.toBeInTheDocument();
  });

  it('enrichAsset returns 503 → toast shown, modal remains open', async () => {
    const err = { response: { status: 503 } };
    mockEnrichAsset.mockRejectedValue(err);
    await renderModal();

    await act(async () => {
      fireEvent.click(screen.getByTestId('enrich-btn'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('enrich-toast')).toHaveTextContent(
        'Enrichment unavailable — add OPENAI_API_KEY to .env'
      )
    );
    // Modal still open
    expect(screen.getByTestId('asset-detail-modal')).toBeInTheDocument();
  });
});
