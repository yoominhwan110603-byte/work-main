export interface AlbumCandidate {
  id: string;
  releaseId?: number;
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
  source: 'discogs' | 'discogs-direct' | 'mock';
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
  scratchDetails?: {
    displayedRegions?: number;
    highSeverity?: number;
    mediumSeverity?: number;
    lowSeverity?: number;
    reflectionRatio?: number | null;
    blurVariance?: number | null;
    exposure?: number | null;
    detectedDisc?: boolean;
  };
  dustOrReflectionNote: string;
  playbackImpact: '낮음' | '주의' | '높음';
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
  adjustedNoiseFloorDb?: number | null;
  dynamicRangeDb?: number;
  clippingRisk?: string;
  channelImbalanceDb?: number;
}

export interface AudioAnalysisResult {
  source: 'librosa' | 'mock' | 'fallback';
  audioScore: number;
  audioGrade: string;
  playbackRisk?: 'low' | 'medium' | 'high';
  clickCount?: number;
  noiseFloorDb?: number | null;
  ambientNoiseFloorDb?: number | null;
  adjustedNoiseFloorDb?: number | null;
  dynamicRangeDb?: number | null;
  analysisConfidence?: number;
  warnings?: string[];
  goodSample?: AudioSampleAnalysis | null;
  noisySample?: AudioSampleAnalysis | null;
  ambientSample?: AudioSampleAnalysis | null;
  summary: string;
}

export interface PriceRecommendation {
  recommended_price: number;
  price_range?: { min: number; max: number };
  source: 'discogs' | 'local' | 'mock';
  condition?: string;
  release_id?: number | null;
  release_title?: string;
  currency?: string;
  discogs?: {
    suggestedPrice?: number | null;
    marketplaceLow?: number | null;
    numForSale?: number | null;
    inputCurrency?: string;
  };
  reason: string;
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
  audio?: AudioAnalysisResult;
}

import { fetchApi, getApiBaseUrl } from './api';

export const COVER_ANALYSIS_REPORT_KEY = 'vinyl-check-cover-analysis-report';

const currentApiBaseUrl = () => getApiBaseUrl();

const knownCandidates: AlbumCandidate[] = [
  { id: 'kind-of-blue-cl-1355', title: 'Kind of Blue', artist: 'Miles Davis', year: 1959, label: 'Columbia 6-eye', catalogNumber: 'CL 1355', country: 'US', confidence: 96 },
  { id: 'abbey-road-pcs-7088', title: 'Abbey Road', artist: 'The Beatles', year: 1969, label: 'Apple', catalogNumber: 'PCS 7088', country: 'UK', confidence: 94 },
  { id: 'blue-train-blp-1577', title: 'Blue Train', artist: 'John Coltrane', year: 1957, label: 'Blue Note', catalogNumber: 'BLP 1577', country: 'US', confidence: 91 },
];

export function findAlbumCandidates(catalogNumber: string): AlbumCandidate[] {
  const normalized = catalogNumber.trim().toLowerCase();
  if (!normalized) return knownCandidates.slice(0, 2);
  return knownCandidates.filter(candidate => {
    const catalog = candidate.catalogNumber.toLowerCase();
    return catalog === normalized || catalog.includes(normalized) || normalized.includes(catalog.split(' ')[0]);
  });
}

function discogsResultToCandidate(result: Record<string, unknown>, catalogNumber: string): AlbumCandidate {
  const titleText = String(result.title || 'Unknown release');
  const [artist, title] = titleText.includes(' - ') ? titleText.split(' - ', 2) : ['Unknown artist', titleText];
  const labels = Array.isArray(result.label) ? result.label : [];
  return {
    id: `discogs-${String(result.id || result.resource_url || titleText)}`,
    releaseId: Number(result.id || 0),
    title,
    artist,
    year: Number(result.year || 0),
    label: labels.length > 0 ? String(labels[0]) : 'Unknown label',
    catalogNumber: String(result.catno || catalogNumber),
    country: String(result.country || 'Unknown'),
    confidence: 88,
  };
}

async function fetchDiscogsCandidatesDirect(catalogNumber: string, albumTitle = '', artist = '') {
  const attempts: URLSearchParams[] = [];
  const combined = [artist, albumTitle, catalogNumber].filter(Boolean).join(' ').trim();
  if (catalogNumber) attempts.push(new URLSearchParams({ type: 'release', catno: catalogNumber, per_page: '8' }));
  if (combined) attempts.push(new URLSearchParams({ type: 'release', q: combined, per_page: '8' }));

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
    return { candidates: [], source: 'mock' as const, apiBaseUrl: 'https://api.discogs.com', error: error instanceof Error ? error.message : 'Discogs direct lookup failed' };
  }
  return { candidates: candidates.slice(0, 5), source: candidates.length > 0 ? 'discogs-direct' as const : 'mock' as const, apiBaseUrl: 'https://api.discogs.com' };
}

export async function fetchDiscogsCandidates(catalogNumber: string, albumTitle = '', artist = '') {
  const normalized = catalogNumber.trim();
  const title = albumTitle.trim();
  const artistName = artist.trim();
  if (!normalized && !title && !artistName) return { candidates: [], source: 'mock' as const, apiBaseUrl: currentApiBaseUrl() };

  try {
    const params = new URLSearchParams();
    if (normalized) params.set('catalog_number', normalized);
    if (title) params.set('album_title', title);
    if (artistName) params.set('artist', artistName);
    const response = await fetchApi(`/discogs/search?${params.toString()}`, {}, 8000);
    if (!response.ok) throw new Error('Discogs server lookup failed');
    const payload = await response.json() as { candidates?: AlbumCandidate[]; source?: 'discogs' | 'mock' };
    if (payload.candidates?.length || payload.source === 'discogs') {
      return { candidates: payload.candidates || [], source: payload.source || 'discogs' as const, apiBaseUrl: currentApiBaseUrl() };
    }
  } catch (error) {
    const direct = await fetchDiscogsCandidatesDirect(normalized, title, artistName);
    return {
      ...direct,
      error: direct.candidates.length > 0
        ? `서버 연결 실패 후 Discogs 직접 검색 성공: ${error instanceof Error ? error.message : 'fetch failed'}`
        : error instanceof Error ? error.message : 'Discogs lookup failed',
    };
  }
  return fetchDiscogsCandidatesDirect(normalized, title, artistName);
}

function fallbackTrackRecommendations(catalogNumber: string): TrackRecommendations {
  return {
    source: 'mock',
    releaseTitle: '트랙 정보 확인 필요',
    catalogNumber,
    tracks: [
      { position: 'A1', title: '첫 트랙 도입부', duration: '' },
      { position: 'A2', title: '중간 안정 구간', duration: '' },
    ],
    good: { position: 'A2', title: '중간 안정 구간', duration: '', label: 'good', suggestedStart: '중간부', recordSeconds: 20, guide: '음악이 안정적으로 이어지는 20초를 녹음하세요.' },
    noisy: { position: 'A1', title: '첫 트랙 도입부', duration: '', label: 'noisy', suggestedStart: '시작부 0~15초', recordSeconds: 15, guide: '도입부와 조용한 부분처럼 상태가 안 좋은 구간을 확인하세요.' },
  };
}

export async function fetchTrackRecommendations(catalogNumber: string): Promise<TrackRecommendations> {
  const normalized = catalogNumber.trim();
  if (!normalized) return fallbackTrackRecommendations('');
  try {
    const response = await fetchApi(`/discogs/track-recommendations?catalog_number=${encodeURIComponent(normalized)}`, {}, 8000);
    if (!response.ok) throw new Error('Track recommendation lookup failed');
    return await response.json() as TrackRecommendations;
  } catch {
    return fallbackTrackRecommendations(normalized);
  }
}

export function createPressingInfo(candidate: AlbumCandidate, matrixNumber = ''): PressingInfo {
  const normalizedMatrix = matrixNumber.trim().toUpperCase();
  const firstPressHint = /1A|A-1|B-1|1S|STERLING|RL/.test(normalizedMatrix);
  const likelyFirst = candidate.id.includes('cl-1355') || candidate.id.includes('pcs-7088') || firstPressHint;
  return {
    releaseCountry: candidate.country,
    releaseYear: candidate.year,
    pressing: likelyFirst ? '초반 또는 초기 프레스로 추정' : '리이슈 또는 추가 확인 필요',
    label: candidate.label,
    rarity: likelyFirst ? '높음' : candidate.confidence > 85 ? '중간 이상' : '확인 필요',
    catalogNumber: candidate.catalogNumber,
    matrixNumber: normalizedMatrix || undefined,
  };
}

function stableContentSeed(value: string) {
  let seed = 0;
  const step = Math.max(1, Math.floor(value.length / 80));
  for (let index = 0; index < value.length; index += step) {
    seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
  }
  return seed;
}

export function recognizeLpImage(dataUrl: string, mediaType: 'image' | 'video' = 'image'): LpRecognition {
  const hasMedia = dataUrl.length > 120;
  const seed = stableContentSeed(dataUrl);
  const scratchCount = hasMedia ? (seed % 8) + (mediaType === 'video' ? ((seed >> 4) % 3) : 0) : 0;
  const reflectionBucket = hasMedia ? (seed >> 7) % 4 : 0;
  const qualityPenalty = hasMedia ? ((seed >> 11) % 8) + (mediaType === 'video' ? 2 : 0) : 0;
  const surfaceScore = hasMedia ? Math.max(45, Math.min(86, 84 - scratchCount * 3 - reflectionBucket * 5 - qualityPenalty)) : 0;
  const scratchRisk = scratchCount >= 8 ? 'high' : scratchCount >= 3 ? 'medium' : 'low';
  const reflectionRisk = reflectionBucket >= 3 ? 'high' : reflectionBucket >= 1 ? 'medium' : 'low';
  const playbackImpact = scratchRisk === 'high' ? '높음' : scratchRisk === 'medium' || reflectionRisk === 'high' ? '주의' : '낮음';
  const scratchRegions: ScratchRegion[] = Array.from({ length: Math.min(scratchCount, 8) }, (_, index) => {
    const regionSeed = (seed >> (index % 16)) + index * 97;
    const x1 = 0.16 + ((regionSeed % 58) / 100);
    const y1 = 0.18 + (((regionSeed >> 3) % 56) / 100);
    const length = 0.12 + (((regionSeed >> 6) % 18) / 100);
    const slope = (((regionSeed >> 9) % 21) - 10) / 100;
    return {
      x1: Number(Math.max(0.06, Math.min(0.92, x1)).toFixed(4)),
      y1: Number(Math.max(0.06, Math.min(0.92, y1)).toFixed(4)),
      x2: Number(Math.max(0.06, Math.min(0.94, x1 + length)).toFixed(4)),
      y2: Number(Math.max(0.06, Math.min(0.94, y1 + slope)).toFixed(4)),
      severity: (index < 2 && scratchRisk !== 'low' ? scratchRisk : 'low') as 'low' | 'medium' | 'high',
    };
  });
  return {
    isRecord: hasMedia,
    confidence: hasMedia ? Math.min(90, surfaceScore + 3) : 0,
    surfaceScore,
    scratchCount,
    scratchRisk,
    reflectionRisk,
    scratchRegions,
    scratchDetails: {
      displayedRegions: scratchRegions.length,
      highSeverity: scratchRegions.filter(region => region.severity === 'high').length,
      mediumSeverity: scratchRegions.filter(region => region.severity === 'medium').length,
      lowSeverity: scratchRegions.filter(region => region.severity === 'low').length,
      reflectionRatio: null,
      blurVariance: null,
      exposure: null,
      detectedDisc: hasMedia,
    },
    dustOrReflectionNote: hasMedia ? '로컬 fallback 결과입니다. 강한 반사는 스크래치처럼 보일 수 있습니다.' : '표면 이미지 또는 동영상을 추가해 주세요.',
    playbackImpact,
    signals: hasMedia
      ? [`${mediaType === 'video' ? '동영상' : '이미지'}를 표면 상태 감정 참고 자료로 처리했습니다.`, `스크래치 후보 ${scratchCount}개, 반사 위험 ${reflectionRisk}입니다.`]
      : ['아직 표면 이미지나 동영상이 없습니다.'],
  };
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [header, base64Data = ''] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], filename, { type: mimeType });
}

export async function analyzeLpMedia(dataUrl: string, mediaType: 'image' | 'video'): Promise<LpRecognition & { persisted?: boolean; source?: string }> {
  if (!dataUrl) return recognizeLpImage('', mediaType);
  try {
    const formData = new FormData();
    formData.append('file', dataUrlToFile(dataUrl, mediaType === 'video' ? 'record-surface-video.webm' : 'record-surface-image.jpg'));
    formData.append('media_type', mediaType);
    const response = await fetchApi('/analysis/lp-recognition', { method: 'POST', body: formData }, 30000);
    if (!response.ok) throw new Error('LP surface analysis failed');
    return await response.json() as LpRecognition & { persisted?: boolean; source?: string };
  } catch {
    return recognizeLpImage(dataUrl, mediaType);
  }
}

function encodeWavMono(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);
  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function convertAudioFileForAnalysis(file: File, label: string) {
  if (file.type === 'audio/wav' || file.name.toLowerCase().endsWith('.wav')) return file;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return file;
  const context = new AudioContextClass();
  try {
    const sourceBuffer = await file.arrayBuffer();
    const decoded = await context.decodeAudioData(sourceBuffer.slice(0));
    const mono = new Float32Array(decoded.length);
    for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
      const channel = decoded.getChannelData(channelIndex);
      for (let sampleIndex = 0; sampleIndex < decoded.length; sampleIndex += 1) {
        mono[sampleIndex] += channel[sampleIndex] / decoded.numberOfChannels;
      }
    }
    const wav = encodeWavMono(mono, decoded.sampleRate);
    return new File([wav], `${label}-analysis.wav`, { type: 'audio/wav' });
  } catch {
    return file;
  } finally {
    void context.close().catch(() => undefined);
  }
}

export async function analyzeAudioSamples(files: { good?: File; noisy?: File; ambient?: File }): Promise<AudioAnalysisResult> {
  const formData = new FormData();
  const [good, noisy, ambient] = await Promise.all([
    files.good ? convertAudioFileForAnalysis(files.good, 'good-section') : Promise.resolve(undefined),
    files.noisy ? convertAudioFileForAnalysis(files.noisy, 'bad-section') : Promise.resolve(undefined),
    files.ambient ? convertAudioFileForAnalysis(files.ambient, 'ambient') : Promise.resolve(undefined),
  ]);
  if (good) formData.append('good_sample', good);
  if (noisy) formData.append('noisy_sample', noisy);
  if (ambient) formData.append('ambient_sample', ambient);
  try {
    const response = await timeoutAfter(fetchApi('/analysis/audio-samples', { method: 'POST', body: formData }, 22000), 24000, 'Audio analysis timed out');
    if (!response.ok) throw new Error('Audio analysis failed');
    return await response.json() as AudioAnalysisResult;
  } catch {
    const sizeSeed = (files.good?.size || 0) + (files.noisy?.size || 0) + (files.ambient?.size || 0);
    const audioScore = Math.max(58, Math.min(84, 78 - Math.round(sizeSeed % 13)));
    return {
      source: 'mock',
      audioScore,
      audioGrade: audioScore >= 82 ? 'VG+' : audioScore >= 72 ? 'VG' : 'G+',
      playbackRisk: audioScore >= 82 ? 'low' : audioScore >= 70 ? 'medium' : 'high',
      clickCount: Math.round(sizeSeed % 9),
      noiseFloorDb: null,
      ambientNoiseFloorDb: null,
      adjustedNoiseFloorDb: null,
      dynamicRangeDb: null,
      analysisConfidence: files.ambient ? 55 : 42,
      warnings: files.ambient ? ['서버 연결 실패로 주변음 보정은 임시값만 표시합니다.'] : ['주변음 기준 샘플이 없어 분석 신뢰도가 낮습니다.'],
      goodSample: files.good ? { filename: files.good.name, requestedSeconds: 30, score: audioScore, estimatedNoiseLevel: 'medium', scratchRisk: 'medium', usableForListingSample: audioScore >= 78 } : null,
      noisySample: files.noisy ? { filename: files.noisy.name, requestedSeconds: 30, score: Math.max(50, audioScore - 8), estimatedNoiseLevel: 'medium', scratchRisk: 'medium', usableForListingSample: false } : null,
      ambientSample: files.ambient ? { filename: files.ambient.name, requestedSeconds: 5, score: 0, estimatedNoiseLevel: 'unknown', scratchRisk: 'low', usableForListingSample: false } : null,
      summary: '서버 연결이 없어 녹음 파일 크기 기반의 임시 음질 점수를 적용했습니다.',
    };
  }
}

function timeoutAfter<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function fetchPriceRecommendation(params: {
  catalogNumber?: string;
  title?: string;
  artist?: string;
  releaseId?: number;
  surfaceScore?: number;
  audioScore?: number;
  scratchRisk?: string;
  playbackRisk?: string;
}): Promise<PriceRecommendation> {
  const query = new URLSearchParams();
  if (params.catalogNumber) query.set('catalog_number', params.catalogNumber);
  if (params.title) query.set('title', params.title);
  if (params.artist) query.set('artist', params.artist);
  if (params.releaseId) query.set('release_id', String(params.releaseId));
  if (params.surfaceScore) query.set('surface_score', String(params.surfaceScore));
  if (params.audioScore) query.set('audio_score', String(params.audioScore));
  if (params.scratchRisk) query.set('scratch_risk', params.scratchRisk);
  if (params.playbackRisk) query.set('playback_risk', params.playbackRisk);
  const response = await timeoutAfter(fetchApi(`/pricing/recommendation?${query.toString()}`, {}, 12000), 14000, 'Price recommendation timed out');
  if (!response.ok) throw new Error('Price recommendation failed');
  return await response.json() as PriceRecommendation;
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
