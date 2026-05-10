import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';
import { saveActiveTrade } from '../data/tradeState';

interface Offer {
  id: string;
  album: typeof mockAlbums[0];
  buyerName: string;
  offerPrice: number;
  timestamp: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export default function ReceivedOffersScreen() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([
    {
      id: '1',
      album: mockAlbums[0],
      buyerName: 'LP애호가',
      offerPrice: 250000,
      timestamp: '2026-04-19T10:30:00',
      status: 'pending',
    },
    {
      id: '2',
      album: mockAlbums[1],
      buyerName: '음악덕후',
      offerPrice: 400000,
      timestamp: '2026-04-18T15:20:00',
      status: 'pending',
    },
  ]);

  const handleAccept = (offerId: string) => {
    const acceptedOffer = offers.find(o => o.id === offerId);
    if (acceptedOffer) {
      saveActiveTrade({
        albumId: acceptedOffer.album.id,
        buyerName: acceptedOffer.buyerName,
        offerPrice: acceptedOffer.offerPrice,
        acceptedAt: new Date().toISOString(),
        status: 'selling',
      });
    }
    setOffers(offers.map(o => o.id === offerId ? { ...o, status: 'accepted' as const } : o));
    alert('가격 제안을 수락했습니다');
  };

  const handleReject = (offerId: string) => {
    setOffers(offers.map(o => o.id === offerId ? { ...o, status: 'rejected' as const } : o));
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">받은 가격 제안</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {offers.map(offer => (
          <div key={offer.id} className="p-4 border-b">
            <div className="flex gap-3 mb-3">
              <VinylImage
                src={offer.album.images[0]}
                alt={offer.album.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">{offer.buyerName}</p>
                <p className="mb-1">{offer.album.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(offer.timestamp).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">현재 가격</span>
                <span>{offer.album.price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">제안 가격</span>
                <span className="text-lg text-blue-600">{offer.offerPrice.toLocaleString()}원</span>
              </div>
            </div>

            {offer.status === 'pending' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(offer.id)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg"
                >
                  수락
                </button>
                <button
                  onClick={() => handleReject(offer.id)}
                  className="flex-1 py-3 border border-gray-300 rounded-lg"
                >
                  거절
                </button>
              </div>
            ) : (
              <div className="text-center py-3 text-sm text-gray-500">
                {offer.status === 'accepted' ? '수락됨' : '거절됨'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
