import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Heart, Share2, Flag, MessageCircle, BadgeCheck, MapPin, Eye, Play, Volume2, ClipboardList } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';
import { getActiveTrade } from '../data/tradeState';

export default function AlbumDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const album = mockAlbums.find(a => a.id === id);
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [samplePlaying, setSamplePlaying] = useState(false);

  if (!album) {
    return <div>앨범을 찾을 수 없습니다</div>;
  }

  const isOwnListing = searchParams.get('mine') === 'true';
  const activeTrade = getActiveTrade(album.id);
  const isCompletedTrade = activeTrade?.status === 'completed';
  const showMarketplaceMetrics = !isOwnListing && !isCompletedTrade;

  const playSample = () => {
    if (samplePlaying) {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      alert('이 브라우저에서는 샘플 재생을 지원하지 않습니다');
      return;
    }

    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(album.genre === '재즈' ? 392 : 330, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(album.genre === '재즈' ? 523 : 440, context.currentTime + 2.8);
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 3);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 3);

    setSamplePlaying(true);
    oscillator.onended = () => {
      setSamplePlaying(false);
      context.close();
    };
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between border-b sticky top-0 bg-white z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <div className="flex gap-2">
          <button className="p-2">
            <Share2 size={22} />
          </button>
          <button
            onClick={() => navigate(`/report/album/${album.id}`)}
            className="p-2"
          >
            <Flag size={22} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <VinylImage
            src={album.images[currentImageIndex]}
            alt={album.title}
            className="w-full aspect-square object-cover"
          />
          {album.images.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {album.images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl mb-1">{album.title}</h1>
              <p className="text-lg text-gray-600">{album.artist}</p>
            </div>
            {showMarketplaceMetrics && (
              <button
                onClick={() => setIsFavorite(!isFavorite)}
                className="p-2"
              >
                <Heart
                  size={28}
                  className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
                />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{album.year}년</span>
            <span>•</span>
            <span>{album.genre}</span>
            {showMarketplaceMetrics && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Eye size={14} />
                  <span>{album.views}</span>
                </div>
              </>
            )}
            {isOwnListing && !isCompletedTrade && (
              <>
                <span>•</span>
                <span className="text-blue-600">{activeTrade?.status === 'selling' ? '판매 중' : '내 판매글'}</span>
              </>
            )}
            {isCompletedTrade && (
              <>
                <span>•</span>
                <span className="text-green-600">거래 완료</span>
              </>
            )}
          </div>

          {album.isRare && (
            <div className="flex gap-2">
              {album.isFirstPress && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                  오리지널 프레싱
                </span>
              )}
              <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                희귀판
              </span>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg">음질 분석</h2>
              <div className="flex items-center gap-1 text-blue-600">
                <BadgeCheck size={18} />
                <span className="text-sm">AI 인증</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">음질 등급</p>
                <p className="text-2xl">{album.audioGrade}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">음질 점수</p>
                <p className="text-2xl text-blue-600">{album.audioScore}점</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">자켓 상태</p>
                <p className="text-lg">{album.jacketGrade}</p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 text-white p-4 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Volume2 size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg">LP 샘플</h2>
                  <p className="text-sm text-white/70 truncate">{album.title} 음질 확인용 3초 샘플</p>
                </div>
              </div>
              <button
                onClick={playSample}
                disabled={samplePlaying}
                className="px-4 py-2 bg-white text-neutral-900 rounded-lg flex items-center gap-2 disabled:bg-white/60"
              >
                <Play size={16} />
                {samplePlaying ? '재생중' : '듣기'}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg mb-2">판본 정보</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">카탈로그 번호</span>
                <span>{album.catalogNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">발매 연도</span>
                <span>{album.year}년</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-baseline gap-2 mb-2">
              <p className="text-3xl">{album.price.toLocaleString()}원</p>
            </div>
            <p className="text-sm text-gray-600">
              시세: {album.priceRange.min.toLocaleString()}원 ~ {album.priceRange.max.toLocaleString()}원
            </p>
            {album.price < album.priceRange.min && (
              <p className="text-sm text-green-600 mt-1">시세보다 저렴합니다</p>
            )}
            {album.price > album.priceRange.max && (
              <p className="text-sm text-orange-600 mt-1">시세보다 높습니다</p>
            )}
          </div>

          <div>
            <h2 className="text-lg mb-2">상세 설명</h2>
            <p className="text-gray-700 whitespace-pre-line">{album.description}</p>
          </div>

          <div className="border-t pt-4">
            <h2 className="text-lg mb-3">판매자 정보</h2>
            <div
              onClick={() => navigate(`/app/profile/${album.seller.id}`)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-lg">{album.seller.name[0]}</span>
              </div>
              <div className="flex-1">
                <p>{album.seller.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>⭐ {album.seller.rating}</span>
                  <span>•</span>
                  <span>거래 {album.seller.transactionCount}회</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <MapPin size={18} />
            <span>{album.location}</span>
          </div>
        </div>
      </div>

      {isOwnListing ? (
        <div className="border-t p-4 flex gap-3">
          <button
            onClick={() => navigate('/transaction/offers/received')}
            className="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg flex items-center justify-center gap-2"
          >
            <ClipboardList size={20} />
            받은 제안
          </button>
          <button
            onClick={() => navigate(`/transaction/chat/${album.id}`)}
            disabled={!activeTrade}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-300"
          >
            <MessageCircle size={20} />
            거래 채팅
          </button>
        </div>
      ) : (
        <div className="border-t p-4 flex gap-3">
          <button
            onClick={() => navigate(`/transaction/comments/${album.id}`)}
            className="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg"
          >
            댓글로 질문
          </button>
          <button
            onClick={() => navigate(`/transaction/chat/${album.id}`)}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
          >
            <MessageCircle size={20} />
            채팅하기
          </button>
        </div>
      )}
    </div>
  );
}
