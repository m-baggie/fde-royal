import AssetCard from './AssetCard';
import SkeletonCard from './SkeletonCard';

const SKELETON_COUNT = 12;

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '16px',
  },
};

export default function AssetGrid({ assets, loading, onSelectAsset }) {
  if (loading) {
    return (
      <div style={styles.grid}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onSelectAsset={onSelectAsset} />
      ))}
    </div>
  );
}
