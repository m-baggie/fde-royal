import { render, screen, fireEvent, act } from '@testing-library/react';
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

  it('shows green "Owned" rights pill for owned rights_status', () => {
    render(<AssetCard asset={{ ...baseAsset, rights_status: 'owned' }} />);
    const pill = screen.getByTestId('rights-pill');
    expect(pill.textContent).toBe('Owned');
  });

  it('shows amber "Unclear" rights pill for unclear rights_status', () => {
    render(<AssetCard asset={{ ...baseAsset, rights_status: 'unclear' }} />);
    const pill = screen.getByTestId('rights-pill');
    expect(pill.textContent).toBe('Unclear');
  });

  it('shows red "No Rights" rights pill for none rights_status', () => {
    render(<AssetCard asset={{ ...baseAsset, rights_status: 'none' }} />);
    const pill = screen.getByTestId('rights-pill');
    expect(pill.textContent).toBe('No Rights');
  });

  it('shows no rights pill when rights_status is null', () => {
    render(<AssetCard asset={{ ...baseAsset, rights_status: null }} />);
    expect(screen.queryByTestId('rights-pill')).toBeNull();
  });

  it('hover overlay is present in DOM but opacity 0 at rest', () => {
    render(<AssetCard asset={baseAsset} />);
    const overlay = screen.getByTestId('hover-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.style.opacity).toBe('0');
  });

  it('hover overlay becomes opacity 1 on mouse enter', () => {
    render(<AssetCard asset={baseAsset} />);
    const card = screen.getByTestId('asset-card');
    fireEvent.mouseEnter(card);
    const overlay = screen.getByTestId('hover-overlay');
    expect(overlay.style.opacity).toBe('1');
    fireEvent.mouseLeave(card);
    expect(overlay.style.opacity).toBe('0');
  });

  it('always renders a download button with correct href and download attribute', () => {
    render(<AssetCard asset={{ ...baseAsset, id: '42' }} />);
    const btn = screen.getByTestId('download-btn');
    expect(btn.tagName).toBe('A');
    expect(btn.getAttribute('href')).toBe('/api/assets/42/download');
    expect(btn).toHaveAttribute('download');
  });

  it('renders Copy CDN button when cdn_url is present', () => {
    const asset = { ...baseAsset, cdn_url: 'https://assets.dm.rccl.com/foo.jpg' };
    render(<AssetCard asset={asset} />);
    expect(screen.getByTestId('copy-cdn-btn')).toBeInTheDocument();
  });

  it('does not render Copy CDN button when cdn_url is absent', () => {
    render(<AssetCard asset={{ ...baseAsset, cdn_url: undefined }} />);
    expect(screen.queryByTestId('copy-cdn-btn')).toBeNull();
  });

  it('Copy CDN button swaps to ✓ on click then reverts after 2000ms', async () => {
    const asset = { ...baseAsset, cdn_url: 'https://assets.dm.rccl.com/foo.jpg' };
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(<AssetCard asset={asset} />);
    const btn = screen.getByTestId('copy-cdn-btn');
    expect(btn.textContent).toBe('⎘');
    await act(async () => { fireEvent.click(btn); });
    expect(btn.textContent).toBe('✓');
    await act(async () => { await new Promise((r) => setTimeout(r, 2100)); });
    expect(btn.textContent).toBe('⎘');
  });
});
