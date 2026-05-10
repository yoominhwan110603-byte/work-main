import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import AlbumCard from '../components/AlbumCard';

export default function SearchResultScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const [filters, setFilters] = useState({
    genres: [] as string[],
    priceMin: '',
    priceMax: '',
    audioGrade: [] as string[],
    rareOnly: false,
    location: '',
  });

  const [sortBy, setSortBy] = useState('recent');

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  const genres = ['재즈', '락/팝', '힙합', '클래식', 'R&B/소울'];
  const grades = ['NM', 'VG+', 'VG', 'G+'];
  const sortOptions = [
    { value: 'recent', label: '최신순' },
    { value: 'price-low', label: '낮은 가격순' },
    { value: 'price-high', label: '높은 가격순' },
    { value: 'audio-grade', label: '음질 등급 높은 순' },
    { value: 'popular', label: '인기순' },
  ];

  const gradeScore: Record<string, number> = {
    NM: 4,
    'VG+': 3,
    VG: 2,
    'G+': 1,
  };

  const updateQuery = (value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set('q', value);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const filteredAlbums = mockAlbums
    .filter(album => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesQuery = !normalizedQuery || [
        album.title,
        album.artist,
        album.genre,
        album.catalogNumber,
        album.location,
      ].some(value => value.toLowerCase().includes(normalizedQuery));

      const min = filters.priceMin ? Number(filters.priceMin) : null;
      const max = filters.priceMax ? Number(filters.priceMax) : null;

      return (
        matchesQuery &&
        (filters.genres.length === 0 || filters.genres.includes(album.genre)) &&
        (filters.audioGrade.length === 0 || filters.audioGrade.includes(album.audioGrade)) &&
        (!filters.rareOnly || album.isRare) &&
        (!filters.location.trim() || album.location.includes(filters.location.trim())) &&
        (min === null || album.price >= min) &&
        (max === null || album.price <= max)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'audio-grade':
          return (gradeScore[b.audioGrade] ?? 0) - (gradeScore[a.audioGrade] ?? 0) || b.audioScore - a.audioScore;
        case 'popular':
          return b.views - a.views;
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <Search size={18} className="text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => updateQuery(e.target.value)}
                className="w-full bg-transparent outline-none"
                placeholder="앨범명, 아티스트, 장르, 판본번호"
                autoFocus
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg"
          >
            <SlidersHorizontal size={18} />
            <span className="text-sm">필터</span>
          </button>
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg"
          >
            <span className="text-sm">
              {sortOptions.find(o => o.value === sortBy)?.label}
            </span>
            <ChevronDown size={18} />
          </button>
        </div>
      </header>

      {showFilters && (
        <div className="px-4 py-4 border-b bg-gray-50 space-y-4">
          <div>
            <h3 className="text-sm mb-2">장르</h3>
            <div className="flex flex-wrap gap-2">
              {genres.map(genre => (
                <button
                  key={genre}
                  onClick={() => {
                    const newGenres = filters.genres.includes(genre)
                      ? filters.genres.filter(g => g !== genre)
                      : [...filters.genres, genre];
                    setFilters({ ...filters, genres: newGenres });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm ${
                    filters.genres.includes(genre)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-2">가격 범위</h3>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="최소"
                value={filters.priceMin}
                onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-lg"
              />
              <span>~</span>
              <input
                type="number"
                placeholder="최대"
                value={filters.priceMax}
                onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm mb-2">음질 등급</h3>
            <div className="flex gap-2">
              {grades.map(grade => (
                <button
                  key={grade}
                  onClick={() => {
                    const newGrades = filters.audioGrade.includes(grade)
                      ? filters.audioGrade.filter(g => g !== grade)
                      : [...filters.audioGrade, grade];
                    setFilters({ ...filters, audioGrade: newGrades });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    filters.audioGrade.includes(grade)
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rareOnly"
              checked={filters.rareOnly}
              onChange={(e) => setFilters({ ...filters, rareOnly: e.target.checked })}
            />
            <label htmlFor="rareOnly" className="text-sm">희귀판만 보기</label>
          </div>

          <div>
            <h3 className="text-sm mb-2">지역</h3>
            <input
              type="text"
              placeholder="예: 서울, 강남구"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {showSort && (
        <div className="border-b bg-white">
          {sortOptions.map(option => (
            <button
              key={option.value}
              onClick={() => {
                setSortBy(option.value);
                setShowSort(false);
              }}
              className={`w-full px-4 py-3 text-left border-b last:border-b-0 ${
                sortBy === option.value ? 'bg-blue-50 text-blue-600' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 text-sm text-gray-600">
          {query ? `"${query}" 검색 결과 ` : '전체 검색 결과 '}
          {filteredAlbums.length}개
        </div>
        <div className="px-4 pb-4 space-y-3">
          {filteredAlbums.map(album => (
            <AlbumCard
              key={album.id}
              album={album}
              isFavorite={favorites.has(album.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
