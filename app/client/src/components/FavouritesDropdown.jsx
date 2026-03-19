import { useState, useEffect, useRef } from 'react';

const LS_IDS_KEY = 'dam_favourites';
const LS_DATA_KEY = 'dam_favourites_data';
const MEDIA_BASE = 'http://localhost:3001/api/assets/media';

function readIds() {
  try {
    const raw = localStorage.getItem(LS_IDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function readData() {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function FavouritesDropdown({ count, onFavouriteToggle, onClear, onClose, onSelectAsset = () => {} }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const ids = readIds();
  const data = readData();

  useEffect(() => {
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  function handleExport() {
    ids.forEach((id, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/api/assets/${encodeURIComponent(id)}/download`;
        a.download = data[id]?.display_title || id;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 300);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShareAll() {
    const urls = ids.map((id) => `${window.location.origin}/?asset=${encodeURIComponent(id)}`);
    navigator.clipboard.writeText(urls.join('\n')).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    });
  }

  function handleClearAll() {
    onClear();
    onClose();
  }

  return (
    <div
      ref={ref}
      data-testid="favourites-dropdown"
      style={{
        position: 'absolute',
        top: '48px',
        right: 0,
        width: '320px',
        maxHeight: '480px',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(11,21,96,0.14), 0 2px 8px rgba(11,21,96,0.06)',
        zIndex: 200,
      }}
    >
      {/* Dropdown header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid #F3F4F6',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Favourites</span>
        <span style={{ fontSize: '13px', color: '#9CA3AF' }}>{count}</span>
      </div>

      {/* Empty state */}
      {ids.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px', color: '#C8A84B' }}>★</div>
          <div style={{ fontSize: '13px', color: '#9CA3AF' }}>No favourites yet</div>
        </div>
      ) : (
        <>
          {/* Items */}
          <div>
            {ids.map((id) => {
              const item = data[id] || {};
              return (
                <div
                  key={id}
                  onClick={() => onSelectAsset(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                  }}
                >
                  {item.thumbnail_path ? (
                    <img
                      src={`${MEDIA_BASE}/${item.thumbnail_path}`}
                      alt={item.display_title || ''}
                      style={{
                        width: '44px',
                        height: '44px',
                        objectFit: 'cover',
                        borderRadius: '6px',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        backgroundColor: '#F3F4F6',
                        borderRadius: '6px',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#111827',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                    }}
                  >
                    {item.display_title || id}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFavouriteToggle(id); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      fontSize: '16px',
                      flexShrink: 0,
                      padding: '0',
                      lineHeight: 1,
                    }}
                    aria-label={`Remove ${item.display_title || id} from favourites`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid #F3F4F6',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              onClick={handleClearAll}
              style={{
                fontSize: '12px',
                color: '#9CA3AF',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Clear all
            </button>
            <button
              onClick={handleExport}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#001B6B',
                backgroundColor: 'rgba(0,27,107,0.07)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Downloading...' : 'Export Images'}
            </button>
            <button
              onClick={handleShareAll}
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#001B6B',
                backgroundColor: 'transparent',
                border: '1.5px solid #001B6B',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {shared ? '✓ Copied!' : '↗ Share All'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
