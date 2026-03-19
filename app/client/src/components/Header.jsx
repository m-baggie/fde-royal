export default function Header({ onUploadClick }) {
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
          style={{
            height: '36px',
            width: 'auto',
            display: 'block',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span
            style={{
              color: '#001B6B',
              fontWeight: '700',
              fontSize: '15px',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}
          >
            Royal Caribbean
          </span>
          <span
            style={{
              color: '#9CA3AF',
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              lineHeight: 1.2,
            }}
          >
            ASSET
          </span>
        </div>
      </div>

      {/* Upload button */}
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
      >
        + Upload
      </button>
    </header>
  );
}
