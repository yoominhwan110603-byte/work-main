import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';

export default function PriceOfferScreen() {
  const navigate = useNavigate();
  const { albumId } = useParams();
  const album = mockAlbums.find(a => a.id === albumId) || mockAlbums[0];
  const [offerPrice, setOfferPrice] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (offerPrice) {
      alert('가격 제안이 전송되었습니다');
      navigate(-1);
    }
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">가격 제안</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <VinylImage
              src={album.images[0]}
              alt={album.title}
              className="w-20 h-20 object-cover rounded-lg"
            />
            <div>
              <h3 className="mb-1">{album.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{album.artist}</p>
              <p className="text-lg">현재 가격: {album.price.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>시세 정보</strong><br />
            {album.priceRange.min.toLocaleString()}원 ~ {album.priceRange.max.toLocaleString()}원
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm mb-2">제안 가격</label>
            <input
              type="number"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-xl"
              placeholder="제안 금액 입력"
              required
            />
            {offerPrice && (
              <p className="text-sm text-gray-500 mt-2">
                {parseInt(offerPrice).toLocaleString()}원
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {[5000, 10000, 20000].map(amount => (
              <button
                key={amount}
                type="button"
                onClick={() => setOfferPrice(String(album.price - amount))}
                className="flex-1 py-2 border rounded-lg text-sm"
              >
                -{(amount / 1000)}천
              </button>
            ))}
          </div>

          {offerPrice && parseInt(offerPrice) < album.price && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-900">
                제안 가격이 현재 가격보다 {(album.price - parseInt(offerPrice)).toLocaleString()}원 낮습니다.
              </p>
            </div>
          )}
        </form>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={handleSubmit}
          disabled={!offerPrice}
          className="w-full py-4 bg-blue-600 text-white rounded-xl disabled:bg-gray-300"
        >
          제안하기
        </button>
      </div>
    </div>
  );
}
