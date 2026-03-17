import { useState, useEffect, useRef } from 'react';
import { getAsset, enrichAsset as enrichAssetApi } from '../api/assets';

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
  { label: 'Tags',        origKey: 'original_tags',        enrichedKey: 'enriched_tags' },
  { label: 'Location',    origKey: 'original_location',    enrichedKey: 'enriched_location' },
  { label: 'Creator',     origKey: 'original_creator',     enrichedKey: 'enriched_creator_normalized' },
  { label: 'Rights Owner',origKey: 'original_rights_owner',enrichedKey: null },
  { label: 'Usage Terms', origKey: 'original_usage_terms', enrichedKey: null },
  { label: 'Channel',     origKey: null,                   enrichedKey: 'enriched_channel' },
  { label: 'Format',      origKey: 'file_format',          enrichedKey: 'enriched_format' },
];

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetDetailModal({ selectedAssetId, onClose }) {
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [toast, setToast] = useState(null);
  const copyTimeoutRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Fetch full asset on open
  useEffect(() => {
    if (!selectedAssetId) return;
    setLoading(true);
    setAsset(null);
    getAsset(selectedAssetId)
      .then((data) => {
        setAsset(data);
        setLoading(false);
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
    };
  }, []);

  function handleCopy() {
    if (!asset?.cdn_url) return;
    navigator.clipboard.writeText(asset.cdn_url);
    setCopyLabel('Copied!');
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopyLabel('Copy'), 2000);
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
                    src={`http://localhost:3001/api/assets/media/${asset.web_image_path || asset.thumbnail_path}`}
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
            </div>

            {/* Right panel — 60% */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', paddingTop: '40px' }}>
              {/* Asset title */}
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#1A1A2E',
                  margin: '0 0 16px 0',
                }}
                data-testid="modal-display-title"
              >
                {asset.display_title || asset.filename}
              </h2>

              {/* Metadata comparison table */}
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  marginBottom: '24px',
                  fontSize: '13px',
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width: '100px',
                        textAlign: 'left',
                        padding: '6px 8px',
                        color: '#6b7280',
                        fontWeight: '600',
                        borderBottom: '2px solid #e5e7eb',
                      }}
                    >
                      Field
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        color: NAVY,
                        fontWeight: '600',
                        borderBottom: '2px solid #e5e7eb',
                      }}
                    >
                      Original
                    </th>
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        color: NAVY,
                        fontWeight: '600',
                        borderBottom: '2px solid #e5e7eb',
                      }}
                    >
                      Enriched
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {METADATA_ROWS.map(({ label, origKey, enrichedKey }) => {
                    const origVal = origKey ? (asset[origKey] ?? null) : null;
                    const enrichedVal = enrichedKey ? (asset[enrichedKey] ?? null) : null;
                    const isImproved = enrichedVal !== null && enrichedVal !== origVal;
                    return (
                      <tr key={label} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td
                          style={{
                            padding: '6px 8px',
                            color: '#6b7280',
                            fontWeight: '500',
                            verticalAlign: 'top',
                          }}
                        >
                          {label}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#374151', verticalAlign: 'top' }}>
                          {origVal != null ? origVal : <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                        <td
                          style={{
                            padding: '6px 8px',
                            color: enrichedVal != null ? NAVY : '#9ca3af',
                            verticalAlign: 'top',
                            borderLeft: isImproved ? `3px solid ${GOLD}` : undefined,
                          }}
                        >
                          {enrichedVal != null ? enrichedVal : <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Quality Issues */}
              {Array.isArray(asset.quality_issues) && asset.quality_issues.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#374151',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Quality Issues
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {asset.quality_issues.map((issue) => {
                      const isRed = RED_ISSUES.includes(issue);
                      return (
                        <span
                          key={issue}
                          data-testid={`quality-badge-${issue}`}
                          style={{
                            fontSize: '12px',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            backgroundColor: isRed ? '#fee2e2' : '#fef3c7',
                            color: isRed ? '#dc2626' : '#92400e',
                            fontWeight: '500',
                          }}
                        >
                          {QUALITY_BADGE_LABELS[issue] || issue}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

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
