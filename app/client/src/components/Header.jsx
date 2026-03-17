const styles = {
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '64px',
    backgroundColor: '#001B6B',
    borderBottom: '3px solid #C8960C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 100,
    boxSizing: 'border-box',
  },
  branding: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: '20px',
    lineHeight: 1.2,
    margin: 0,
  },
  subtitle: {
    color: '#C8960C',
    fontSize: '12px',
    lineHeight: 1.2,
    margin: 0,
  },
  uploadButton: {
    backgroundColor: '#C8960C',
    color: '#FFFFFF',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
};

export default function Header({ onUploadClick }) {
  return (
    <header style={styles.header}>
      <div style={styles.branding}>
        <span style={styles.title}>Royal Caribbean</span>
        <span style={styles.subtitle}>DAM Asset Intelligence</span>
      </div>
      <button style={styles.uploadButton} onClick={onUploadClick}>
        Upload
      </button>
    </header>
  );
}
