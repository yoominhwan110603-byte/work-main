import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Settings, Star, Package, ShoppingBag, MessageCircle } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { mockAlbums, mockReviews } from '../data/mockData';
import VinylImage from '../components/VinylImage';
import { getActiveTrade, getActiveTrades } from '../data/tradeState';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'selling' | 'reviews'>('selling');

  const isOwnProfile = !userId || userId === user?.id;
  const sellerAlbums = isOwnProfile
    ? mockAlbums.filter(album => album.seller.id === 'seller1')
    : mockAlbums.filter(album => album.seller.id === userId);
  const sellerSource = sellerAlbums[0]?.seller;

  const profileData = {
    id: userId || user?.id || '1',
    name: isOwnProfile ? (user?.username || '재즈매니아') : (sellerSource?.name || '판매자'),
    rating: isOwnProfile ? (sellerSource?.rating || user?.rating || 5.0) : (sellerSource?.rating || 0),
    transactionCount: isOwnProfile ? (sellerSource?.transactionCount || user?.transactionCount || 0) : (sellerSource?.transactionCount || 0),
    genres: isOwnProfile ? (user?.genres || ['재즈']) : Array.from(new Set(sellerAlbums.map(album => album.genre))),
  };

  const userListings = sellerAlbums;
  const activeTrades = getActiveTrades();
  const reviewAverage = mockReviews.length
    ? mockReviews.reduce((sum, review) => sum + review.rating, 0) / mockReviews.length
    : 0;

  return (
    <div className="size-full bg-gray-50 overflow-y-auto">
      <header className="bg-white px-4 py-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">프로필</h1>
          {isOwnProfile && (
            <button className="p-2">
              <Settings size={24} />
            </button>
          )}
        </div>
      </header>

      <div className="bg-white p-6 border-b">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl">
            {profileData.name[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl mb-2">{profileData.name}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Star size={16} className="text-yellow-500 fill-yellow-500" />
                <span>{profileData.rating.toFixed(1)}</span>
              </div>
              <span>거래 {profileData.transactionCount}회</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">리뷰 평균</p>
            <p className="text-lg">{reviewAverage.toFixed(1)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">리뷰 수</p>
            <p className="text-lg">{mockReviews.length}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">판매 중</p>
            <p className="text-lg">{activeTrades.filter(trade => trade.status === 'selling').length}</p>
          </div>
        </div>

        {profileData.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {profileData.genres.map(genre => (
              <span key={genre} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                {genre}
              </span>
            ))}
          </div>
        )}

        {!isOwnProfile && (
          <button
            onClick={() => navigate(`/transaction/chat/${userId}`)}
            className="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <MessageCircle size={20} />
            채팅하기
          </button>
        )}
      </div>

      <div className="bg-white border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('selling')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 ${
              activeTab === 'selling'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            <Package size={20} />
            <span>판매 목록</span>
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-4 flex items-center justify-center gap-2 ${
              activeTab === 'reviews'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500'
            }`}
          >
            <Star size={20} />
            <span>리뷰</span>
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'selling' ? (
          <div className="space-y-3">
            {userListings.map(album => (
              <div key={album.id} className="bg-white rounded-lg border p-3">
                <div
                  onClick={() => navigate(`/app/album/${album.id}${isOwnProfile ? '?mine=true' : ''}`)}
                  className="flex gap-3 cursor-pointer"
                >
                  <VinylImage
                    src={album.images[0]}
                    alt={album.title}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="mb-1 truncate">{album.title}</h3>
                        <p className="text-sm text-gray-600 mb-2 truncate">{album.artist}</p>
                      </div>
                      {getActiveTrade(album.id)?.status === 'selling' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs whitespace-nowrap">
                          판매 중
                        </span>
                      )}
                      {getActiveTrade(album.id)?.status === 'completed' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs whitespace-nowrap">
                          거래 완료
                        </span>
                      )}
                    </div>
                    <p className="text-lg">{album.price.toLocaleString()}원</p>
                  </div>
                </div>
                {getActiveTrade(album.id)?.status === 'selling' && (
                  <button
                    onClick={() => navigate(`/transaction/chat/${album.id}`)}
                    className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
                  >
                    거래 채팅으로 이동
                  </button>
                )}
              </div>
            ))}
            {userListings.length === 0 && (
              <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
                등록된 판매글이 없습니다
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {mockReviews.map(review => (
              <div key={review.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <p>{review.userName}</p>
                  <div className="flex items-center gap-1">
                    <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-sm">{review.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{review.comment}</p>
                <p className="text-xs text-gray-400">{review.albumTitle}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
