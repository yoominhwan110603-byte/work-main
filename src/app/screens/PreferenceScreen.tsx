import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useUser } from '../context/UserContext';
import { CheckCircle2, Circle } from 'lucide-react';

export default function PreferenceScreen() {
  const navigate = useNavigate();
  const { login } = useUser();
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const genres = [
    '재즈', '락/팝', '힙합', '클래식',
    'R&B/소울', '일렉트로닉', '포크/컨트리', '레게',
    '펑크', '메탈', '블루스', '월드뮤직'
  ];

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleComplete = () => {
    login({
      id: '1',
      username: 'VinylLover',
      email: 'user@example.com',
      phone: '010-1234-5678',
      rating: 5.0,
      transactionCount: 0,
      genres: selectedGenres,
    });
    navigate('/app');
  };

  const handleSkip = () => {
    login({
      id: '1',
      username: 'VinylLover',
      email: 'user@example.com',
      phone: '010-1234-5678',
      rating: 5.0,
      transactionCount: 0,
      genres: [],
    });
    navigate('/app');
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <div className="flex-1 px-6 py-8 overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-3xl mb-2">선호하는 장르를 선택해주세요</h1>
          <p className="text-gray-600">맞춤 추천을 위해 사용됩니다 (최대 5개)</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {genres.map((genre) => {
            const isSelected = selectedGenres.includes(genre);
            return (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                disabled={!isSelected && selectedGenres.length >= 5}
                className={`
                  p-4 rounded-lg border-2 flex items-center justify-between
                  transition-all
                  ${isSelected
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!isSelected && selectedGenres.length >= 5 ? 'opacity-50' : ''}
                `}
              >
                <span className={isSelected ? 'text-blue-600' : 'text-gray-700'}>
                  {genre}
                </span>
                {isSelected ? (
                  <CheckCircle2 size={20} className="text-blue-600" />
                ) : (
                  <Circle size={20} className="text-gray-300" />
                )}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-gray-500 text-center mb-4">
          {selectedGenres.length}/5 선택됨
        </p>
      </div>

      <div className="px-6 pb-8 space-y-3">
        <button
          onClick={handleComplete}
          disabled={selectedGenres.length === 0}
          className="w-full bg-blue-600 text-white py-4 rounded-xl disabled:bg-gray-300"
        >
          완료
        </button>
        <button
          onClick={handleSkip}
          className="w-full text-gray-600 py-2"
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
