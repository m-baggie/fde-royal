import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import AssetGrid from '../components/AssetGrid';
import AssetDetailModal from '../components/AssetDetailModal';
import UploadModal from '../components/UploadModal';
import { getAssets, getFilters } from '../api/assets';
import { SURFACE } from '../styles/tokens';

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  searchRow: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
    padding: '10px 24px',
    flexShrink: 0,
  },
  bodyRow: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebarContainer: {
    width: '240px',
    flexShrink: 0,
    height: '100%',
    overflowY: 'auto',
    backgroundColor: SURFACE,
  },
  main: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    padding: '16px 24px',
    overflowY: 'auto',
    boxSizing: 'border-box',
    backgroundColor: SURFACE,
  },
  activeFiltersRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginBottom: '12px',
    minHeight: '0px',
  },
  activeChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    padding: '3px 8px',
    borderRadius: '12px',
    backgroundColor: '#001B6B',
    color: '#fff',
  },
  chipRemove: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0',
    lineHeight: 1,
    marginLeft: '2px',
  },
  countLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '12px',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#6b7280',
    fontSize: '14px',
  },
  clearBtn: {
    marginTop: '12px',
    padding: '8px 16px',
    backgroundColor: '#001B6B',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
};

function buildParams({ q, category, subcategory, rights, location, metadataQuality, channel, scene, destinationRegion, contentType }) {
  const params = {};
  if (q) params.q = q;
  if (category) params.category = category;
  if (subcategory) params.subcategory = subcategory;
  if (rights) params.rights = rights;
  if (location) params.location = location;
  if (metadataQuality && metadataQuality.length > 0) {
    params.metadataQuality = metadataQuality.join(',');
  }
  if (channel) params.channel = channel;
  if (scene && scene.length > 0) params.scene = scene.join(',');
  if (destinationRegion) params.destination_region = destinationRegion;
  if (contentType) params.content_type = contentType;
  return params;
}

export default function BrowsePage({ isUploadOpen = false, onUploadClick = () => {}, onUploadRequestClose = () => {}, adminMode = false, onAdminModeChange = () => {}, isFavourited = () => false, onFavouriteToggle = () => {}, count = 0, clear = () => {} }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [rights, setRights] = useState('');
  const [location, setLocation] = useState('');
  const [metadataQuality, setMetadataQuality] = useState([]);
  const [channel, setChannel] = useState('');
  const [scene, setScene] = useState([]);
  const [destinationRegion, setDestinationRegion] = useState('');
  const [contentType, setContentType] = useState('');

  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ categories: [], subcategories: {}, locations: [] });
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Read ?asset= URL param on mount and open that asset's detail modal
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const assetParam = params.get('asset');
    if (assetParam) {
      setSelectedAssetId(assetParam);
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Load filter options once
  useEffect(() => {
    getFilters().then(setFilters).catch(() => {});
  }, []);

  // Load assets whenever filter state or refreshKey changes
  useEffect(() => {
    const params = buildParams({ q, category, subcategory, rights, location, metadataQuality, channel, scene, destinationRegion, contentType });
    setLoading(true);
    setError(null);
    getAssets(params)
      .then((data) => {
        setAssets(data.assets || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load assets. Please try again.');
        setLoading(false);
      });
  }, [q, category, subcategory, rights, location, metadataQuality, channel, scene, destinationRegion, contentType, refreshKey]);

  function handleUploadComplete() {
    onUploadRequestClose();
    setRefreshKey((k) => k + 1);
  }

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'category') setCategory(value);
    else if (key === 'subcategory') setSubcategory(value);
    else if (key === 'rights') setRights(value);
    else if (key === 'location') setLocation(value);
    else if (key === 'metadataQuality') setMetadataQuality(value);
    else if (key === 'channel') setChannel(value);
    else if (key === 'scene') setScene(value);
    else if (key === 'destinationRegion') setDestinationRegion(value);
    else if (key === 'contentType') setContentType(value);
  }, []);

  function clearAllFilters() {
    setQ('');
    setCategory('');
    setSubcategory('');
    setRights('');
    setLocation('');
    setMetadataQuality([]);
    setChannel('');
    setScene([]);
    setDestinationRegion('');
    setContentType('');
  }

  // Build active filter chips list
  const activeChips = [];
  if (q) activeChips.push({ key: 'q', label: `"${q}"`, clear: () => setQ('') });
  if (category) activeChips.push({ key: 'category', label: category, clear: () => { setCategory(''); setSubcategory(''); } });
  if (subcategory) activeChips.push({ key: 'subcategory', label: subcategory, clear: () => setSubcategory('') });
  if (rights) activeChips.push({ key: 'rights', label: rights, clear: () => setRights('') });
  if (location) activeChips.push({ key: 'location', label: location, clear: () => setLocation('') });
  metadataQuality.forEach((mq) =>
    activeChips.push({
      key: `mq-${mq}`,
      label: mq,
      clear: () => setMetadataQuality((prev) => prev.filter((v) => v !== mq)),
    })
  );
  if (channel) activeChips.push({ key: 'channel', label: channel, clear: () => setChannel('') });
  scene.forEach((s) =>
    activeChips.push({
      key: `scene-${s}`,
      label: s,
      clear: () => setScene((prev) => prev.filter((v) => v !== s)),
    })
  );
  if (destinationRegion) activeChips.push({ key: 'destinationRegion', label: destinationRegion, clear: () => setDestinationRegion('') });
  if (contentType) activeChips.push({ key: 'contentType', label: contentType, clear: () => setContentType('') });

  return (
    <div style={styles.page}>
      <Header
        onUploadClick={onUploadClick}
        adminMode={adminMode}
        count={count}
        onFavouriteToggle={onFavouriteToggle}
        clear={clear}
        onSelectAsset={setSelectedAssetId}
      />

      <div style={styles.searchRow}>
        <SearchBar onChange={setQ} />
      </div>

      <div style={styles.bodyRow}>
        <div style={styles.sidebarContainer} data-testid="sidebar">
          <FilterSidebar
            filters={filters}
            activeCategory={category}
            activeSubcategory={subcategory}
            activeRights={rights}
            activeLocation={location}
            activeMetadataQuality={metadataQuality}
            activeChannel={channel}
            activeScene={scene}
            activeDestinationRegion={destinationRegion}
            activeContentType={contentType}
            onFilterChange={handleFilterChange}
            adminMode={adminMode}
            onAdminModeChange={onAdminModeChange}
          />
        </div>

        <div style={styles.main} data-testid="main-content">
          {activeChips.length > 0 && (
            <div style={styles.activeFiltersRow}>
              {activeChips.map((chip) => (
                <span key={chip.key} style={styles.activeChip} data-testid="active-filter-chip">
                  {chip.label}
                  <button
                    style={styles.chipRemove}
                    onClick={chip.clear}
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <div style={styles.errorBanner}>{error}</div>}

          {!loading && !error && (
            <div style={styles.countLabel}>
              Showing {assets.length} of {total} assets
            </div>
          )}

          {!loading && !error && assets.length === 0 && (
            <div style={styles.emptyState}>
              No assets match your search.
              <br />
              <button style={styles.clearBtn} onClick={clearAllFilters}>
                Clear all filters
              </button>
            </div>
          )}

          <AssetGrid
            assets={assets}
            loading={loading}
            onSelectAsset={setSelectedAssetId}
            isFavourited={isFavourited}
            onFavouriteToggle={onFavouriteToggle}
          />
        </div>
      </div>

      {selectedAssetId && (
        <AssetDetailModal
          selectedAssetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
          adminMode={adminMode}
          isFavourited={isFavourited ? isFavourited(selectedAssetId) : false}
          onFavouriteToggle={onFavouriteToggle}
        />
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => { onUploadRequestClose(); setRefreshKey((k) => k + 1); }}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
