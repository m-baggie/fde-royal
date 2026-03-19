import { useState, useCallback } from 'react';

const LS_IDS_KEY = 'dam_favourites';
const LS_DATA_KEY = 'dam_favourites_data';

function readIds() {
  try {
    const raw = localStorage.getItem(LS_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readData() {
  try {
    const raw = localStorage.getItem(LS_DATA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function useFavourites() {
  const [favouriteIds, setFavouriteIds] = useState(() => readIds());

  const toggle = useCallback((id, assetData) => {
    setFavouriteIds((prev) => {
      let next;
      const data = readData();

      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
        delete data[id];
      } else {
        next = [...prev, id];
        data[id] = {
          display_title: assetData?.display_title ?? null,
          thumbnail_path: assetData?.thumbnail_path ?? null,
          cdn_url: assetData?.cdn_url ?? null,
        };
      }

      localStorage.setItem(LS_IDS_KEY, JSON.stringify(next));
      localStorage.setItem(LS_DATA_KEY, JSON.stringify(data));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(LS_IDS_KEY);
    localStorage.removeItem(LS_DATA_KEY);
    setFavouriteIds([]);
  }, []);

  const isFavourited = useCallback(
    (id) => favouriteIds.includes(id),
    [favouriteIds],
  );

  return {
    favouriteIds,
    isFavourited,
    toggle,
    clear,
    count: favouriteIds.length,
  };
}
