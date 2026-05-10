import { useState } from 'react';
import { mockAlbums } from '../data/mockData';
import AlbumCard from '../components/AlbumCard';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(mockAlbums.slice(0, 3).map(a => a.id))
  );

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const favoriteAlbums = mockAlbums.filter(album => favorites.has(album.id));

  return (
    <div className="size-full bg-gray-50 overflow-y-auto">
      <header className="bg-white px-4 py-4 border-b sticky top-0">
        <h1 className="text-2xl">찜한 상품</h1>
        <p className="text-sm text-gray-600 mt-1">{favoriteAlbums.length}개</p>
      </header>

      {favoriteAlbums.length > 0 ? (
        <div className="p-4 space-y-3">
          {favoriteAlbums.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              isFavorite={true}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <svg className="w-20 h-20 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <h2 className="text-lg text-gray-600 mb-2">찜한 상품이 없습니다</h2>
          <p className="text-sm text-gray-500">마음에 드는 LP를 찜해보세요</p>
        </div>
      )}
    </div>
  );
}
