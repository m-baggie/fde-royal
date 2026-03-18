import { render, screen, fireEvent } from '@testing-library/react';
import AssetCard from './AssetCard';

const baseAsset = {
  id: '1',
  display_title: 'Test Asset',
  filename: 'test-asset.jpg',
  category: 'ships',
  rights_status: 'owned',
  quality_issues: [],
  thumbnail_path: null,
};

describe('AssetCard', () => {
  it('renders an <img> with src containing /api/assets/media/ when thumbnail_path is set', () => {
    const asset = {
      ...baseAsset,
      thumbnail_path: 'ships/allure/allure-of-the-seas.jpg/_jcr_content/renditions/cq5dam.thumbnail.319.319.png',
    };
    render(<AssetCard asset={asset} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/api/assets/media/');
  });

  it('renders a placeholder element (not an <img>) when thumbnail_path is null', () => {
    render(<AssetCard asset={baseAsset} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('asset-placeholder')).toBeInTheDocument();
  });

  it('renders variant badge with "+3 variants" when variant_count=4', () => {
    const asset = { ...baseAsset, variant_count: 4 };
    render(<AssetCard asset={asset} />);
    const badge = screen.getByTestId('variant-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('+3 variants');
  });

  it('does not render a variant badge when variant_count=1', () => {
    const asset = { ...baseAsset, variant_count: 1 };
    render(<AssetCard asset={asset} />);
    expect(screen.queryByTestId('variant-badge')).toBeNull();
  });

  it('does not render a variant badge when variant_count is undefined', () => {
    render(<AssetCard asset={baseAsset} />);
    expect(screen.queryByTestId('variant-badge')).toBeNull();
  });

  it('swaps to placeholder when image fails to load (onError)', () => {
    const asset = {
      ...baseAsset,
      thumbnail_path: 'ships/allure/nonexistent.jpg/_jcr_content/renditions/cq5dam.thumbnail.319.319.png',
    };
    render(<AssetCard asset={asset} />);
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('asset-placeholder')).toBeInTheDocument();
  });
});
