import { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import FilterSidebar from '../components/FilterSidebar';
import AssetGrid from '../components/AssetGrid';
import AssetDetailModal from '../components/AssetDetailModal';
import UploadModal from '../components/UploadModal';
import { getAssets, getFilters } from '../api/assets';

const styles = {
  page: {
    display: 'flex',
    gap: '24px',
    padding: '24px',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  searchRow: {
    marginBottom: '12px',
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

function buildParams({ q, category, subcategory, rights, location, metadataQuality }) {
  const params = {};
  if (q) params.q = q;
  if (category) params.category = category;
  if (subcategory) params.subcategory = subcategory;
  if (rights) params.rights = rights;
  if (location) params.location = location;
  if (metadataQuality && metadataQuality.length > 0) {
    params.metadataQuality = metadataQuality.join(',');
  }
  return params;
}

export default function BrowsePage({ isUploadOpen = false, onUploadRequestClose = () => {} }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [rights, setRights] = useState('');
  const [location, setLocation] = useState('');
  const [metadataQuality, setMetadataQuality] = useState([]);

  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ categories: [], subcategories: {}, locations: [] });
  const [selectedAssetId, setSelectedAssetId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load filter options once
  useEffect(() => {
    getFilters().then(setFilters).catch(() => {});
  }, []);

  // Load assets whenever filter state or refreshKey changes
  useEffect(() => {
    const params = buildParams({ q, category, subcategory, rights, location, metadataQuality });
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
  }, [q, category, subcategory, rights, location, metadataQuality, refreshKey]);

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
  }, []);

  function clearAllFilters() {
    setQ('');
    setCategory('');
    setSubcategory('');
    setRights('');
    setLocation('');
    setMetadataQuality([]);
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

  return (
    <div style={styles.page}>
      <FilterSidebar
        filters={filters}
        activeCategory={category}
        activeSubcategory={subcategory}
        activeRights={rights}
        activeLocation={location}
        activeMetadataQuality={metadataQuality}
        onFilterChange={handleFilterChange}
      />

      <div style={styles.main}>
        <div style={styles.searchRow}>
          <SearchBar onChange={setQ} />
        </div>

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
        />
      </div>

      {selectedAssetId && (
        <AssetDetailModal
          selectedAssetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}

      <UploadModal
        isOpen={isUploadOpen}
        onClose={onUploadRequestClose}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
