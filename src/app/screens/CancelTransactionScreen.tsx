import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export default function CancelTransactionScreen() {
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const reasons = [
    '판매자/구매자와 연락이 안됨',
    '약속 시간/장소 조율 실패',
    '상품 상태가 설명과 다름',
    '더 좋은 조건의 거래를 찾음',
    '개인 사정으로 거래 불가',
    '기타',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReason) {
      alert('거래가 취소되었습니다');
      navigate('/app');
    }
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">거래 취소</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-900">
            거래를 취소하시겠습니까?<br />
            취소 사유는 상대방에게 전달됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="mb-3">취소 사유를 선택해주세요</h3>
            <div className="space-y-2">
              {reasons.map(reason => (
                <label
                  key={reason}
                  className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === '기타' && (
            <div>
              <label className="block text-sm mb-2">상세 사유</label>
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg min-h-32"
                placeholder="취소 사유를 입력해주세요"
                required
              />
            </div>
          )}
        </form>
      </div>

      <div className="p-4 border-t flex gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-4 border border-gray-300 rounded-xl"
        >
          돌아가기
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedReason || (selectedReason === '기타' && !otherReason)}
          className="flex-1 py-4 bg-red-600 text-white rounded-xl disabled:bg-gray-300"
        >
          거래 취소
        </button>
      </div>
    </div>
  );
}
