import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Star } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';

export default function ReviewScreen() {
  const navigate = useNavigate();
  const { transactionId } = useParams();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const album = mockAlbums[0];

  const tags = [
    '친절해요',
    '시간 약속을 잘 지켜요',
    '응답이 빨라요',
    '상품 상태가 좋아요',
    '설명이 정확해요',
    '좋은 거래였어요',
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating > 0) {
      alert('리뷰가 등록되었습니다');
      navigate('/app');
    }
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">거래 후기 작성</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <VinylImage
              src={album.images[0]}
              alt={album.title}
              className="w-16 h-16 object-cover rounded-lg"
            />
            <div>
              <p className="mb-1">{album.title}</p>
              <p className="text-sm text-gray-600">{album.artist}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center">
            <h3 className="mb-4">거래가 어떠셨나요?</h3>
            <div className="flex justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-1"
                >
                  <Star
                    size={40}
                    className={
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-sm text-gray-600">
                {rating === 5 ? '최고예요!' : rating === 4 ? '좋아요!' : rating === 3 ? '보통이에요' : rating === 2 ? '별로예요' : '나빠요'}
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3">거래 경험을 선택해주세요 (선택)</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm ${
                    selectedTags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3">상세 후기 (선택)</h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg min-h-32"
              placeholder="거래 경험을 자유롭게 작성해주세요"
            />
          </div>
        </form>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={handleSubmit}
          disabled={rating === 0}
          className="w-full py-4 bg-blue-600 text-white rounded-xl disabled:bg-gray-300"
        >
          후기 등록
        </button>
      </div>
    </div>
  );
}
