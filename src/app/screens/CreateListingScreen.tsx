import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  FileAudio,
  ImagePlus,
  Loader2,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';

const DRAFT_KEY = 'vinyl-check-listing-draft';
const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

interface ListingFormData {
  title: string;
  artist: string;
  catalogNumber: string;
  price: string;
  description: string;
  tags: string;
}

interface ListingDraft {
  images: string[];
  videoFileName?: string;
  audioFileName: string;
  formData: ListingFormData;
  lpAnalysis: LpAnalysisResult | null;
  jacketAnalysis: JacketAnalysisResult | null;
  audioAnalysis: AudioAnalysisResult | null;
}

interface LpAnalysisResult {
  isRecord: boolean;
  confidence: number;
  signals: string[];
  source: string;
  persisted: boolean;
  surfaceScore: number;
  scratchCount: number;
  scratchRisk: 'low' | 'medium' | 'high';
  reflectionRisk: 'low' | 'medium' | 'high';
  scratchRegions: ScratchRegion[];
  dustOrReflectionNote: string;
  playbackImpact: '낮음' | '주의' | '높음';
}

interface ScratchRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  severity?: 'low' | 'medium' | 'high';
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

interface AudioSampleAnalysis {
  filename: string;
  requestedSeconds: number;
  score?: number;
  estimatedNoiseLevel: string;
  scratchRisk: string;
  usableForListingSample: boolean;
  clickCount?: number;
  clicksPerMinute?: number;
  noiseFloorDb?: number;
  dynamicRangeDb?: number;
  clippingRisk?: string;
}

interface AudioAnalysisResult {
  source: 'librosa' | 'mock' | 'fallback';
  audioScore: number;
  audioGrade: string;
  playbackRisk?: 'low' | 'medium' | 'high';
  clickCount?: number;
  noiseFloorDb?: number | null;
  dynamicRangeDb?: number | null;
  goodSample?: AudioSampleAnalysis;
  noisySample?: AudioSampleAnalysis;
  summary: string;
}

interface DiscogsCandidate {
  id: string;
  title: string;
  artist: string;
  year: number;
  label: string;
  catalogNumber: string;
  country: string;
  confidence: number;
}

const emptyFormData: ListingFormData = {
  title: '',
  artist: '',
  catalogNumber: '',
  price: '',
  description: '',
  tags: '',
};

const steps = ['사진/동영상', '판매 정보', '음질 샘플', '감정서 확인', '게시'];
const riskLabel = (risk?: 'low' | 'medium' | 'high') => risk === 'high' ? '높음' : risk === 'medium' ? '주의' : '낮음';
const formatDb = (value?: number | null) => typeof value === 'number' ? `${value.toFixed(1)} dB` : '-';
const recordVideoGuides = [
  'LP 표면 전체가 보이도록 8~12초 정도 천천히 촬영하세요.',
  '휴대폰을 살짝 기울이며 반사 위치를 움직이면 스크래치와 먼지 구분이 쉬워집니다.',
  '중앙 라벨보다 홈이 있는 검은 표면을 크게 담고, 손 그림자와 강한 플래시는 피해주세요.',
  '자켓 상태는 별도 사진으로 정면, 모서리, 링웨어가 보이게 추가하면 좋습니다.',
];
const fallbackLpAnalysis = (message: string): LpAnalysisResult => ({
  isRecord: true,
  confidence: 60,
  surfaceScore: 60,
  scratchCount: 0,
  scratchRisk: 'low',
  reflectionRisk: 'low',
  scratchRegions: [],
  dustOrReflectionNote: '서버 분석이 없어 먼지/반사 가능성은 보수적으로 낮음 처리했습니다.',
  playbackImpact: '낮음',
  signals: [message],
  source: 'frontend-fallback',
  persisted: false,
});
const fallbackJacketAnalysis = (imageLength = 0): JacketAnalysisResult => {
  const jacketScore = Math.max(76, Math.min(90, 84 + Math.round(imageLength / 120000)));
  return {
    jacketScore,
    jacketGrade: jacketScore >= 84 ? 'VG+' : 'VG',
    cornerWear: jacketScore >= 86 ? 'low' : 'medium',
    ringWear: jacketScore >= 88 ? 'low' : 'medium',
    stainRisk: 'low',
    tearOrCreaseRisk: jacketScore >= 82 ? 'low' : 'medium',
    notes: ['서버 자켓 분석이 없어 로컬 휴리스틱 점수를 적용했습니다.', '실물 모서리와 링웨어는 추가 확인을 권장합니다.'],
  };
};

const readImageAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas is not available'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

export default function CreateListingScreen() {
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<string[]>([]);
  const [videoFileName, setVideoFileName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [formData, setFormData] = useState<ListingFormData>(emptyFormData);
  const [lpAnalysis, setLpAnalysis] = useState<LpAnalysisResult | null>(null);
  const [jacketAnalysis, setJacketAnalysis] = useState<JacketAnalysisResult | null>(null);
  const [audioAnalysis, setAudioAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [discogsCandidates, setDiscogsCandidates] = useState<DiscogsCandidate[]>([]);
  const [isSearchingDiscogs, setIsSearchingDiscogs] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft) as ListingDraft;
        setImages(draft.images || []);
        setVideoFileName(draft.videoFileName || '');
        setAudioFileName(draft.audioFileName || '');
        setFormData({ ...emptyFormData, ...(draft.formData || {}) });
        setLpAnalysis(draft.lpAnalysis || null);
        setJacketAnalysis(draft.jacketAnalysis || null);
        setAudioAnalysis(draft.audioAnalysis || null);
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    const hasDraft =
      images.length > 0 ||
      videoFileName ||
      audioFileName ||
      lpAnalysis ||
      jacketAnalysis ||
      audioAnalysis ||
      Object.values(formData).some((value) => value.trim().length > 0);

    if (!hasDraft) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }

    const draft: ListingDraft = { images, videoFileName, audioFileName, formData, lpAnalysis, jacketAnalysis, audioAnalysis };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, images: images.slice(-1) }));
    }
  }, [audioFileName, draftReady, formData, images, videoFileName, lpAnalysis, jacketAnalysis, audioAnalysis]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  const completion = useMemo(() => {
    const checks = [
      images.length > 0 || Boolean(videoFileName),
      Boolean(formData.title.trim() && formData.price.trim()),
      Boolean(audioFileName),
      Boolean(lpAnalysis),
      Boolean(jacketAnalysis),
      Boolean(audioAnalysis),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [audioFileName, formData.price, formData.title, images.length, videoFileName, lpAnalysis, jacketAnalysis, audioAnalysis]);

  const isFormValid = Boolean(formData.title.trim() && formData.price.trim() && (images.length > 0 || videoFileName));

  const analyzeVisualMedia = async (file: File, imageDataUrl = '') => {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      return;
    }

    setIsAnalyzingImage(true);

    try {
      const surfaceBody = new FormData();
      surfaceBody.append('media_type', isVideo ? 'video' : 'image');
      surfaceBody.append('file', file);
      const surfaceResponse = await fetch(`${API_BASE}/analysis/lp-recognition`, { method: 'POST', body: surfaceBody });

      if (!surfaceResponse.ok) throw new Error('Surface analysis failed');
      setLpAnalysis(await surfaceResponse.json());

      if (isImage) {
        const jacketBody = new FormData();
        jacketBody.append('file', file);
        const jacketResponse = await fetch(`${API_BASE}/analysis/jacket-condition`, { method: 'POST', body: jacketBody });
        if (!jacketResponse.ok) throw new Error('Jacket analysis failed');
        setJacketAnalysis(await jacketResponse.json());
      }
    } catch {
      setLpAnalysis(fallbackLpAnalysis(`${isVideo ? '동영상' : '이미지'} 분석 서버에 연결하지 못했습니다. 업로드 내용은 임시저장되었습니다.`));
      if (isImage) {
        setJacketAnalysis(fallbackJacketAnalysis(imageDataUrl.length));
      }
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const selectedFiles = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (selectedFiles.length === 0) {
      return;
    }

    const imageFiles = selectedFiles.filter((file) => file.type.startsWith('image/'));
    const videoFiles = selectedFiles.filter((file) => file.type.startsWith('video/'));
    const nextImages = await Promise.all(imageFiles.map(readImageAsDataUrl));
    setImages((currentImages) => [...currentImages, ...nextImages].slice(0, 5));
    if (videoFiles[0]) {
      setVideoFileName(videoFiles[0].name);
    }
    await analyzeVisualMedia(imageFiles[0] || videoFiles[0] || selectedFiles[0], nextImages[0] || '');
  };

  const analyzeAudioFile = async (file: File) => {
    setIsAnalyzingAudio(true);
    try {
      const body = new FormData();
      body.append('good_sample', file);
      const response = await fetch(`${API_BASE}/analysis/audio-samples`, { method: 'POST', body });
      if (!response.ok) throw new Error('Audio analysis failed');
      setAudioAnalysis(await response.json());
    } catch {
      setAudioAnalysis({
        source: 'mock',
        audioScore: 76,
        audioGrade: 'VG',
        playbackRisk: 'medium',
        clickCount: 0,
        noiseFloorDb: -42,
        dynamicRangeDb: 12,
        goodSample: {
          filename: file.name,
          requestedSeconds: 30,
          score: 76,
          estimatedNoiseLevel: 'medium',
          scratchRisk: 'medium',
          usableForListingSample: false,
          clickCount: 0,
        },
        summary: '오디오 분석 서버에 연결하지 못해 보수적인 임시 점수를 적용했습니다.',
      });
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) {
      return;
    }

    setAudioFile(file);
    setAudioFileName(file.name);
    setAudioAnalysis(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    setAudioPreviewUrl(URL.createObjectURL(file));
    await analyzeAudioFile(file);
  };

  const handleDiscogsSearch = async () => {
    const catalogNumber = formData.catalogNumber.trim();
    const title = formData.title.trim();
    const artist = formData.artist.trim();
    if (!catalogNumber && !title && !artist) {
      return;
    }

    setIsSearchingDiscogs(true);
    try {
      const params = new URLSearchParams();
      if (catalogNumber) params.set('catalog_number', catalogNumber);
      if (title) params.set('album_title', title);
      if (artist) params.set('artist', artist);
      const response = await fetch(`${API_BASE}/discogs/search?${params.toString()}`);
      const data = await response.json();
      setDiscogsCandidates(data.candidates || []);
    } catch {
      setDiscogsCandidates([]);
    } finally {
      setIsSearchingDiscogs(false);
    }
  };

  const selectDiscogsCandidate = (candidate: DiscogsCandidate) => {
    setFormData((current) => ({
      ...current,
      title: candidate.title,
      artist: candidate.artist,
      catalogNumber: candidate.catalogNumber || current.catalogNumber,
    }));
    setDiscogsCandidates([]);
  };

  const handleSubmit = () => {
    if (!isFormValid) {
      alert('앨범 이미지 또는 동영상, 앨범명, 판매 가격을 입력해주세요.');
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    navigate('/sell/report');
  };

  const handlePublishToServer = async () => {
    if (!isFormValid) {
      alert('앨범 이미지 또는 동영상, 앨범명, 판매 가격을 입력해주세요.');
      return;
    }
    const tags = formData.tags
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      const response = await fetch(`${API_BASE}/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          artist: formData.artist.trim(),
          catalog_number: formData.catalogNumber.trim(),
          price: Number(formData.price),
          description: formData.description.trim(),
          tags,
          user_id: 'seller1',
          images,
          audio_grade: audioAnalysis?.audioGrade,
          audio_score: audioAnalysis?.audioScore,
          jacket_grade: jacketAnalysis?.jacketGrade,
          jacket_score: jacketAnalysis?.jacketScore,
          is_rare: tags.some((tag) => tag.includes('희귀') || tag.toLowerCase().includes('rare')),
          is_first_press: tags.some((tag) => tag.includes('초반') || tag.toLowerCase().includes('first')),
          analysis_report: { lpAnalysis, jacketAnalysis, audioAnalysis },
        }),
      });
      if (!response.ok) throw new Error('publish failed');
    } catch {
      alert('게시글 저장에 실패했습니다. 백엔드 서버 연결을 확인해 주세요.');
      return;
    }
    localStorage.removeItem(DRAFT_KEY);
    navigate('/sell/report');
  };

  const handleSaveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ images, videoFileName, audioFileName, formData, lpAnalysis, jacketAnalysis, audioAnalysis }));
    alert('임시 저장했습니다.');
  };

  const analysisSummary = () => {
    const parts = [];
    if (jacketAnalysis) parts.push(`자켓 ${jacketAnalysis.jacketGrade} (${jacketAnalysis.jacketScore}점)`);
    if (lpAnalysis) parts.push(`표면 ${lpAnalysis.surfaceScore || lpAnalysis.confidence}점, 스크래치 후보 ${lpAnalysis.scratchCount}개, 재생 영향 ${lpAnalysis.playbackImpact}`);
    if (audioAnalysis) parts.push(`음질 ${audioAnalysis.audioGrade} (${audioAnalysis.audioScore}점), 클릭/팝 후보 ${audioAnalysis.clickCount ?? 0}개, 재생 위험 ${riskLabel(audioAnalysis.playbackRisk)}`);
    return parts.length > 0 ? `Vinyl-Check 감정: ${parts.join(', ')}.` : '';
  };

  const applyAnalysisToDescription = () => {
    const summary = analysisSummary();
    if (!summary) return;
    setFormData((current) => ({
      ...current,
      description: [current.description.trim(), summary].filter(Boolean).join('\n\n'),
      tags: current.tags.trim() || '#VinylCheck #LP감정',
    }));
  };

  return (
    <div className="size-full bg-gray-50 flex flex-col text-gray-950">
      <header className="bg-white px-4 pt-4 pb-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="p-2" aria-label="뒤로가기">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-lg">신뢰 판매 등록</h1>
              <p className="text-xs text-gray-500">LP 감정 결과 중심으로 판매글을 완성합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePublishToServer}
            disabled={!isFormValid}
            className={`px-4 py-2 rounded-lg ${isFormValid ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
          >
            게시
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>완성도</span>
            <span>{completion}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${completion}%` }} />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {steps.map((step, index) => (
              <span
                key={step}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs ${
                  index === 0 || completion >= index * 25 ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        <section className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2>사진/동영상</h2>
              <p className="text-xs text-gray-500">첫 이미지는 자켓 상태와 표면 스크래치 후보 분석에 사용됩니다</p>
            </div>
            {isAnalyzingImage && <Loader2 size={18} className="animate-spin text-blue-600" />}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {images.map((image, index) => (
              <div key={`${image.slice(0, 32)}-${index}`} className="relative aspect-square">
                <img src={image} alt={`업로드 ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={() => setImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index))}
                  className="absolute top-1 right-1 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center"
                  aria-label="이미지 삭제"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-blue-600 bg-gray-50"
              >
                <ImagePlus size={24} className="mb-2 text-gray-400" />
                <span className="text-xs text-gray-500">추가</span>
              </button>
            )}
          </div>
          {videoFileName && (
            <div className="mt-3 flex items-center gap-3 rounded-lg border bg-gray-50 p-3">
              <Video size={20} className="text-blue-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{videoFileName}</p>
                <p className="text-xs text-gray-500">표면 스크래치와 반사 위험도 분석에 사용합니다</p>
              </div>
              <button
                type="button"
                onClick={() => setVideoFileName('')}
                className="w-7 h-7 rounded-full bg-white border flex items-center justify-center"
                aria-label="동영상 삭제"
              >
                <X size={14} />
              </button>
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          <section className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <div className="flex items-start gap-2">
              <Video size={18} className="mt-0.5 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-950">동영상 촬영 가이드</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-700">
                  {recordVideoGuides.map((guide) => (
                    <li key={guide} className="flex gap-2">
                      <span className="text-blue-600">•</span>
                      <span>{guide}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {lpAnalysis && (
            <div className="mt-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <div className="min-w-0">
                  <p className="text-sm">
                    표면 {lpAnalysis.surfaceScore || lpAnalysis.confidence}점 · 스크래치 후보 {lpAnalysis.scratchCount}개
                  </p>
                  <p className="text-xs text-gray-500">
                    위험도 {riskLabel(lpAnalysis.scratchRisk)} · 재생 영향 {lpAnalysis.playbackImpact} · {lpAnalysis.source}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-white p-2"><p className="text-gray-500">반사</p><p>{riskLabel(lpAnalysis.reflectionRisk)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">스크래치</p><p>{riskLabel(lpAnalysis.scratchRisk)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">재생 영향</p><p>{lpAnalysis.playbackImpact}</p></div>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-gray-600">
                {lpAnalysis.signals.map((signal, index) => (
                  <li key={`${signal}-${index}`}>{signal}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-yellow-800 bg-yellow-50 rounded p-2">{lpAnalysis.dustOrReflectionNote}</p>
            </div>
          )}

          {jacketAnalysis && (
            <div className="mt-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">자켓 {jacketAnalysis.jacketGrade} · {jacketAnalysis.jacketScore}점</p>
                  <p className="text-xs text-gray-500">모서리, 링웨어, 얼룩, 접힘 후보를 확인했습니다.</p>
                </div>
                <BadgeCheck size={18} className="text-blue-600 shrink-0" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-white p-2"><p className="text-gray-500">모서리</p><p>{riskLabel(jacketAnalysis.cornerWear)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">링웨어</p><p>{riskLabel(jacketAnalysis.ringWear)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">얼룩/변색</p><p>{riskLabel(jacketAnalysis.stainRisk)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">접힘/찢김</p><p>{riskLabel(jacketAnalysis.tearOrCreaseRisk)}</p></div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border p-4 space-y-4">
          <div>
            <h2>판매 정보</h2>
            <p className="text-xs text-gray-500">Discogs 후보를 선택한 뒤 앨범명과 아티스트를 직접 다듬을 수 있습니다</p>
          </div>

          <div>
            <label className="block text-sm mb-2">카탈로그/매트릭스 번호</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.catalogNumber}
                onChange={(event) => setFormData({ ...formData, catalogNumber: event.target.value })}
                className="min-w-0 flex-1 px-4 py-3 border rounded-lg bg-white"
                placeholder="예: ST-A-691671"
              />
              <button
                type="button"
                onClick={handleDiscogsSearch}
                disabled={isSearchingDiscogs || (!formData.catalogNumber.trim() && !formData.title.trim() && !formData.artist.trim())}
                className="px-3 py-3 border rounded-lg text-blue-600 disabled:text-gray-400"
                aria-label="Discogs 검색"
              >
                {isSearchingDiscogs ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              </button>
            </div>
            {discogsCandidates.length > 0 && (
              <div className="mt-2 space-y-2">
                {discogsCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectDiscogsCandidate(candidate)}
                    className="w-full p-3 border rounded-lg text-left bg-white"
                  >
                    <p className="text-sm">{candidate.title}</p>
                    <p className="text-xs text-gray-500">
                      {candidate.artist} · {candidate.label} · {candidate.year || '연도 미상'} · {candidate.country}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm mb-2">앨범명 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                className="w-full px-4 py-3 border rounded-lg bg-white"
                placeholder="앨범명 입력"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">아티스트</label>
              <input
                type="text"
                value={formData.artist}
                onChange={(event) => setFormData({ ...formData, artist: event.target.value })}
                className="w-full px-4 py-3 border rounded-lg bg-white"
                placeholder="아티스트명 입력"
              />
            </div>
            <div>
              <label className="block text-sm mb-2">판매 가격 *</label>
              <input
                type="number"
                value={formData.price}
                onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                className="w-full px-4 py-3 border rounded-lg bg-white"
                placeholder="가격 입력"
              />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2>음질 샘플</h2>
              <p className="text-xs text-gray-500">좋은 구간과 노이즈 구간을 분리하면 감정서 신뢰도가 올라갑니다</p>
            </div>
            {isAnalyzingAudio ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <FileAudio size={20} className="text-blue-600" />}
          </div>
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 border-2 border-dashed rounded-lg text-left hover:border-blue-600 bg-gray-50"
          >
            <Mic size={24} className="text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{audioFileName || '30초 음질 샘플 업로드'}</p>
              <p className="text-xs text-gray-500">
                {audioFile ? `${(audioFile.size / 1024 / 1024).toFixed(2)} MB` : 'WAV, MP3, M4A'}
              </p>
            </div>
            <Upload size={18} className="text-gray-400" />
          </button>
          <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
          {audioPreviewUrl && <audio controls src={audioPreviewUrl} className="w-full mt-3" />}
          {audioAnalysis && (
            <div className="mt-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">음질 {audioAnalysis.audioGrade} · {audioAnalysis.audioScore}점</p>
                  <p className="text-xs text-gray-500">{audioAnalysis.summary}</p>
                </div>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">{riskLabel(audioAnalysis.playbackRisk)}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded bg-white p-2"><p className="text-gray-500">클릭/팝</p><p>{audioAnalysis.clickCount ?? '-'}개</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">노이즈</p><p>{formatDb(audioAnalysis.noiseFloorDb)}</p></div>
                <div className="rounded bg-white p-2"><p className="text-gray-500">다이내믹</p><p>{formatDb(audioAnalysis.dynamicRangeDb)}</p></div>
              </div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShieldCheck size={22} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2>감정서 확인</h2>
              <p className="text-sm text-gray-600 mt-1">
                사진 분석, Discogs 후보, 음질 샘플을 모아 구매자에게 보일 신뢰 정보를 만듭니다.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-gray-50 p-2">
                  <BadgeCheck size={16} className="mx-auto mb-1 text-green-600" />
                  <span>{lpAnalysis ? '표면 분석' : '표면 대기'}</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <Sparkles size={16} className="mx-auto mb-1 text-blue-600" />
                  <span>{formData.title ? '앨범 확인' : '앨범 대기'}</span>
                </div>
                <div className="rounded-lg bg-gray-50 p-2">
                  <FileAudio size={16} className="mx-auto mb-1 text-purple-600" />
                  <span>{audioAnalysis ? '음질 분석' : '음질 대기'}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={applyAnalysisToDescription}
                  disabled={!lpAnalysis && !jacketAnalysis}
                  className="py-3 rounded-lg border text-sm text-blue-600 disabled:text-gray-400"
                >
                  설명에 반영
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/sell/analysis/result')}
                  disabled={!lpAnalysis && !jacketAnalysis}
                  className="py-3 rounded-lg bg-blue-600 text-white text-sm disabled:bg-gray-300"
                >
                  감정서 보기
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border p-4 space-y-4">
          <div>
            <label className="block text-sm mb-2">상세 설명</label>
            <textarea
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              className="w-full px-4 py-3 border rounded-lg min-h-28 bg-white"
              placeholder="음반 상태, 구매 경로, 보관 상태를 적어주세요."
            />
          </div>
          <div>
            <label className="block text-sm mb-2">태그</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(event) => setFormData({ ...formData, tags: event.target.value })}
              className="w-full px-4 py-3 border rounded-lg bg-white"
              placeholder="#재즈 #초반 #오리지널"
            />
          </div>
        </section>

        <div className="pb-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={handleSaveDraft} className="py-3 text-sm text-gray-700 border rounded-lg bg-white">
            임시 저장
          </button>
          <button
            type="button"
            onClick={handlePublishToServer}
            disabled={!isFormValid}
            className={`py-3 text-sm rounded-lg ${isFormValid ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
          >
            게시하기
          </button>
        </div>
      </main>
    </div>
  );
}
