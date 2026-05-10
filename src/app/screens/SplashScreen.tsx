import { useNavigate } from 'react-router';
import { Disc3 } from 'lucide-react';

export default function SplashScreen() {
  const navigate = useNavigate();

  return (
    <div className="size-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 text-white px-8">
      <div className="flex-1 flex flex-col items-center justify-center">
        <Disc3 size={120} className="mb-8 animate-spin" style={{ animationDuration: '3s' }} />
        <h1 className="text-4xl mb-2">Vinyl-Check</h1>
        <p className="text-lg opacity-90">1대1 중고 LP 거래 플랫폼</p>
        <p className="text-sm mt-4 opacity-75 text-center">
          음질 분석 기반의 신뢰할 수 있는<br />LP 거래 경험을 시작하세요
        </p>
      </div>

      <div className="w-full max-w-sm mb-12 space-y-3">
        <button
          onClick={() => navigate('/auth/signup')}
          className="w-full bg-white text-blue-600 py-4 rounded-xl"
        >
          시작하기
        </button>
        <button
          onClick={() => navigate('/auth/login')}
          className="w-full text-white py-2"
        >
          이미 계정이 있나요? 로그인
        </button>
      </div>
    </div>
  );
}
