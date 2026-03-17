import { useState } from 'react';

const RIGHTS_COLORS = {
  owned: '#22c55e',
  unclear: '#f59e0b',
  none: '#ef4444',
};

const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardHover: {
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  body: {
    padding: '10px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#1A1A2E',
    margin: '0 0 6px 0',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: 1.4,
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  categoryPill: {
    fontSize: '11px',
    padding: '2px 7px',
    borderRadius: '10px',
    backgroundColor: '#e8eaf6',
    color: '#3949ab',
    fontWeight: '500',
  },
  rightsDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  warningIcon: {
    fontSize: '13px',
    marginLeft: 'auto',
  },
};

export default function AssetCard({ asset, onSelectAsset }) {
  const [hovered, setHovered] = useState(false);

  const rightsColor = RIGHTS_COLORS[asset.rights_status] || '#9ca3af';
  const hasIssues = Array.isArray(asset.quality_issues) && asset.quality_issues.length > 0;

  return (
    <div
      style={{ ...styles.card, ...(hovered ? styles.cardHover : {}) }}
      data-testid="asset-card"
      onClick={() => onSelectAsset && onSelectAsset(asset.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.imageWrapper}>
        {asset.thumbnail_path ? (
          <img
            src={asset.thumbnail_path}
            alt={asset.display_title || 'Asset'}
            style={styles.image}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#E8E8E8' }} />
        )}
      </div>
      <div style={styles.body}>
        <p style={styles.title}>{asset.display_title || 'Untitled'}</p>
        <div style={styles.badges}>
          {asset.category && (
            <span style={styles.categoryPill}>{asset.category}</span>
          )}
          <span
            style={{ ...styles.rightsDot, backgroundColor: rightsColor }}
            title={asset.rights_status || 'unknown'}
          />
          {hasIssues && <span style={styles.warningIcon}>⚠</span>}
        </div>
      </div>
    </div>
  );
}
