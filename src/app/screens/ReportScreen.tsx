import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export default function ReportScreen() {
  const navigate = useNavigate();
  const { type, id } = useParams();
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');

  const reasons = [
    '사기/허위 매물',
    '중복 게시물',
    '거래 금지 물품',
    '가격 허위 기재',
    '욕설/비방',
    '음란물/선정성',
    '기타',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReason) {
      alert('신고가 접수되었습니다');
      navigate(-1);
    }
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">신고하기</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-red-900">
            허위 신고 시 서비스 이용이 제한될 수 있습니다.<br />
            신중하게 선택해주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="mb-3">신고 사유를 선택해주세요</h3>
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

          <div>
            <label className="block text-sm mb-2">상세 내용</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg min-h-32"
              placeholder="신고 사유를 구체적으로 작성해주세요"
              required
            />
          </div>
        </form>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={handleSubmit}
          disabled={!selectedReason || !details.trim()}
          className="w-full py-4 bg-red-600 text-white rounded-xl disabled:bg-gray-300"
        >
          신고 제출
        </button>
      </div>
    </div>
  );
}
