import { useState, useEffect } from 'react';
import BrowsePage from './pages/BrowsePage';
import { useFavourites } from './hooks/useFavourites';

export default function App() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const { favouriteIds, isFavourited, toggle: onFavouriteToggle, clear, count } = useFavourites();

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <BrowsePage
        isUploadOpen={uploadOpen}
        onUploadClick={() => setUploadOpen(true)}
        onUploadRequestClose={() => setUploadOpen(false)}
        favouriteIds={favouriteIds}
        isFavourited={isFavourited}
        onFavouriteToggle={onFavouriteToggle}
        clear={clear}
        count={count}
      />
    </div>
  );
}
