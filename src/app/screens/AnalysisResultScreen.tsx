import { useNavigate } from 'react-router';
import { BadgeCheck, CheckCircle2 } from 'lucide-react';

const DRAFT_KEY = 'vinyl-check-listing-draft';

interface ScratchRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  severity?: 'low' | 'medium' | 'high';
}

interface LpAnalysisResult {
  confidence: number;
  signals: string[];
  surfaceScore: number;
  scratchCount: number;
  scratchRisk: 'low' | 'medium' | 'high';
  reflectionRisk: 'low' | 'medium' | 'high';
  scratchRegions?: ScratchRegion[];
  dustOrReflectionNote: string;
  playbackImpact: '낮음' | '주의' | '높음';
}

interface JacketAnalysisResult {
  jacketScore: number;
  jacketGrade: string;
  cornerWear: 'low' | 'medium' | 'high';
  ringWear: 'low' | 'medium' | 'high';
  stainRisk: 'low' | 'medium' | 'high';
  tearOrCreaseRisk: 'low' | 'medium' | 'high';
  notes: string[];
}

interface AudioAnalysisResult {
  audioScore: number;
  audioGrade: string;
  playbackRisk?: 'low' | 'medium' | 'high';
  clickCount?: number;
  noiseFloorDb?: number | null;
  dynamicRangeDb?: number | null;
  summary: string;
}

interface ListingDraft {
  images?: string[];
  formData?: {
    title?: string;
    artist?: string;
    catalogNumber?: string;
  };
  lpAnalysis?: LpAnalysisResult | null;
  jacketAnalysis?: JacketAnalysisResult | null;
  audioAnalysis?: AudioAnalysisResult | null;
}

const riskLabel = (risk?: 'low' | 'medium' | 'high') => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const scratchColor = (severity?: string) => severity === 'high' ? '#ef4444' : severity === 'medium' ? '#f97316' : '#facc15';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';

const readDraft = (): ListingDraft | null => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as ListingDraft | null;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
};

export default function AnalysisResultScreen() {
  const navigate = useNavigate();
  const draft = readDraft();
  const lpAnalysis = draft?.lpAnalysis || null;
  const jacketAnalysis = draft?.jacketAnalysis || null;
  const audioAnalysis = draft?.audioAnalysis || null;
  const title = draft?.formData?.title || '감정 대상 LP';
  const artist = draft?.formData?.artist || '아티스트 미입력';
  const coverImage = draft?.images?.[0] || '';
  const recordImage = draft?.images?.[1] || draft?.images?.[0] || '';
  const scratchRegions = lpAnalysis?.scratchRegions || [];

  return (
    <div className="size-full bg-white flex flex-col text-gray-950">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl mb-2">감정서 생성 완료</h1>
          <p className="text-gray-600">자켓 상태와 음반 표면 분석을 감정서에 반영했습니다.</p>
        </div>

        <section className="rounded-lg overflow-hidden border">
          {coverImage && <img src={coverImage} alt={title} className="w-full aspect-square object-cover bg-gray-100" />}
          <div className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <BadgeCheck size={18} />
              <span className="text-sm">Vinyl-Check 무료 v1 감정</span>
            </div>
            <h2 className="text-xl">{title}</h2>
            <p className="text-sm text-gray-600">{artist}</p>
          </div>
        </section>

        {recordImage && lpAnalysis && (
          <section className="rounded-lg overflow-hidden border">
            <div className="relative aspect-square bg-gray-100">
              <img src={recordImage} alt="분석한 음반 표면" className="absolute inset-0 w-full h-full object-cover" />
              {scratchRegions.length > 0 && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                  {scratchRegions.map((region, index) => (
                    <line
                      key={`${region.x1}-${region.y1}-${index}`}
                      x1={region.x1 * 100}
                      y1={region.y1 * 100}
                      x2={region.x2 * 100}
                      y2={region.y2 * 100}
                      stroke={scratchColor(region.severity)}
                      strokeWidth={3.5}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              )}
              {scratchRegions.length > 0 && (
                <div className="absolute left-3 bottom-3 rounded bg-black/70 px-3 py-1.5 text-xs text-white">
                  스크래치 후보 {scratchRegions.length}곳 표시
                </div>
              )}
            </div>
            <div className="p-4">
              <h2 className="text-base">표면 위치 표시</h2>
              <p className="text-sm text-gray-600 mt-1">OpenCV가 찾은 선형 스크래치 후보를 이미지 위에 표시합니다.</p>
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">표면 점수</p>
            <p className="text-2xl mt-1">{lpAnalysis?.surfaceScore || lpAnalysis?.confidence || '-'}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">자켓 점수</p>
            <p className="text-2xl mt-1">{jacketAnalysis?.jacketScore || '-'}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-gray-500">자켓 등급</p>
            <p className="text-2xl mt-1">{jacketAnalysis?.jacketGrade || '-'}</p>
          </div>
        </section>

        {lpAnalysis && (
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-base">표면 스크래치 분석</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">스크래치 후보</p><p className="text-xl mt-1">{lpAnalysis.scratchCount}개</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">표시 위치</p><p className="text-xl mt-1">{scratchRegions.length}곳</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">재생 영향</p><p className="text-xl mt-1">{lpAnalysis.playbackImpact}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">반사 위험도</p><p className="text-xl mt-1">{riskLabel(lpAnalysis.reflectionRisk)}</p></div>
            </div>
            <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">{lpAnalysis.dustOrReflectionNote}</p>
            <ul className="space-y-2 text-sm text-gray-700">
              {lpAnalysis.signals.map((signal, index) => (
                <li key={`${signal}-${index}`} className="flex gap-2">
                  <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                  <span>{signal}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {jacketAnalysis && (
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-base">자켓 상태 분석</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">모서리 마모</p><p>{riskLabel(jacketAnalysis.cornerWear)}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">링웨어</p><p>{riskLabel(jacketAnalysis.ringWear)}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">얼룩/변색</p><p>{riskLabel(jacketAnalysis.stainRisk)}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">접힘/찢김</p><p>{riskLabel(jacketAnalysis.tearOrCreaseRisk)}</p></div>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              {jacketAnalysis.notes.map((note, index) => (
                <li key={`${note}-${index}`} className="flex gap-2">
                  <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {audioAnalysis && (
          <section className="rounded-lg border p-4 space-y-3">
            <h2 className="text-base">음질 분석</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">음질 등급</p><p className="text-xl mt-1">{audioAnalysis.audioGrade}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">음질 점수</p><p className="text-xl mt-1">{audioAnalysis.audioScore}</p></div>
              <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">재생 위험</p><p className="text-xl mt-1">{riskLabel(audioAnalysis.playbackRisk)}</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">클릭/팝</p><p>{audioAnalysis.clickCount ?? '-'}개</p></div>
              <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">노이즈</p><p>{formatDb(audioAnalysis.noiseFloorDb)}</p></div>
              <div className="rounded bg-gray-50 p-2"><p className="text-gray-500">다이내믹</p><p>{formatDb(audioAnalysis.dynamicRangeDb)}</p></div>
            </div>
            <p className="text-sm text-gray-700">{audioAnalysis.summary}</p>
          </section>
        )}

        {!lpAnalysis && !jacketAnalysis && !audioAnalysis && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">저장된 분석 결과가 없습니다. 판매 등록 화면에서 이미지를 먼저 업로드해 주세요.</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <button onClick={() => navigate('/sell')} className="w-full py-4 bg-blue-600 text-white rounded-xl">
          판매 등록으로 돌아가기
        </button>
      </div>
    </div>
  );
}
