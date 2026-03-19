import { useState, useEffect, useRef } from 'react';
import { getAsset, enrichAsset as enrichAssetApi, getAssetVariants, getAssetDownloadUrl, deleteAsset } from '../api/assets';

const NAVY = '#001B6B';
const GOLD = '#C8A84B';

const METADATA_ROWS = [
  { label: 'Title',             origKey: 'original_title',       enrichedKey: 'enriched_title' },
  { label: 'Description',       origKey: 'original_description', enrichedKey: 'enriched_description' },
  { label: 'Location',          origKey: 'original_location',    enrichedKey: 'enriched_location' },
  { label: 'Creator',           origKey: 'original_creator',     enrichedKey: 'enriched_creator_normalized' },
  { label: 'Rights Owner',      origKey: 'original_rights_owner',enrichedKey: null },
  { label: 'Usage Terms',       origKey: 'original_usage_terms', enrichedKey: null },
  { label: 'Channel',           origKey: null,                   enrichedKey: 'enriched_channel' },
  { label: 'Format',            origKey: 'file_format',          enrichedKey: 'enriched_format' },
  { label: 'Destination Region',origKey: null,                   enrichedKey: 'enriched_destination_region' },
  { label: 'Content Type',      origKey: null,                   enrichedKey: 'enriched_content_type' },
];

export default function AssetDetailPanel({ selectedAssetId, onClose, adminMode = false, isFavourited = false, onFavouriteToggle }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [shareLabel, setShareLabel] = useState('↗ Share');
  const [toast, setToast] = useState(null);
  const [metaView, setMetaView] = useState('enriched');
  const [metaOpen, setMetaOpen] = useState(false);
  const [variants, setVariants] = useState([]);
  const [activeVariantId, setActiveVariantId] = useState(null);
  const copyTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const shareTimeoutRef = useRef(null);

  // Fetch full asset on selectedAssetId change
  useEffect(() => {
    if (!selectedAssetId) return;
    setLoading(true);
    setAsset(null);
    setMetaView('enriched');
    setMetaOpen(false);
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

  // Escape key closes panel
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Parse tags for display
  let displayTags = null;
  if (asset?.display_tags) {
    try {
      const parsed = typeof asset.display_tags === 'string' ? JSON.parse(asset.display_tags) : asset.display_tags;
      if (Array.isArray(parsed) && parsed.length > 0) displayTags = parsed;
    } catch {
      // ignore
    }
  }

  return (
    <div
      data-testid="asset-detail-panel"
      style={{
        width: '400px',
        height: '100%',
        borderLeft: '1px solid #E5E7EB',
        backgroundColor: '#FFFFFF',
        overflowY: 'auto',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Close button */}
      <button
        data-testid="panel-close-btn"
        onClick={onClose}
        aria-label="Close"
        title="Close"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          width: '32px',
          height: '32px',
          background: 'none',
          border: 'none',
          fontSize: '20px',
          color: '#9CA3AF',
          cursor: 'pointer',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
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
            padding: '80px 20px',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          <span data-testid="panel-spinner">Loading…</span>
        </div>
      )}

      {!loading && asset && (
        <>
          {/* Image zone */}
          <div
            style={{
              width: '100%',
              aspectRatio: '16/9',
              backgroundColor: '#F3F4F6',
              overflow: 'hidden',
            }}
            data-testid="panel-image-zone"
          >
            {(asset.web_image_path || asset.thumbnail_path) ? (
              <img
                src={`/api/assets/media/${asset.web_image_path || asset.thumbnail_path}`}
                alt={asset.display_title || 'Asset'}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                data-testid="panel-image-placeholder"
                style={{ width: '100%', height: '100%', backgroundColor: '#F3F4F6' }}
              />
            )}
          </div>

          {/* Variant strip — shown below image when variants.length > 1 */}
          {variants.length > 1 && (
            <div style={{ padding: '10px 12px 0' }} data-testid="variant-strip">
              <p
                style={{
                  fontSize: '11px',
                  color: '#9CA3AF',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  margin: '0 0 6px 0',
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

          {/* Content zone */}
          <div
            style={{
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Title row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <h2
                data-testid="panel-display-title"
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                  flex: 1,
                  wordBreak: 'break-word',
                }}
              >
                {asset.display_title || asset.filename}
              </h2>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Download button — text + icon, navy */}
                <a
                  href={getAssetDownloadUrl(asset.id)}
                  download
                  title="Download"
                  data-testid="panel-download-btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: NAVY,
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '13px',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ↓ Download
                </a>

                {/* Share button — text label */}
                <button
                  onClick={handleShare}
                  title="Copy link to asset"
                  data-testid="panel-share-btn"
                  style={{
                    background: 'transparent',
                    border: `1.5px solid ${NAVY}`,
                    color: NAVY,
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shareLabel}
                </button>

                {/* Favourite button — icon only, 32×32, heart ♥/♡, red when active */}
                {onFavouriteToggle && (
                  <button
                    onClick={() => onFavouriteToggle(asset.id, { display_title: asset.display_title, thumbnail_path: asset.thumbnail_path, cdn_url: asset.cdn_url })}
                    title={isFavourited ? 'Remove from saved' : 'Save asset'}
                    data-testid="panel-favourite-btn"
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: isFavourited ? 'rgba(220,38,38,0.1)' : '#F3F4F6',
                      fontSize: '16px',
                      color: isFavourited ? '#DC2626' : '#9CA3AF',
                    }}
                  >
                    {isFavourited ? '♥' : '♡'}
                  </button>
                )}

                {/* Delete button — icon only, 32×32, admin only */}
                {adminMode && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    title="Delete"
                    data-testid="panel-delete-btn"
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
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>

            {/* Tags row — always visible when tags exist */}
            {displayTags && (
              <div data-testid="panel-tags-row">
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#9CA3AF',
                    margin: '0 0 6px 0',
                  }}
                >
                  Tags
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {displayTags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        padding: '2px 8px',
                        borderRadius: '100px',
                        backgroundColor: 'rgba(0,32,91,0.07)',
                        color: '#00205B',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Details accordion — collapsed by default */}
            <div data-testid="details-accordion">
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

              {metaOpen && (
                <div className="accordion-body" style={{ paddingTop: '4px' }}>
                  {/* Enriched / Original pill toggle */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                    <div
                      data-testid="meta-view-toggle"
                      style={{
                        display: 'inline-flex',
                        height: '28px',
                        border: `1.5px solid ${NAVY}`,
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
                            backgroundColor: metaView === view ? NAVY : '#FFFFFF',
                            color: metaView === view ? '#FFFFFF' : NAVY,
                          }}
                        >
                          {view.charAt(0).toUpperCase() + view.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key-value metadata rows */}
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
                              : displayVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* CDN URL section */}
            {asset.cdn_url && (
              <div data-testid="panel-cdn-url">
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
                    data-testid="cdn-url-code"
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
                  >
                    {asset.cdn_url}
                  </code>
                  <button
                    onClick={handleCopy}
                    title="Copy CDN URL to clipboard"
                    data-testid="copy-cdn-btn"
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
                  >
                    {copyLabel}
                  </button>
                </div>
              </div>
            )}

            {/* Enrich with AI */}
            {showEnrichButton && (
              <button
                onClick={handleEnrich}
                disabled={enriching}
                title="Use AI vision to generate title, description, tags and location for this asset"
                data-testid="enrich-btn"
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
                }}
              >
                {enriching ? '⟳ Enriching...' : 'Enrich with AI'}
              </button>
            )}

            {/* Toast */}
            {toast && (
              <div
                data-testid="enrich-toast"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                {toast}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
