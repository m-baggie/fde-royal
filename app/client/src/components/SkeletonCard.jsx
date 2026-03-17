const styles = {
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: '16/9',
  },
  body: {
    padding: '10px',
  },
  titleLine: {
    height: '14px',
    borderRadius: '4px',
    marginBottom: '8px',
    width: '80%',
  },
  badgeLine: {
    height: '12px',
    borderRadius: '4px',
    width: '50%',
  },
};

export default function SkeletonCard() {
  return (
    <div style={styles.card} data-testid="skeleton-card">
      <div style={styles.image} className="skeleton-shimmer" />
      <div style={styles.body}>
        <div style={styles.titleLine} className="skeleton-shimmer" />
        <div style={styles.badgeLine} className="skeleton-shimmer" />
      </div>
    </div>
  );
}
