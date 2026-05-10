import { useNavigate } from 'react-router';
import { ArrowLeft, BadgeCheck, CheckCircle2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SalesReportScreen() {
  const navigate = useNavigate();

  const priceData = [
    { date: '3월', price: 250 },
    { date: '4월', price: 270 },
    { date: '5월', price: 280 },
    { date: '6월', price: 265 },
    { date: '7월', price: 280 },
    { date: '8월', price: 290 },
  ];

  const report = {
    currentPrice: 280000,
    avgPrice: 275000,
    minPrice: 250000,
    maxPrice: 320000,
    audioGrade: 'VG+',
    audioScore: 86,
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">판매 리포트</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
          <p className="text-sm opacity-90 mb-2">현재 판매 가격</p>
          <p className="text-4xl mb-6">{report.currentPrice.toLocaleString()}원</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="opacity-75 mb-1">평균 시세</p>
              <p className="text-xl">{report.avgPrice.toLocaleString()}원</p>
            </div>
            <div>
              <p className="opacity-75 mb-1">가격 범위</p>
              <p className="text-xl">
                {report.minPrice.toLocaleString()}-{(report.maxPrice / 10000).toFixed(0)}만
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} />
            <h2 className="text-lg">가격 추이</h2>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-green-600">
              <CheckCircle2 size={20} />
              <span className="text-sm">게시 상태</span>
            </div>
            <p className="text-2xl">게시 완료</p>
            <p className="text-xs text-green-700 mt-1">홈과 검색 결과에 노출됩니다</p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-blue-600">
              <BadgeCheck size={20} />
              <span className="text-sm">분석 인증</span>
            </div>
            <p className="text-2xl">{report.audioGrade}</p>
            <p className="text-xs text-blue-700 mt-1">음질 점수 {report.audioScore}점</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-900">
            <strong>가격 제안</strong><br />
            현재 가격은 평균 시세보다 약간 높습니다. 빠른 거래를 원하신다면 27만원으로 조정하는 것을 추천합니다.
          </p>
        </div>
      </div>

      <div className="p-4 border-t">
        <button
          onClick={() => navigate('/app')}
          className="w-full py-4 bg-blue-600 text-white rounded-xl"
        >
          확인
        </button>
      </div>
    </div>
  );
}
