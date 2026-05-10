import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Search, X } from 'lucide-react';

export default function SearchScreen() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([
    'Miles Davis',
    'Kind of Blue',
    '재즈',
    'Pink Floyd',
  ]);

  const recommendedSearches = [
    'The Beatles',
    'John Coltrane',
    '희귀판 재즈',
    'Blue Note',
    '오리지널 프레싱',
  ];

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.trim()) {
      navigate(`/app/search/results?q=${encodeURIComponent(value.trim())}`);
    }
  };

  const handleRecentSearch = (search: string) => {
    setQuery(search);
    navigate(`/app/search/results?q=${encodeURIComponent(search)}`);
  };

  const removeRecentSearch = (search: string) => {
    setRecentSearches(recentSearches.filter(s => s !== search));
  };

  const clearAllSearches = () => {
    setRecentSearches([]);
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 border-b">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  navigate(`/app/search/results?q=${encodeURIComponent(query.trim())}`);
                }
              }}
              placeholder="앨범명, 아티스트, 장르, 판본번호"
              className="flex-1 bg-transparent outline-none"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1">
                <X size={18} className="text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => navigate(`/app/search/results?q=${encodeURIComponent(query.trim())}`)}
            disabled={!query.trim()}
            className="px-4 py-2 text-blue-600 disabled:text-gray-300"
          >
            검색
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {recentSearches.length > 0 && (
          <section className="py-4 border-b">
            <div className="px-4 flex items-center justify-between mb-3">
              <h2 className="text-sm text-gray-600">최근 검색어</h2>
              <button
                onClick={clearAllSearches}
                className="text-sm text-gray-500"
              >
                전체 삭제
              </button>
            </div>
            <div className="px-4 space-y-2">
              {recentSearches.map((search, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2"
                >
                  <button
                    onClick={() => handleRecentSearch(search)}
                    className="flex-1 text-left"
                  >
                    {search}
                  </button>
                  <button
                    onClick={() => removeRecentSearch(search)}
                    className="p-2"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="py-4">
          <div className="px-4 mb-3">
            <h2 className="text-sm text-gray-600">추천 검색어</h2>
          </div>
          <div className="px-4 flex flex-wrap gap-2">
            {recommendedSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => handleRecentSearch(search)}
                className="px-4 py-2 bg-gray-100 rounded-full text-sm"
              >
                {search}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
