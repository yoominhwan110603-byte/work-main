import { useNavigate } from 'react-router';
import { ArrowLeft, Navigation } from 'lucide-react';

export default function TransactionLocationScreen() {
  const navigate = useNavigate();

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b bg-white z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">거래 장소</h1>
      </header>

      <div className="flex-1 relative bg-gray-200">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500">지도 표시 영역</p>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full">
          <div className="w-8 h-8 bg-red-500 rounded-full border-4 border-white shadow-lg" />
        </div>
      </div>

      <div className="bg-white p-4 border-t">
        <div className="mb-4">
          <h2 className="mb-2">강남역 2번 출구</h2>
          <p className="text-sm text-gray-600">서울특별시 강남구 강남대로 396</p>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2">
            <Navigation size={20} />
            길찾기
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 border border-gray-300 rounded-lg"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
