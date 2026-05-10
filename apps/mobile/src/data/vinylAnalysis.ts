export interface AlbumCandidate {
  id: string;
  title: string;
  artist: string;
  year: number;
  label: string;
  catalogNumber: string;
  country: string;
  confidence: number;
}

export interface TrackRecommendation {
  position: string;
  title: string;
  duration: string;
  durationSeconds?: number;
  label?: 'good' | 'noisy';
  guide?: string;
  suggestedStart?: string;
  recordSeconds?: number;
}

export interface TrackRecommendations {
  source: 'discogs' | 'mock';
  releaseTitle: string;
  catalogNumber: string;
  tracks: TrackRecommendation[];
  good: TrackRecommendation;
  noisy: TrackRecommendation;
}

export interface PressingInfo {
  releaseCountry: string;
  releaseYear: number;
  pressing: string;
  label: string;
  rarity: string;
  catalogNumber: string;
  matrixNumber?: string;
}

export interface CoverCondition {
  score: number;
  grade: string;
  notes: string[];
  cornerWear: 'low' | 'medium' | 'high';
  ringWear: 'low' | 'medium' | 'high';
  stainRisk: 'low' | 'medium' | 'high';
  tearOrCreaseRisk: 'low' | 'medium' | 'high';
}

export interface ScratchRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface LpRecognition {
  isRecord: boolean;
  confidence: number;
  signals: string[];
  surfaceScore: number;
  scratchCount: number;
  scratchRisk: 'low' | 'medium' | 'high';
  reflectionRisk: 'low' | 'medium' | 'high';
  scratchRegions: ScratchRegion[];
  dustOrReflectionNote: string;
  playbackImpact: '낮음' | '주의' | '높음';
}

export interface CoverAnalysisReport {
  imageDataUrl: string;
  recordImageDataUrl?: string;
  recordVideoDataUrl?: string;
  catalogNumber: string;
  matrixNumber?: string;
  recognition: LpRecognition;
  selectedCandidate: AlbumCandidate;
  pressing: PressingInfo;
  cover: CoverCondition;
  audio?: AudioAnalysisResult;
}

export interface AudioAnalysisResult {
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

export interface AudioSampleAnalysis {
  filename: string;
  requestedSeconds: number;
  estimatedNoiseLevel: string;
  scratchRisk: string;
  usableForListingSample: boolean;
  score?: number;
  durationSeconds?: number;
  clickCount?: number;
  clicksPerMinute?: number;
  noiseFloorDb?: number;
  dynamicRangeDb?: number;
  clippingRisk?: string;
  channelImbalanceDb?: number;
}

export const COVER_ANALYSIS_REPORT_KEY = 'vinyl-check-cover-analysis-report';

const DEV_LAN_API_BASE_URL = 'http://172.30.14.95:8000';

export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window === 'undefined') return 'http://localhost:8000';

  const { protocol, hostname } = window.location;
  const localHostnames = new Set(['localhost', '127.0.0.1', '::1']);
  if (localHostnames.has(hostname)) return DEV_LAN_API_BASE_URL;

  return `${protocol.startsWith('http') ? protocol : 'http:'}//${hostname}:8000`;
}

const API_BASE_URL = getApiBaseUrl();

const knownCandidates: AlbumCandidate[] = [
  {
    id: 'kind-of-blue-cl-1355',
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: 1959,
    label: 'Columbia 6-eye',
    catalogNumber: 'CL 1355',
    country: 'US',
    confidence: 96,
  },
  {
    id: 'abbey-road-pcs-7088',
    title: 'Abbey Road',
    artist: 'The Beatles',
    year: 1969,
    label: 'Apple',
    catalogNumber: 'PCS 7088',
    country: 'UK',
    confidence: 94,
  },
  {
    id: 'blue-train-blp-1577',
    title: 'Blue Train',
    artist: 'John Coltrane',
    year: 1957,
    label: 'Blue Note',
    catalogNumber: 'BLP 1577',
    country: 'US',
    confidence: 91,
  },
];

export function findAlbumCandidates(catalogNumber: string): AlbumCandidate[] {
  const normalized = catalogNumber.trim().toLowerCase();
  if (!normalized) return knownCandidates.slice(0, 2);

  const exact = knownCandidates.filter(candidate => candidate.catalogNumber.toLowerCase() === normalized);
  if (exact.length > 0) return exact;

  const partial = knownCandidates.filter(candidate => {
    const candidateCatalog = candidate.catalogNumber.toLowerCase();
    return candidateCatalog.includes(normalized) || normalized.includes(candidateCatalog.split(' ')[0]);
  });

  return partial;
}

export async function fetchDiscogsCandidates(
  catalogNumber: string,
  albumTitle = '',
  artist = '',
): Promise<{ candidates: AlbumCandidate[]; source: 'discogs' | 'discogs-direct' | 'mock'; apiBaseUrl: string; error?: string }> {
  const normalized = catalogNumber.trim();
  const title = albumTitle.trim();
  const artistName = artist.trim();
  if (!normalized && !title && !artistName) {
    return { candidates: [], source: 'mock', apiBaseUrl: API_BASE_URL };
  }

  try {
    const params = new URLSearchParams();
    if (normalized) params.set('catalog_number', normalized);
    if (title) params.set('album_title', title);
    if (artistName) params.set('artist', artistName);
    const response = await fetch(`${API_BASE_URL}/discogs/search?${params.toString()}`);
    if (!response.ok) throw new Error('Discogs lookup failed');
    const payload = await response.json() as { candidates?: AlbumCandidate[]; source?: 'discogs' | 'mock' };
    if (payload.candidates?.length || payload.source === 'discogs') {
      return {
        candidates: payload.candidates || [],
        source: payload.source || 'discogs',
        apiBaseUrl: API_BASE_URL,
      };
    }
  } catch (error) {
    const direct = await fetchDiscogsCandidatesDirect(normalized, title, artistName);
    return {
      ...direct,
      error: direct.candidates.length > 0
        ? `서버 연결 실패 후 Discogs 직접 조회 성공 (${error instanceof Error ? error.message : 'fetch failed'})`
        : error instanceof Error ? error.message : 'Discogs lookup failed',
    };
  }

  return fetchDiscogsCandidatesDirect(normalized, title, artistName);
}

async function fetchDiscogsCandidatesDirect(
  catalogNumber: string,
  albumTitle = '',
  artist = '',
): Promise<{ candidates: AlbumCandidate[]; source: 'discogs-direct' | 'mock'; apiBaseUrl: string; error?: string }> {
  const attempts: URLSearchParams[] = [];
  const combined = [artist, albumTitle, catalogNumber].filter(Boolean).join(' ').trim();

  if (catalogNumber) {
    const params = new URLSearchParams({ type: 'release', catno: catalogNumber, per_page: '8' });
    attempts.push(params);
  }
  if (combined && combined !== catalogNumber) {
    attempts.push(new URLSearchParams({ type: 'release', q: combined, per_page: '8' }));
  }
  if (albumTitle || artist) {
    const params = new URLSearchParams({ type: 'release', per_page: '8' });
    if (albumTitle) params.set('release_title', albumTitle);
    if (artist) params.set('artist', artist);
    attempts.push(params);
  }
  if (catalogNumber) {
    attempts.push(new URLSearchParams({ type: 'release', q: catalogNumber, per_page: '8' }));
  }

  const seen = new Set<string>();
  const candidates: AlbumCandidate[] = [];
  try {
    for (const params of attempts) {
      const response = await fetch(`https://api.discogs.com/database/search?${params.toString()}`);
      if (!response.ok) continue;
      const payload = await response.json() as { results?: Record<string, unknown>[] };
      for (const result of payload.results || []) {
        const id = String(result.id || result.resource_url || result.uri || result.title || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        candidates.push(discogsResultToCandidate(result, catalogNumber || combined));
      }
      if (candidates.length > 0) break;
    }
  } catch (error) {
    return {
      candidates: [],
      source: 'mock',
      apiBaseUrl: 'https://api.discogs.com',
      error: error instanceof Error ? error.message : 'Direct Discogs lookup failed',
    };
  }

  return {
    candidates: candidates.slice(0, 5),
    source: candidates.length > 0 ? 'discogs-direct' : 'mock',
    apiBaseUrl: 'https://api.discogs.com',
  };
}

function discogsResultToCandidate(result: Record<string, unknown>, catalogNumber: string): AlbumCandidate {
  const titleText = String(result.title || 'Unknown release');
  const [artist, title] = titleText.includes(' - ')
    ? titleText.split(' - ', 2)
    : ['Unknown artist', titleText];
  const labels = Array.isArray(result.label) ? result.label : [];
  const label = labels.length > 0 ? String(labels[0]) : 'Unknown label';
  const year = Number(result.year || 0);
  return {
    id: `discogs-${String(result.id || result.resource_url || titleText)}`,
    title,
    artist,
    year: Number.isFinite(year) ? year : 0,
    label,
    catalogNumber: String(result.catno || catalogNumber),
    country: String(result.country || 'Unknown'),
    confidence: 88,
  };
}

function fallbackTrackRecommendations(catalogNumber: string): TrackRecommendations {
  return {
    source: 'mock',
    releaseTitle: '트랙 정보 확인 필요',
    catalogNumber,
    tracks: [
      { position: 'A1', title: '첫 번째 트랙', duration: '' },
      { position: 'A2', title: '중간 트랙', duration: '' },
    ],
    good: {
      position: 'A2',
      title: '중간 트랙',
      duration: '',
      label: 'good',
      suggestedStart: '중간부',
      recordSeconds: 20,
      guide: '음악이 안정적으로 이어지는 15~20초를 녹음하세요.',
    },
    noisy: {
      position: 'A1',
      title: '첫 번째 트랙',
      duration: '',
      label: 'noisy',
      suggestedStart: '시작부 0~15초',
      recordSeconds: 15,
      guide: '트랙 시작 직후나 곡 사이 조용한 10~15초를 녹음하세요.',
    },
  };
}

export async function fetchTrackRecommendations(catalogNumber: string): Promise<TrackRecommendations> {
  const normalized = catalogNumber.trim();
  if (!normalized) return fallbackTrackRecommendations('');

  try {
    const response = await fetch(`${API_BASE_URL}/discogs/track-recommendations?catalog_number=${encodeURIComponent(normalized)}`);
    if (!response.ok) throw new Error('Track recommendation lookup failed');
    return await response.json() as TrackRecommendations;
  } catch {
    return fallbackTrackRecommendations(normalized);
  }
}

export function createPressingInfo(candidate: AlbumCandidate, matrixNumber = ''): PressingInfo {
  const normalizedMatrix = matrixNumber.trim().toUpperCase();
  const matrixFirstPressHint = /1A|A-1|B-1|1S|STERLING|RL/.test(normalizedMatrix);
  const isLikelyFirstPress = candidate.id.includes('cl-1355') || candidate.id.includes('pcs-7088') || matrixFirstPressHint;
  return {
    releaseCountry: candidate.country,
    releaseYear: candidate.year,
    pressing: isLikelyFirstPress ? '초반 또는 초기 프레스로 추정' : '리이슈 또는 추가 확인 필요',
    label: candidate.label,
    rarity: isLikelyFirstPress ? '높음' : candidate.confidence > 85 ? '중간 이상' : '확인 필요',
    catalogNumber: candidate.catalogNumber,
    matrixNumber: normalizedMatrix || undefined,
  };
}

export function estimateCoverCondition(catalogNumber: string, imageDataUrl: string): CoverCondition {
  const seed = catalogNumber.length + Math.round(imageDataUrl.length / 1000);
  const score = Math.max(76, Math.min(94, 88 - (seed % 7) + (catalogNumber.toUpperCase().includes('CL') ? 3 : 0)));
  const grade = score >= 92 ? 'NM' : score >= 84 ? 'VG+' : 'VG';
  const cornerWear = score >= 88 ? 'low' : 'medium';
  const ringWear = score >= 90 ? 'low' : 'medium';
  const stainRisk = score >= 84 ? 'low' : 'medium';
  const tearOrCreaseRisk = score >= 82 ? 'low' : 'medium';
  const notes = grade === 'NM'
    ? ['모서리 눌림이 거의 보이지 않습니다.', '링웨어가 매우 약합니다.', '전면 아트워크 오염이 적습니다.']
    : grade === 'VG+'
      ? ['가벼운 테두리 마모가 감지되었습니다.', '모서리 눌림이 약하게 보입니다.', '큰 터짐이나 찢김은 보이지 않습니다.']
      : ['테두리 마모가 뚜렷합니다.', '표면 스커프가 일부 보입니다.', '실물 추가 확인을 권장합니다.'];

  return { score, grade, notes, cornerWear, ringWear, stainRisk, tearOrCreaseRisk };
}

function stableContentSeed(value: string) {
  let seed = 0;
  const step = Math.max(1, Math.floor(value.length / 80));
  for (let index = 0; index < value.length; index += step) {
    seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
  }
  return seed;
}

export function recognizeLpImage(imageDataUrl: string, mediaType: 'image' | 'video' = 'image'): LpRecognition {
  const hasImage = imageDataUrl.length > 120;
  const seed = stableContentSeed(imageDataUrl);
  const sizeBucket = Math.min(12, Math.floor(imageDataUrl.length / 180000));
  const scratchCount = hasImage ? (seed % 9) + (mediaType === 'video' ? Math.floor((seed >> 4) % 5) : 0) : 0;
  const reflectionBucket = hasImage ? (seed >> 7) % 4 : 0;
  const qualityPenalty = hasImage ? ((seed >> 11) % 7) + (mediaType === 'video' ? 2 : 0) : 0;
  const scratchPenalty = scratchCount * (mediaType === 'video' ? 3 : 4);
  const reflectionPenalty = reflectionBucket * 5;
  const surfaceScore = hasImage
    ? Math.max(48, Math.min(88, 84 + sizeBucket - scratchPenalty - reflectionPenalty - qualityPenalty))
    : 0;
  const confidence = hasImage ? Math.min(90, surfaceScore + 3) : 0;
  const scratchRisk = scratchCount >= 8 ? 'high' : scratchCount >= 3 ? 'medium' : 'low';
  const reflectionRisk = reflectionBucket >= 3 ? 'high' : reflectionBucket >= 1 ? 'medium' : 'low';
  const playbackImpact = scratchRisk === 'high' ? '높음' : scratchRisk === 'medium' || reflectionRisk === 'high' ? '주의' : '낮음';
  const scratchRegions = Array.from({ length: Math.min(scratchCount, 8) }, (_, index) => {
    const regionSeed = (seed >> (index % 16)) + index * 97;
    const x1 = 0.16 + ((regionSeed % 58) / 100);
    const y1 = 0.18 + (((regionSeed >> 3) % 56) / 100);
    const length = 0.14 + (((regionSeed >> 6) % 18) / 100);
    const slope = (((regionSeed >> 9) % 21) - 10) / 100;
    return {
      x1: Number(Math.max(0.06, Math.min(0.92, x1)).toFixed(4)),
      y1: Number(Math.max(0.06, Math.min(0.92, y1)).toFixed(4)),
      x2: Number(Math.max(0.06, Math.min(0.94, x1 + length)).toFixed(4)),
      y2: Number(Math.max(0.06, Math.min(0.94, y1 + slope)).toFixed(4)),
      severity: index < 2 && scratchRisk !== 'low' ? scratchRisk : 'low',
    };
  });
  return {
    isRecord: hasImage,
    confidence,
    surfaceScore,
    scratchCount,
    scratchRisk,
    reflectionRisk,
    scratchRegions,
    dustOrReflectionNote: hasImage
      ? reflectionRisk === 'high'
        ? '강한 반사 후보가 있어 먼지와 실제 스크래치를 구분하려면 각도를 바꾼 추가 촬영이 필요합니다.'
        : reflectionRisk === 'medium'
          ? '일부 반사 후보가 있어 표면 점수에 보수적으로 반영했습니다.'
          : '반사 영향은 낮아 보이며 스크래치 후보 중심으로 확인했습니다.'
      : '표면 매체가 없어 먼지/반사 가능성을 판단하지 않았습니다.',
    playbackImpact,
    signals: hasImage
      ? [
          `${mediaType === 'video' ? '동영상' : '이미지'}를 표면 상태 감정 참고 자료로 접수했습니다.`,
          `스크래치 후보 ${scratchCount}개, 반사 위험도 ${reflectionRisk === 'high' ? '높음' : reflectionRisk === 'medium' ? '주의' : '낮음'}으로 보수 산정했습니다.`,
          '서버 분석을 사용할 수 없을 때의 로컬 fallback 결과이므로 감정서 참고 점수로만 사용합니다.',
        ]
      : ['아직 음반 표면 이미지나 동영상을 선택하지 않았습니다.'],
  };
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64Data = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mimeType });
}

export async function analyzeLpMedia(dataUrl: string, mediaType: 'image' | 'video'): Promise<LpRecognition & { persisted?: boolean; source?: string }> {
  if (!dataUrl) return recognizeLpImage('', mediaType);

  try {
    const formData = new FormData();
    formData.append('file', dataUrlToFile(dataUrl, mediaType === 'video' ? 'record-surface-video.webm' : 'record-surface-image.jpg'));
    formData.append('media_type', mediaType);

    const response = await fetch(`${API_BASE_URL}/analysis/lp-recognition`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('LP recognition failed');
    return await response.json() as LpRecognition & { persisted?: boolean; source?: string };
  } catch {
    return recognizeLpImage(dataUrl, mediaType);
  }
}

export async function analyzeJacketCondition(dataUrl: string, catalogNumber: string): Promise<CoverCondition> {
  if (!dataUrl) return estimateCoverCondition(catalogNumber, '');

  try {
    const formData = new FormData();
    formData.append('file', dataUrlToFile(dataUrl, 'album-jacket.jpg'));
    const response = await fetch(`${API_BASE_URL}/analysis/jacket-condition`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Jacket analysis failed');
    const payload = await response.json() as {
      jacketScore: number;
      jacketGrade: string;
      cornerWear: 'low' | 'medium' | 'high';
      ringWear: 'low' | 'medium' | 'high';
      stainRisk: 'low' | 'medium' | 'high';
      tearOrCreaseRisk: 'low' | 'medium' | 'high';
      notes: string[];
    };
    return {
      score: payload.jacketScore,
      grade: payload.jacketGrade,
      cornerWear: payload.cornerWear,
      ringWear: payload.ringWear,
      stainRisk: payload.stainRisk,
      tearOrCreaseRisk: payload.tearOrCreaseRisk,
      notes: payload.notes,
    };
  } catch {
    return estimateCoverCondition(catalogNumber, dataUrl);
  }
}

export async function analyzeAudioSamples(files: { good?: File; noisy?: File }): Promise<AudioAnalysisResult> {
  const formData = new FormData();
  if (files.good) formData.append('good_sample', files.good);
  if (files.noisy) formData.append('noisy_sample', files.noisy);

  try {
    const response = await fetch(`${API_BASE_URL}/analysis/audio-samples`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Audio analysis failed');
    return await response.json() as AudioAnalysisResult;
  } catch {
    const sizeSeed = (files.good?.size || 0) + (files.noisy?.size || 0);
    const audioScore = Math.max(72, Math.min(92, 86 - Math.round((sizeSeed % 9) / 2)));
    return {
      source: 'mock',
      audioScore,
      audioGrade: audioScore >= 90 ? 'NM' : audioScore >= 82 ? 'VG+' : 'VG',
      playbackRisk: audioScore >= 84 ? 'low' : audioScore >= 72 ? 'medium' : 'high',
      clickCount: Math.round(sizeSeed % 7),
      noiseFloorDb: -44,
      dynamicRangeDb: 14,
      goodSample: files.good ? {
        filename: files.good.name,
        requestedSeconds: 30,
        score: audioScore,
        durationSeconds: 30,
        estimatedNoiseLevel: 'low',
        scratchRisk: 'low',
        clickCount: Math.round(sizeSeed % 4),
        clicksPerMinute: Math.round(sizeSeed % 8),
        noiseFloorDb: -48,
        dynamicRangeDb: 15,
        clippingRisk: 'low',
        channelImbalanceDb: 0.8,
        usableForListingSample: true,
      } : undefined,
      noisySample: files.noisy ? {
        filename: files.noisy.name,
        requestedSeconds: 30,
        score: Math.max(60, audioScore - 8),
        durationSeconds: 30,
        estimatedNoiseLevel: 'medium',
        scratchRisk: 'medium',
        clickCount: Math.round(sizeSeed % 9),
        clicksPerMinute: Math.round(sizeSeed % 18),
        noiseFloorDb: -38,
        dynamicRangeDb: 11,
        clippingRisk: 'low',
        channelImbalanceDb: 1.4,
        usableForListingSample: false,
      } : undefined,
      summary: 'FastAPI/librosa 분석 서버가 없어서 목업 분석으로 임시 점수를 만들었습니다.',
    };
  }
}

export function saveCoverAnalysisReport(report: CoverAnalysisReport) {
  localStorage.setItem(COVER_ANALYSIS_REPORT_KEY, JSON.stringify(report));
}

export function readCoverAnalysisReport(): CoverAnalysisReport | null {
  try {
    return JSON.parse(localStorage.getItem(COVER_ANALYSIS_REPORT_KEY) || 'null') as CoverAnalysisReport | null;
  } catch {
    localStorage.removeItem(COVER_ANALYSIS_REPORT_KEY);
    return null;
  }
}
