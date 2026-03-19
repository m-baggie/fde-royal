import { useState, useCallback } from 'react';
import { TEXT_PRIMARY } from '../styles/tokens';
import { getAssetDownloadUrl } from '../api/assets';

const RIGHTS_PILLS = {
  owned: { bg: '#DCFCE7', color: '#166534', label: 'Owned' },
  unclear: { bg: '#FEF3C7', color: '#92400E', label: 'Unclear' },
  none: { bg: '#FEE2E2', color: '#991B1B', label: 'No Rights' },
};

const styles = {
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '10px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'transform 200ms ease, box-shadow 200ms ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  cardHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4/3',
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
  },
  hoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: '8px 10px',
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    transition: 'opacity 150ms ease',
  },
  actionBtn: {
    color: '#FFFFFF',
    fontSize: '14px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: '6px',
    padding: '4px 8px',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    lineHeight: 1,
  },
  heartBtn: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.35)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    padding: 0,
    transition: 'transform 150ms ease',
  },
  variantBadge: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    backgroundColor: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    color: '#FFFFFF',
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 8px',
    borderRadius: '100px',
    pointerEvents: 'none',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  body: {
    padding: '10px 12px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: TEXT_PRIMARY,
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
    fontWeight: '500',
    padding: '2px 8px',
    borderRadius: '100px',
    backgroundColor: 'rgba(0,27,107,0.07)',
    color: '#001B6B',
  },
  rightsPill: {
    borderRadius: '100px',
    fontSize: '11px',
    fontWeight: '500',
    padding: '2px 8px',
    display: 'inline-block',
  },
  warningIcon: {
    fontSize: '13px',
    marginLeft: 'auto',
  },
};

const API_BASE = '';

const placeholderStyle = {
  width: '100%',
  height: '100%',
  backgroundColor: '#E8E8E8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  color: '#666',
  textAlign: 'center',
  padding: '4px',
  boxSizing: 'border-box',
  wordBreak: 'break-all',
};

export default function AssetCard({ asset, onSelectAsset, isFavourited = false, onFavouriteToggle }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [heartScale, setHeartScale] = useState(1);

  const handleHeartClick = useCallback((e) => {
    e.stopPropagation();
    if (onFavouriteToggle) {
      onFavouriteToggle(asset.id, {
        display_title: asset.display_title,
        thumbnail_path: asset.thumbnail_path,
        cdn_url: asset.cdn_url,
      });
    }
    setHeartScale(1.2);
    setTimeout(() => setHeartScale(1), 150);
  }, [asset, onFavouriteToggle]);

  function handleCopy(e) {
    e.stopPropagation();
    if (!asset.cdn_url) return;
    navigator.clipboard.writeText(asset.cdn_url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const rightsPill = RIGHTS_PILLS[asset.rights_status] || null;
  const hasIssues = Array.isArray(asset.quality_issues) && asset.quality_issues.length > 0;

  const variantCount = asset.variant_count;
  const showVariantBadge = variantCount > 1;

  const thumbnailSrc = asset.thumbnail_path
    ? `${API_BASE}/api/assets/media/${asset.thumbnail_path}`
    : null;

  const showPlaceholder = !thumbnailSrc || imgError;

  return (
    <div
      style={{ ...styles.card, ...(hovered ? styles.cardHover : {}) }}
      data-testid="asset-card"
      onClick={() => onSelectAsset && onSelectAsset(asset.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.imageWrapper}>
        <button
          data-testid="heart-btn"
          style={{ ...styles.heartBtn, transform: `scale(${heartScale})` }}
          onClick={handleHeartClick}
          aria-label={isFavourited ? 'Remove from favourites' : 'Add to favourites'}
        >
          <span style={{ fontSize: '14px', color: isFavourited ? '#EF4444' : '#FFFFFF', lineHeight: 1 }}>
            {isFavourited ? '♥' : '♡'}
          </span>
        </button>
        {showPlaceholder ? (
          <div data-testid="asset-placeholder" style={placeholderStyle}>
            {asset.filename || asset.display_title || 'No preview'}
          </div>
        ) : (
          <img
            src={thumbnailSrc}
            alt={asset.display_title || 'Asset'}
            style={styles.image}
            onError={() => setImgError(true)}
          />
        )}
        {showVariantBadge && (
          <span data-testid="variant-badge" style={styles.variantBadge}>
            +{variantCount - 1} variants
          </span>
        )}
        <div
          data-testid="hover-overlay"
          style={{ ...styles.hoverOverlay, opacity: hovered ? 1 : 0 }}
        >
          <a
            data-testid="download-btn"
            href={getAssetDownloadUrl(asset.id)}
            download
            title="Download"
            style={styles.actionBtn}
            onClick={(e) => e.stopPropagation()}
          >
            ↓
          </a>
          {asset.cdn_url && (
            <button
              data-testid="copy-cdn-btn"
              title={copied ? 'Copied!' : 'Copy CDN URL'}
              style={styles.actionBtn}
              onClick={handleCopy}
            >
              {copied ? '✓' : '⎘'}
            </button>
          )}
        </div>
      </div>
      <div style={styles.body}>
        <p style={styles.title}>{asset.display_title || 'Untitled'}</p>
        <div style={styles.badges}>
          {asset.category && (
            <span style={styles.categoryPill}>{asset.category}</span>
          )}
          {rightsPill && (
            <span
              data-testid="rights-pill"
              style={{ ...styles.rightsPill, backgroundColor: rightsPill.bg, color: rightsPill.color }}
            >
              {rightsPill.label}
            </span>
          )}
          {hasIssues && <span style={styles.warningIcon}>⚠</span>}
        </div>
      </div>
    </div>
  );
}
