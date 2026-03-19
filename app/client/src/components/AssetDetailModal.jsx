import { useState, useEffect, useRef } from 'react';
import { TEXT_MUTED } from '../styles/tokens';
import { getAsset, enrichAsset as enrichAssetApi, getAssetVariants, getAssetDownloadUrl, deleteAsset } from '../api/assets';

const NAVY = '#001B6B';
const GOLD = '#C8A84B';

const QUALITY_BADGE_LABELS = {
  missing_title: 'Missing Title',
  missing_description: 'Missing Description',
  missing_creator: 'Missing Creator',
  missing_rights: 'No Rights Data',
  release_placeholder: 'Release Placeholder — Review Required',
  s7_sync_error: 'CDN Sync Error',
};

const RED_ISSUES = ['release_placeholder', 'missing_rights'];

const METADATA_ROWS = [
  { label: 'Title',       origKey: 'original_title',       enrichedKey: 'enriched_title' },
  { label: 'Description', origKey: 'original_description', enrichedKey: 'enriched_description' },
  { label: 'Location',    origKey: 'original_location',    enrichedKey: 'enriched_location' },
  { label: 'Creator',     origKey: 'original_creator',     enrichedKey: 'enriched_creator_normalized' },
  { label: 'Rights Owner',origKey: 'original_rights_owner',enrichedKey: null },
  { label: 'Usage Terms', origKey: 'original_usage_terms', enrichedKey: null },
  { label: 'Channel',            origKey: null,                   enrichedKey: 'enriched_channel' },
  { label: 'Format',             origKey: 'file_format',          enrichedKey: 'enriched_format' },
  { label: 'Destination Region', origKey: null,                   enrichedKey: 'enriched_destination_region' },
  { label: 'Content Type',       origKey: null,                   enrichedKey: 'enriched_content_type' },
];

function formatCellValue(label, value) {
  if (label === 'Tags' && value) {
    try {
      const arr = typeof value === 'string' ? JSON.parse(value) : value;
      if (Array.isArray(arr)) {
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {arr.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  backgroundColor: 'rgba(0, 32, 91, 0.07)',
                  color: '#00205B',
                  fontWeight: '500',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        );
      }
    } catch {}
  }
  return value;
}

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetDetailModal({ selectedAssetId, onClose, adminMode = false, isFavourited = false, onFavouriteToggle }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [shareLabel, setShareLabel] = useState('↗ Share');
  const [toast, setToast] = useState(null);
  const [metaView, setMetaView] = useState('enriched');
  const [metaOpen, setMetaOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [variants, setVariants] = useState([]);
  const [activeVariantId, setActiveVariantId] = useState(null);
  const copyTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const shareTimeoutRef = useRef(null);

  // Fetch full asset on open
  useEffect(() => {
    if (!selectedAssetId) return;
    setLoading(true);
    setAsset(null);
    setMetaView('enriched');
    setMetaOpen(true);
    setTagsOpen(false);
    setVariants([]);
    setActiveVariantId(selectedAssetId);
    getAsset(selectedAssetId)
      .then((data) => {
        setAsset(data);
        setLoading(false);
        if (data.variant_group_id) {
          getAssetVariants(data.id)
            .then((v) => setVariants(Array.isArray(v) ? v : []))
            .catch(() => setVariants([]));
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [selectedAssetId]);

  // ESC key listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    };
  }, []);

  function handleCopy() {
    if (!asset?.cdn_url) return;
    navigator.clipboard.writeText(asset.cdn_url);
    setCopyLabel('Copied!');
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyLabel('Copy'), 2000);
  }

  function handleShare() {
    if (!asset?.id) return;
    const url = window.location.origin + '/?asset=' + encodeURIComponent(asset.id);
    navigator.clipboard.writeText(url);
    setShareLabel('✓ Copied!');
    if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
    shareTimeoutRef.current = setTimeout(() => setShareLabel('↗ Share'), 2000);
  }

  function handleEnrich() {
    if (!asset || enriching) return;
    setEnriching(true);
    enrichAssetApi(asset.id)
      .then(() => getAsset(asset.id))
      .then((data) => {
        setAsset(data);
        setEnriching(false);
      })
      .catch((err) => {
        setEnriching(false);
        const status = err?.response?.status;
        if (status === 503) {
          setToast('Enrichment unavailable — add OPENAI_API_KEY to .env');
          if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
          toastTimeoutRef.current = setTimeout(() => setToast(null), 4000);
        }
      });
  }

  function handleDelete() {
    if (!asset || deleting) return;
    if (!window.confirm(`Delete "${asset.display_title || asset.filename}"? This cannot be undone.`)) return;
    setDeleting(true);
    deleteAsset(asset.id)
      .then(() => onClose())
      .catch(() => setDeleting(false));
  }

  function handleVariantClick(variantId) {
    if (variantId === activeVariantId) return;
    setActiveVariantId(variantId);
    getAsset(variantId).then((data) => setAsset(data));
  }

  const showEnrichButton =
    asset && (asset.enrichment_source === null || asset.enrichment_source === undefined || asset.enrichment_source === 'pending');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      data-testid="asset-detail-overlay"
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          maxWidth: '1100px',
          width: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          position: 'relative',
        }}
        data-testid="asset-detail-modal"
      >
        {/* Close button */}
        <button
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '22px',
            cursor: 'pointer',
            color: '#6b7280',
            zIndex: 10,
            lineHeight: 1,
          }}
          onClick={onClose}
          aria-label="Close"
          title="Close"
          data-testid="modal-close-btn"
        >
          ×
        </button>

        {/* Loading spinner */}
        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '80px',
              fontSize: '14px',
              color: '#6b7280',
            }}
          >
            <span data-testid="modal-spinner">Loading…</span>
          </div>
        )}

        {/* Content panels */}
        {!loading && asset && (
          <>
            {/* Left panel — 40% */}
            <div
              style={{
                width: '40%',
                flexShrink: 0,
                padding: '24px',
                borderRight: '1px solid #e5e7eb',
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {/* Image */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  backgroundColor: '#E8E8E8',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '16px',
                }}
              >
                {(asset.web_image_path || asset.thumbnail_path) ? (
                  <img
                    src={`/api/assets/media/${asset.web_image_path || asset.thumbnail_path}`}
                    alt={asset.display_title || 'Asset'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#E8E8E8' }} />
                )}
              </div>

              {/* Filename */}
              <p
                style={{
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: '#1A1A2E',
                  margin: '0 0 8px 0',
                  wordBreak: 'break-all',
                }}
              >
                {asset.filename}
              </p>

              {/* Dimensions */}
              {asset.width && asset.height && (
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px 0' }}>
                  {asset.width} × {asset.height} px
                </p>
              )}

              {/* File size */}
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 8px 0' }}>
                {formatFileSize(asset.file_size)}
              </p>

              {/* Format badge */}
              {asset.file_format && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: '#e8eaf6',
                    color: '#3949ab',
                    fontWeight: '500',
                  }}
                >
                  {asset.file_format}
                </span>
              )}

              {/* Variant thumbnail strip */}
              {variants.length > 1 && (
                <div style={{ marginTop: '16px' }} data-testid="variant-strip">
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#9CA3AF',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      margin: '0 0 8px 0',
                    }}
                    data-testid="variant-strip-header"
                  >
                    Variants ({variants.length})
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      overflowX: 'auto',
                      gap: '6px',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {variants.map((v) => {
                      const isActive = v.id === activeVariantId;
                      return (
                        <img
                          key={v.id}
                          src={`/api/assets/media/${v.web_image_path || v.thumbnail_path}`}
                          alt={v.display_title || v.filename}
                          onClick={() => handleVariantClick(v.id)}
                          title={v.display_title || v.filename}
                          data-testid={`variant-thumb-${v.id}`}
                          style={{
                            width: '64px',
                            height: '64px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            border: isActive ? `2px solid ${NAVY}` : '2px solid transparent',
                            opacity: isActive ? 1 : 0.75,
                            transition: 'opacity 150ms ease, border-color 150ms ease',
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right panel — 60% */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', paddingTop: '40px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* Asset title + actions */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#1A1A2E',
                    margin: 0,
                    flex: 1,
                  }}
                  data-testid="modal-display-title"
                >
                  {asset.display_title || asset.filename}
                </h2>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {onFavouriteToggle && (
                    <button
                      onClick={() => onFavouriteToggle(asset.id, { display_title: asset.display_title, thumbnail_path: asset.thumbnail_path, cdn_url: asset.cdn_url })}
                      title={isFavourited ? 'Remove from saved' : 'Save asset'}
                      style={{
                        width: '32px', height: '32px', display: 'inline-flex', alignItems: 'center',
                        justifyContent: 'center', border: 'none', borderRadius: '8px', cursor: 'pointer',
                        backgroundColor: isFavourited ? 'rgba(200,168,75,0.15)' : '#F3F4F6',
                        fontSize: '16px',
                        filter: isFavourited ? 'drop-shadow(0 0 4px rgba(200,168,75,0.5))' : 'none',
                      }}
                    >
                      {isFavourited ? '★' : '☆'}
                    </button>
                  )}
                  <a
                    href={getAssetDownloadUrl(asset.id)}
                    download
                    title="Download"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      backgroundColor: NAVY,
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '13px',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    data-testid="download-btn"
                  >
                    ↓ Download
                  </a>
                  <button
                    onClick={handleShare}
                    title="Copy link to asset"
                    style={{
                      background: 'transparent',
                      border: '1.5px solid #001B6B',
                      color: '#001B6B',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    data-testid="share-btn"
                  >
                    {shareLabel}
                  </button>
                  {adminMode && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      title="Delete"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#FEE2E2',
                        color: deleting ? '#9ca3af' : '#DC2626',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        cursor: deleting ? 'not-allowed' : 'pointer',
                      }}
                      data-testid="delete-btn"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {/* Details accordion */}
              <div style={{ marginBottom: '24px' }}>
                {/* Accordion header */}
                <button
                  data-testid="details-accordion-header"
                  onClick={() => setMetaOpen((o) => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    borderTop: '1px solid #F3F4F6',
                    padding: '8px 0',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Details</span>
                  <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{metaOpen ? '▲' : '▼'}</span>
                </button>

                {/* Accordion body — only rendered when open */}
                {metaOpen && (
                  <div className="accordion-body" style={{ paddingTop: '4px' }}>
                    {/* Enriched / Original pill toggle */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <div
                        data-testid="meta-view-toggle"
                        style={{
                          display: 'inline-flex',
                          height: '28px',
                          border: '1.5px solid #001B6B',
                          borderRadius: '100px',
                          overflow: 'hidden',
                        }}
                      >
                        {['enriched', 'original'].map((view) => (
                          <button
                            key={view}
                            data-testid={`meta-view-${view}`}
                            onClick={() => setMetaView(view)}
                            style={{
                              width: '72px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              borderRadius: '100px',
                              border: 'none',
                              backgroundColor: metaView === view ? '#001B6B' : '#FFFFFF',
                              color: metaView === view ? '#FFFFFF' : '#001B6B',
                            }}
                          >
                            {view.charAt(0).toUpperCase() + view.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Key-value list */}
                    <div>
                      {METADATA_ROWS.map(({ label, origKey, enrichedKey }) => {
                        const origVal = origKey ? (asset[origKey] ?? null) : null;
                        const enrichedVal = enrichedKey ? (asset[enrichedKey] ?? null) : null;
                        let displayVal;
                        let isEmpty;
                        if (metaView === 'enriched') {
                          displayVal = enrichedVal ?? origVal;
                          isEmpty = displayVal === null;
                        } else {
                          displayVal = origVal;
                          isEmpty = origVal === null || origVal === '';
                        }
                        return (
                          <div
                            key={label}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              padding: '8px 0',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: '600',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                color: '#9CA3AF',
                                width: '110px',
                                flexShrink: 0,
                                paddingTop: '1px',
                              }}
                            >
                              {label}
                            </span>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: '400',
                                color: isEmpty ? '#9CA3AF' : '#111827',
                                flex: 1,
                              }}
                            >
                              {isEmpty
                                ? metaView === 'enriched'
                                  ? <span style={{ fontStyle: 'italic' }}>Not enriched</span>
                                  : '—'
                                : formatCellValue(label, displayVal)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}
              </div>

              {/* Tags accordion — enriched view only */}
              {metaView === 'enriched' && (() => {
                const rawTags = asset.display_tags;
                if (!rawTags) return null;
                let tags;
                try { tags = typeof rawTags === 'string' ? JSON.parse(rawTags) : rawTags; } catch { return null; }
                if (!Array.isArray(tags) || tags.length === 0) return null;
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <button
                      onClick={() => setTagsOpen((o) => !o)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', background: 'none', border: 'none',
                        borderTop: '1px solid #F3F4F6', padding: '8px 0', cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Tags</span>
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{tagsOpen ? '▲' : '▼'}</span>
                    </button>
                    {tagsOpen && (
                      <div className="accordion-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingTop: '8px' }}>
                        {tags.map((tag) => (
                          <span key={tag} style={{ fontSize: '11px', fontWeight: '500', padding: '2px 8px', borderRadius: '100px', backgroundColor: 'rgba(0,32,91,0.07)', color: '#00205B' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* CDN URL */}
              {asset.cdn_url && (
                <div style={{ marginBottom: '24px' }}>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      margin: '0 0 8px 0',
                    }}
                  >
                    CDN URL
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <code
                      style={{
                        flex: 1,
                        fontSize: '12px',
                        backgroundColor: '#f3f4f6',
                        padding: '8px',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        color: '#374151',
                        fontFamily: 'monospace',
                      }}
                      data-testid="cdn-url-code"
                    >
                      {asset.cdn_url}
                    </code>
                    <button
                      style={{
                        padding: '6px 14px',
                        backgroundColor: NAVY,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                      onClick={handleCopy}
                      title="Copy CDN URL to clipboard"
                      data-testid="copy-cdn-btn"
                    >
                      {copyLabel}
                    </button>
                  </div>
                </div>
              )}

              {/* Enrich with AI */}
              {showEnrichButton && (
                <button
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 18px',
                    backgroundColor: GOLD,
                    color: '#1A1A2E',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: enriching ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '16px',
                  }}
                  onClick={handleEnrich}
                  disabled={enriching}
                  title="Use AI vision to generate title, description, tags and location for this asset"
                  data-testid="enrich-btn"
                >
                  {enriching ? '⟳ Enriching...' : 'Enrich with AI'}
                </button>
              )}

              {/* Toast */}
              {toast && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                  data-testid="enrich-toast"
                >
                  {toast}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
