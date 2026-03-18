import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({ get: mockGet, post: mockPost }),
  },
}));

import { getAssets, getAsset, getFilters, uploadFiles, enrichAsset, getAssetVariants, getAssetDownloadUrl } from './assets.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('assets API', () => {
  it('getAssets with { category: "ships" } calls GET /api/assets?category=ships', async () => {
    mockGet.mockResolvedValueOnce({ data: { total: 2, assets: [] } });
    const result = await getAssets({ category: 'ships' });
    expect(mockGet).toHaveBeenCalledWith('/api/assets?category=ships');
    expect(result).toEqual({ total: 2, assets: [] });
  });

  it('network error propagates from getAssets', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'));
    await expect(getAssets()).rejects.toThrow('Network Error');
  });

  it('getAsset(id) calls GET /api/assets/:id', async () => {
    mockGet.mockResolvedValueOnce({ data: { id: '42' } });
    const result = await getAsset('42');
    expect(mockGet).toHaveBeenCalledWith('/api/assets/42');
    expect(result).toEqual({ id: '42' });
  });

  it('getFilters() calls GET /api/filters', async () => {
    mockGet.mockResolvedValueOnce({ data: { categories: [] } });
    await getFilters();
    expect(mockGet).toHaveBeenCalledWith('/api/filters');
  });

  it('uploadFiles(formData) calls POST /api/assets/upload', async () => {
    const fd = new FormData();
    mockPost.mockResolvedValueOnce({ data: { uploaded: 1, assets: [] } });
    const result = await uploadFiles(fd);
    expect(mockPost).toHaveBeenCalledWith('/api/assets/upload', fd);
    expect(result).toEqual({ uploaded: 1, assets: [] });
  });

  it('enrichAsset(id) calls POST /api/assets/:id/enrich', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: '5', enriched: true } });
    const result = await enrichAsset('5');
    expect(mockPost).toHaveBeenCalledWith('/api/assets/5/enrich');
    expect(result).toEqual({ id: '5', enriched: true });
  });

  it('getAssetVariants(id) calls GET /api/assets/:id/variants', async () => {
    const variants = [{ id: 'a.jpg' }, { id: 'b.jpg' }];
    mockGet.mockResolvedValueOnce({ data: variants });
    const result = await getAssetVariants('a.jpg');
    expect(mockGet).toHaveBeenCalledWith('/api/assets/a.jpg/variants');
    expect(result).toEqual(variants);
  });

  it('getAssetDownloadUrl(id) returns the download URL string', () => {
    const url = getAssetDownloadUrl('my-asset.jpg');
    expect(url).toBe('/api/assets/my-asset.jpg/download');
  });
});
