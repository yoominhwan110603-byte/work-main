import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Search, Bell, Heart, X } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import type { Album } from '../data/mockData';
import AlbumCard from '../components/AlbumCard';
import VinylImage from '../components/VinylImage';

export default function HomeScreen() {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>(mockAlbums);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const apiBase = `${window.location.protocol}//${window.location.hostname}:8000`;
    fetch(`${apiBase}/listings`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: Album[]) => {
        if (Array.isArray(data) && data.length > 0) setAlbums(data);
      })
      .catch(() => undefined);
  }, []);

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const normalizedQuery = query.trim().toLowerCase();
  const searchedAlbums = normalizedQuery
    ? albums.filter(album =>
        [
          album.title,
          album.artist,
          album.genre,
          album.catalogNumber,
          album.location,
          album.audioGrade,
        ].some(value => value.toLowerCase().includes(normalizedQuery))
      )
    : albums;

  const recommendedAlbums = searchedAlbums.filter(a => a.genre === '재즈').slice(0, 3);
  const recentAlbums = searchedAlbums.slice(0, 4);
  const rareAlbums = searchedAlbums.filter(a => a.isRare);
  const popularAlbums = [...searchedAlbums].sort((a, b) => b.views - a.views).slice(0, 4);

  return (
    <div className="size-full bg-gray-50 overflow-y-auto">
      <header className="bg-white px-4 py-4 border-b sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl">Vinyl-Check</h1>
          <div className="flex gap-3">
            <button onClick={() => navigate('/app/notifications')} className="p-2 relative">
              <Bell size={24} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
        <div className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 rounded-lg">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            placeholder="앨범명, 아티스트, 장르 검색"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1" aria-label="검색어 지우기">
              <X size={18} className="text-gray-400" />
            </button>
          )}
        </div>
      </header>

      <div className="pb-4">
        {query && (
          <section className="px-4 py-3 bg-white border-b">
            <p className="text-sm text-gray-600">
              "{query}" 검색 결과 {searchedAlbums.length}개
            </p>
          </section>
        )}

        {query && searchedAlbums.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-gray-600">검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400 mt-2">앨범명, 아티스트, 장르, 카탈로그 번호로 다시 검색해보세요</p>
          </div>
        ) : (
          <>
        <section className="py-4">
          <div className="px-4 mb-3 flex items-center justify-between">
            <h2 className="text-lg">당신을 위한 추천</h2>
          </div>
          <div className="px-4 grid grid-cols-1 gap-3">
            {recommendedAlbums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                isFavorite={favorites.has(album.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>

        <section className="py-4 bg-white">
          <div className="px-4 mb-3 flex items-center justify-between">
            <h2 className="text-lg">최근 등록</h2>
            <Link to="/app/search/results?sort=recent" className="text-sm text-blue-600">
              더보기
            </Link>
          </div>
          <div className="overflow-x-auto px-4">
            <div className="flex gap-3 pb-2">
              {recentAlbums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => navigate(`/app/album/${album.id}`)}
                  className="flex-shrink-0 w-40 cursor-pointer"
                >
                  <div className="relative mb-2">
                    <VinylImage
                      src={album.images[0]}
                      alt={album.title}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                    {album.isRare && (
                      <span className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                        희귀판
                      </span>
                    )}
                  </div>
                  <p className="text-sm truncate">{album.title}</p>
                  <p className="text-xs text-gray-500 truncate">{album.artist}</p>
                  <p className="text-sm mt-1">{album.price.toLocaleString()}원</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-4">
          <div className="px-4 mb-3 flex items-center justify-between">
            <h2 className="text-lg">희귀판 매물</h2>
            <Link to="/app/search/results?rare=true" className="text-sm text-blue-600">
              더보기
            </Link>
          </div>
          <div className="px-4 grid grid-cols-1 gap-3">
            {rareAlbums.slice(0, 2).map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                isFavorite={favorites.has(album.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>

        <section className="py-4 bg-white">
          <div className="px-4 mb-3 flex items-center justify-between">
            <h2 className="text-lg">인기 매물</h2>
            <Link to="/app/search/results?sort=popular" className="text-sm text-blue-600">
              더보기
            </Link>
          </div>
          <div className="px-4 grid grid-cols-2 gap-3">
            {popularAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => navigate(`/app/album/${album.id}`)}
                className="cursor-pointer"
              >
                <div className="relative mb-2">
                  <VinylImage
                    src={album.images[0]}
                    alt={album.title}
                    className="w-full aspect-square object-cover rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(album.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full"
                  >
                    <Heart
                      size={16}
                      className={favorites.has(album.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}
                    />
                  </button>
                </div>
                <p className="text-sm truncate">{album.title}</p>
                <p className="text-xs text-gray-500 truncate">{album.artist}</p>
                <p className="text-sm mt-1">{album.price.toLocaleString()}원</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {album.audioGrade}
                  </span>
                  <span className="text-xs text-gray-500">조회 {album.views}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
