import { useState } from 'react';
import FavouritesDropdown from './FavouritesDropdown';

export default function Header({ onUploadClick, adminMode = false, count = 0, onFavouriteIconClick = () => {}, onFavouriteToggle = () => {}, clear = () => {}, onSelectAsset = () => {} }) {
  const [isOpen, setIsOpen] = useState(false);

  function handleFavIconClick() {
    setIsOpen((prev) => !prev);
    onFavouriteIconClick();
  }

  function handleClose() {
    setIsOpen(false);
  }

  return (
    <header
      style={{
        height: '60px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {/* Logo + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/royal-logo.png"
          alt="Royal Caribbean"
          style={{ height: '36px', width: 'auto', display: 'block' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ color: '#001B6B', fontWeight: '700', fontSize: '15px', letterSpacing: '0.02em', lineHeight: 1.2 }}>
            Royal Caribbean
          </span>
          <span style={{ color: '#9CA3AF', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>
            Asset Search & Intelligence
          </span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Upload button — admin only */}
        {adminMode && (
          <button
            style={{
              backgroundColor: '#001B6B',
              color: '#FFFFFF',
              border: 'none',
              padding: '9px 22px',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              letterSpacing: '0.02em',
            }}
            onClick={onUploadClick}
            data-testid="upload-btn"
          >
            + Upload
          </button>
        )}

        {/* Favourites icon */}
        <div style={{ position: 'relative' }}>
          <button
            data-testid="favourites-icon-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleFavIconClick}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
            aria-label="Favourites"
          >
            <span style={{ fontSize: '20px', color: '#C8A84B', lineHeight: 1 }}>★</span>
            {count > 0 && (
              <span
                data-testid="favourites-badge"
                style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#001B6B',
                  borderRadius: '50%',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {count}
              </span>
            )}
          </button>

          {isOpen && (
            <FavouritesDropdown
              count={count}
              onFavouriteToggle={onFavouriteToggle}
              onClear={clear}
              onClose={handleClose}
              onSelectAsset={(id) => { onSelectAsset(id); handleClose(); }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
