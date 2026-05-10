import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function AnalysisRequestScreen() {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => navigate('/sell/analysis/result'), 500);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="size-full bg-white flex flex-col">
      <header className="px-4 py-4 flex items-center border-b">
        <button onClick={() => navigate(-1)} className="p-2" disabled={isAnalyzing}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-4 text-lg">음질 분석</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {!isAnalyzing ? (
          <div className="w-full max-w-md text-center space-y-6">
            <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl mb-2">AI 음질 분석 준비 완료</h2>
              <p className="text-gray-600">
                업로드하신 음원을 분석하여<br />
                객관적인 음질 등급을 산출합니다
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg text-left space-y-2 text-sm">
              <p className="text-blue-900">분석 항목</p>
              <ul className="space-y-1 text-gray-700">
                <li>• 노이즈 및 스크래치 소음 측정</li>
                <li>• 파형 왜곡 분석</li>
                <li>• 주파수 응답 평가</li>
                <li>• 종합 음질 점수 산출</li>
              </ul>
            </div>

            <button
              onClick={startAnalysis}
              className="w-full py-4 bg-blue-600 text-white rounded-xl"
            >
              분석 시작
            </button>
          </div>
        ) : (
          <div className="w-full max-w-md text-center space-y-6">
            <Loader2 size={64} className="mx-auto text-blue-600 animate-spin" />
            <div>
              <h2 className="text-2xl mb-2">음질 분석 중...</h2>
              <p className="text-gray-600">잠시만 기다려주세요</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500">{progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
