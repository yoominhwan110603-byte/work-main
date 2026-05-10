import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, MapPin, MessageCircle, CheckCircle2 } from 'lucide-react';
import { mockAlbums } from '../data/mockData';
import VinylImage from '../components/VinylImage';

export default function OngoingTransactionScreen() {
  const navigate = useNavigate();
  const { transactionId } = useParams();
  const album = mockAlbums[0];

  const transaction = {
    id: transactionId,
    album,
    buyer: { name: 'LP애호가', phone: '010-1234-5678' },
    seller: album.seller,
    price: 250000,
    status: 'meeting_scheduled',
    meetingLocation: '강남역 2번 출구',
    meetingTime: '2026-04-20T14:00:00',
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">진행중인 거래</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={20} className="text-blue-600" />
            <span className="text-sm">거래 진행 중</span>
          </div>
          <p className="text-xs text-gray-600">
            약속 장소와 시간을 확인하고 안전하게 거래하세요
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex gap-3 mb-3">
            <VinylImage
              src={album.images[0]}
              alt={album.title}
              className="w-20 h-20 object-cover rounded-lg"
            />
            <div>
              <h3 className="mb-1">{album.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{album.artist}</p>
              <p className="text-xl text-blue-600">{transaction.price.toLocaleString()}원</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-gray-600 mb-3">거래 상대</h3>
          <div className="bg-white border rounded-lg p-4">
            <p className="mb-2">{transaction.buyer.name}</p>
            <p className="text-sm text-gray-600">{transaction.buyer.phone}</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm text-gray-600 mb-3">약속 정보</h3>
          <div className="bg-white border rounded-lg p-4 space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">일시</p>
              <p>{new Date(transaction.meetingTime).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">장소</p>
              <div className="flex items-center justify-between">
                <p>{transaction.meetingLocation}</p>
                <button
                  onClick={() => navigate(`/transaction/location/${transactionId}`)}
                  className="text-blue-600 text-sm flex items-center gap-1"
                >
                  <MapPin size={16} />
                  지도보기
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900">
            <strong>안전거래 팁</strong><br />
            • 공공장소에서 거래하세요<br />
            • 음반 상태를 꼼꼼히 확인하세요<br />
            • 현금거래 시 거스름돈을 미리 준비하세요
          </p>
        </div>
      </div>

      <div className="p-4 border-t space-y-2">
        <button
          onClick={() => navigate(`/transaction/chat/${transactionId}`)}
          className="w-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
        >
          <MessageCircle size={20} />
          채팅하기
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/transaction/review/${transactionId}`)}
            className="flex-1 py-3 border border-blue-600 text-blue-600 rounded-lg"
          >
            거래 완료
          </button>
          <button
            onClick={() => navigate(`/transaction/cancel/${transactionId}`)}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg"
          >
            거래 취소
          </button>
        </div>
      </div>
    </div>
  );
}
