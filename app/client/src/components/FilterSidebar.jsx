import { useState } from 'react';

const RIGHTS_OPTIONS = ['owned', 'unclear', 'none'];
const QUALITY_OPTIONS = ['Missing Title', 'Missing Rights', 'Release Placeholder'];

const styles = {
  sidebar: {
    width: '100%',
    boxSizing: 'border-box',
    borderRight: '1px solid #e5e7eb',
    paddingRight: '16px',
  },
  section: {
    marginBottom: '16px',
    borderBottom: '1px solid #f3f4f6',
    paddingBottom: '12px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '6px 0',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    userSelect: 'none',
  },
  arrow: {
    fontSize: '11px',
    color: '#6b7280',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    paddingTop: '8px',
  },
  chip: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    color: '#374151',
  },
  chipActive: {
    backgroundColor: '#001B6B',
    color: '#fff',
    border: '1px solid #001B6B',
  },
  select: {
    width: '100%',
    marginTop: '8px',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#fff',
    color: '#374151',
  },
};

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <span style={styles.arrow}>{open ? '▲' : '▼'}</span>
      </div>
      {open && children}
    </div>
  );
}

function Chips({ options, active, onToggle }) {
  return (
    <div style={styles.chipsRow}>
      {options.map((opt) => {
        const isActive = Array.isArray(active) ? active.includes(opt) : active === opt;
        return (
          <span
            key={opt}
            style={{ ...styles.chip, ...(isActive ? styles.chipActive : {}) }}
            onClick={() => onToggle(opt)}
          >
            {opt}
          </span>
        );
      })}
    </div>
  );
}

export default function FilterSidebar({
  filters,
  activeCategory,
  activeSubcategory,
  activeRights,
  activeLocation,
  activeMetadataQuality,
  activeChannel,
  activeScene,
  activeDestinationRegion,
  activeContentType,
  onFilterChange,
}) {
  const categories = filters?.categories || [];
  const subcategories = activeCategory ? (filters?.subcategories?.[activeCategory] || []) : [];
  const locations = filters?.locations || [];
  const channels = filters?.channels || [];
  const scenes = filters?.scenes || [];
  const destinationRegions = filters?.destination_regions || [];
  const contentTypes = filters?.content_types || [];

  function handleCategoryToggle(val) {
    const next = activeCategory === val ? '' : val;
    onFilterChange('category', next);
    if (activeSubcategory) onFilterChange('subcategory', '');
  }

  function handleSubcategoryToggle(val) {
    onFilterChange('subcategory', activeSubcategory === val ? '' : val);
  }

  function handleRightsToggle(val) {
    onFilterChange('rights', activeRights === val ? '' : val);
  }

  function handleLocationChange(e) {
    onFilterChange('location', e.target.value);
  }

  function handleQualityToggle(val) {
    const next = activeMetadataQuality.includes(val)
      ? activeMetadataQuality.filter((q) => q !== val)
      : [...activeMetadataQuality, val];
    onFilterChange('metadataQuality', next);
  }

  function handleChannelToggle(val) {
    onFilterChange('channel', activeChannel === val ? '' : val);
  }

  function handleSceneToggle(val) {
    const next = activeScene.includes(val)
      ? activeScene.filter((s) => s !== val)
      : [...activeScene, val];
    onFilterChange('scene', next);
  }

  function handleDestinationRegionToggle(val) {
    onFilterChange('destinationRegion', activeDestinationRegion === val ? '' : val);
  }

  function handleContentTypeToggle(val) {
    onFilterChange('contentType', activeContentType === val ? '' : val);
  }

  return (
    <aside style={styles.sidebar}>
      <Section title="Category">
        <Chips
          options={categories}
          active={activeCategory}
          onToggle={handleCategoryToggle}
        />
      </Section>

      {subcategories.length > 0 && (
        <Section title="Subcategory">
          <Chips
            options={subcategories}
            active={activeSubcategory}
            onToggle={handleSubcategoryToggle}
          />
        </Section>
      )}

      <Section title="Rights Status">
        <Chips
          options={RIGHTS_OPTIONS}
          active={activeRights}
          onToggle={handleRightsToggle}
        />
      </Section>

      <Section title="Location">
        <select
          style={styles.select}
          value={activeLocation}
          onChange={handleLocationChange}
        >
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </Section>

      {channels.length > 0 && (
        <Section title="Channel" defaultOpen={false}>
          <Chips
            options={channels}
            active={activeChannel}
            onToggle={handleChannelToggle}
          />
        </Section>
      )}

      {destinationRegions.length > 0 && (
        <Section title="Destination Region" defaultOpen={false}>
          <Chips
            options={destinationRegions}
            active={activeDestinationRegion}
            onToggle={handleDestinationRegionToggle}
          />
        </Section>
      )}

      {contentTypes.length > 0 && (
        <Section title="Content Type" defaultOpen={false}>
          <Chips
            options={contentTypes}
            active={activeContentType}
            onToggle={handleContentTypeToggle}
          />
        </Section>
      )}
    </aside>
  );
}
