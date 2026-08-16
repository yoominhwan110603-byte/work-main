export interface AlbumCandidate {
  id: string;
  releaseId?: number;
  masterId?: number;
  title: string;
  artist: string;
  year: number;
  label: string;
  catalogNumber: string;
  country: string;
  coverImageUrl?: string;
  pressing?: string;
  confidence: number;
  communityHave?: number;
  communityWant?: number;
  representativeReason?: string;
}

export interface DiscogsAlbumSummary {
  masterId: number;
  title: string;
  artist: string;
  year: number;
  coverImageUrl?: string;
  communityHave: number;
  communityWant: number;
  exactMatch: boolean;
}

export interface DiscogsAlbumSearchResult {
  source: 'discogs';
  albums: DiscogsAlbumSummary[];
  pagination: {
    page: number;
    perPage: number;
    pages: number;
    total: number;
  };
}

export interface DiscogsRepresentativeVersions {
  masterId: number;
  representative: AlbumCandidate[];
  total: number;
  remainingCount: number;
  partial: boolean;
}

export interface DiscogsVersionPage {
  masterId: number;
  versions: AlbumCandidate[];
  offset: number;
  limit: number;
  total: number;
  remainingCount: number;
  nextOffset: number;
  hasMore: boolean;
  partial: boolean;
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
}

export interface ScratchRegion {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface JacketRecognition {
  isCover: boolean;
  source?: 'server' | 'browser' | 'fallback';
  confidence: number;
  jacketScore: number;
  jacketGrade: string;
  cornerWearRisk: 'low' | 'medium' | 'high';
  edgeWearRisk: 'low' | 'medium' | 'high';
  glareRisk: 'low' | 'medium' | 'high';
  colorFadeRisk: 'low' | 'medium' | 'high';
  edgeWearRatio?: number | null;
  cornerWearRatio?: number | null;
  glareRatio?: number | null;
  exposure?: number | null;
  blurVariance?: number | null;
  colorRichness?: number | null;
  signals: string[];
  recommendation: string;
}

export interface LpRecognition {
  isRecord: boolean;
  source?: string;
  persisted?: boolean;
  analysisAvailable?: boolean;
  analysisUnavailableReason?: string;
  confidence: number;
  signals: string[];
  surfaceScore: number;
  surfaceGrade?: string;
  scratchCount: number;
  scratchRisk?: 'unknown' | null;
  reflectionRisk?: 'unknown' | null;
  scratchRegions: ScratchRegion[];
  scratchDetails?: {
    displayedRegions?: number;
    highSeverity?: number;
    mediumSeverity?: number;
    lowSeverity?: number;
    reflectionRatio?: number | null;
    blurVariance?: number | null;
    exposure?: number | null;
    dustRatio?: number | null;
    grooveContrast?: number | null;
    scratchDensity?: number | null;
    centerHoleConfidence?: number | null;
    detectedDisc?: boolean;
  };
  dustOrReflectionNote: string;
  playbackImpact?: string | null;
}

export interface AudioSampleAnalysis {
  filename: string;
  requestedSeconds: number;
  estimatedNoiseLevel?: null;
  scratchRisk?: null;
  usableForListingSample: boolean;
  score?: number;
  durationSeconds?: number;
  clickCount?: number;
  clicksPerMinute?: number;
  noiseFloorDb?: number;
  adjustedNoiseFloorDb?: number | null;
  dynamicRangeDb?: number;
  clippingRisk?: null;
  clippingRatio?: number;
  channelImbalanceDb?: number;
  peakDb?: number;
  rmsDb?: number;
  transientDensity?: number;
  highFrequencyNoise?: number;
  spectralIssueCount?: number;
  spectralIssueDurationSeconds?: number;
  spectralIssueRate?: number;
  spectralIssueDurationRatio?: number;
  spectralPenalty?: number;
  problemFrequencyRangeHz?: { min: number; max: number };
}

export interface AudioAnalysisResult {
  source: 'librosa' | 'mock' | 'fallback' | 'browser';
  analysisAvailable?: boolean;
  analysisUnavailableReason?: string;
  audioScore: number | null;
  audioGrade: string | null;
  lpConditionScore?: number | null;
  lpConditionGrade?: string | null;
  environmentScore?: number | null;
  environmentGrade?: string | null;
  playbackRisk?: null;
  clickCount?: number;
  noiseFloorDb?: number | null;
  ambientNoiseFloorDb?: number | null;
  adjustedNoiseFloorDb?: number | null;
  dynamicRangeDb?: number | null;
  clippingRisk?: null;
  channelImbalanceDb?: number | null;
  highFrequencyNoise?: number | null;
  spectralIssueCount?: number | null;
  spectralIssueDurationSeconds?: number | null;
  spectralIssueRate?: number | null;
  spectralIssueDurationRatio?: number | null;
  spectralPenalty?: number | null;
  problemFrequencyRangeHz?: { min: number; max: number } | null;
  analysisConfidence?: number;
  warnings?: string[];
  audioSample?: AudioSampleAnalysis | null;
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
  confidence?: number;
  discogs?: {
    suggestedPrice?: number | null;
    marketplaceLow?: number | null;
    numForSale?: number | null;
    inputCurrency?: string;
    releaseUrl?: string;
    conditionUsed?: string;
    salesHistoryAvailable?: boolean;
    salesHistorySource?: string;
    priceSuggestionError?: string | null;
    conditionPrices?: Array<{
      condition: string;
      price: number;
      currency?: string;
      originalPrice?: number | null;
    }>;
  };
  reason: string;
}

export interface CoverAnalysisReport {
  imageDataUrl: string;
  recordImageDataUrl?: string;
  recordVideoDataUrl?: string;
  catalogNumber: string;
  recognition: LpRecognition;
  selectedCandidate: AlbumCandidate;
  pressing: PressingInfo;
  audio?: AudioAnalysisResult;
  jacket?: JacketRecognition;
}

import { fetchApi, getApiBaseUrl } from '@/shared/services/api';

export const COVER_ANALYSIS_REPORT_KEY = 'vinyl-check-cover-analysis-report';

const currentApiBaseUrl = () => getApiBaseUrl();
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const dbFromAmplitude = (value: number) => 20 * Math.log10(Math.max(value, 0.000001));
const dbFromPower = (value: number) => 10 * Math.log10(Math.max(value, 0.000000000001));
const riskFromRatio = (value: number, medium: number, high: number): 'low' | 'medium' | 'high' => value >= high ? 'high' : value >= medium ? 'medium' : 'low';
const gradeFromScore = (score: number) => {
  if (score >= 96) return 'M';
  if (score >= 88) return 'NM';
  if (score >= 80) return 'EX';
  if (score >= 70) return 'VG+';
  if (score >= 58) return 'VG';
  if (score >= 45) return 'G';
  return 'P';
};
function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = clamp(Math.floor((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
}

function subtractNoiseFloorDb(sampleDb?: number | null, ambientDb?: number | null) {
  if (typeof sampleDb !== 'number' || typeof ambientDb !== 'number') return sampleDb ?? null;
  const samplePower = 10 ** (sampleDb / 10);
  const ambientPower = 10 ** (ambientDb / 10);
  return dbFromPower(Math.max(samplePower - ambientPower, samplePower * 0.08));
}

const AUDIO_PROBLEM_FREQUENCY_RANGE_HZ = { min: 4000, max: 12000 };
const MIN_AUDIO_ANALYSIS_SECONDS = 60;
const AUDIO_CLICK_SCORE_MULTIPLIER = 300;

type AudioAnalysisFiles = {
  sample?: File;
  good?: File;
  noisy?: File;
  ambient?: File;
};

type AudioSampleLabel = 'sample' | 'ambient' | 'good' | 'noisy';

function audioScoreFromClicks(clickCount: number, durationSeconds: number) {
  const score = 100 - (AUDIO_CLICK_SCORE_MULTIPLIER * (clickCount / Math.max(durationSeconds, 1)));
  return Math.round(clamp(score, 0, 100));
}

function summarizeIssueFrames(issueFrames: boolean[], frameSeconds: number) {
  const maxGapFrames = Math.max(1, Math.round(0.12 / Math.max(frameSeconds, 0.001)));
  let issueFrameCount = 0;
  let issueCount = 0;
  let insideIssue = false;
  let gapFrames = 0;

  for (const isIssue of issueFrames) {
    if (isIssue) {
      issueFrameCount += 1;
      if (!insideIssue) {
        issueCount += 1;
        insideIssue = true;
      }
      gapFrames = 0;
      continue;
    }
    if (insideIssue) {
      gapFrames += 1;
      if (gapFrames > maxGapFrames) {
        insideIssue = false;
        gapFrames = 0;
      }
    }
  }

  return {
    count: issueCount,
    durationSeconds: issueFrameCount * frameSeconds,
  };
}

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
  const formats = Array.isArray(result.format) ? result.format.map(String) : [];
  return {
    id: `discogs-${String(result.id || result.resource_url || titleText)}`,
    releaseId: Number(result.id || 0),
    title,
    artist,
    year: Number(result.year || 0),
    label: labels.length > 0 ? String(labels[0]) : 'Unknown label',
    catalogNumber: String(result.catno || catalogNumber),
    country: String(result.country || 'Unknown'),
    coverImageUrl: String(result.cover_image || result.thumb || ''),
    pressing: formats.length ? formats.join(' · ') : undefined,
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

async function readDiscogsResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { detail?: string };
  if (!response.ok) throw new Error(payload.detail || 'Discogs 정보를 불러오지 못했습니다.');
  return payload;
}

export async function searchDiscogsAlbums(albumTitle: string, artist: string, page = 1, perPage = 10) {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
  if (albumTitle.trim()) params.set('album_title', albumTitle.trim());
  if (artist.trim()) params.set('artist', artist.trim());
  const response = await fetchApi(`/discogs/albums?${params.toString()}`, {}, 12000);
  return readDiscogsResponse<DiscogsAlbumSearchResult>(response);
}

export async function fetchRepresentativeVersions(masterId: number, refresh = false) {
  const query = refresh ? '?refresh=true' : '';
  const response = await fetchApi(`/discogs/masters/${masterId}/representative-versions${query}`, {}, 60000);
  return readDiscogsResponse<DiscogsRepresentativeVersions>(response);
}

export async function fetchDiscogsVersionPage(masterId: number, offset: number, limit = 20) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  const response = await fetchApi(`/discogs/masters/${masterId}/versions?${params.toString()}`, {}, 20000);
  return readDiscogsResponse<DiscogsVersionPage>(response);
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

export function createPressingInfo(candidate: AlbumCandidate): PressingInfo {
  return {
    releaseCountry: candidate.country,
    releaseYear: candidate.year,
    pressing: candidate.pressing || '리이슈 또는 추가 확인 필요',
    label: candidate.label,
    rarity: '확인 필요',
    catalogNumber: candidate.catalogNumber,
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

async function canvasFromMedia(dataUrl: string, mediaType: 'image' | 'video' = 'image') {
  if (!dataUrl || typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  if (mediaType === 'video' || dataUrl.startsWith('data:video')) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Video frame load timed out')), 4500);
      video.onloadeddata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Video frame load failed'));
      };
      video.src = dataUrl;
    });
    if (Number.isFinite(video.duration) && video.duration > 0.8) {
      await new Promise<void>(resolve => {
        const timer = window.setTimeout(() => resolve(), 900);
        video.onseeked = () => {
          window.clearTimeout(timer);
          resolve();
        };
        try {
          video.currentTime = Math.min(1.2, video.duration * 0.4);
        } catch {
          window.clearTimeout(timer);
          resolve();
        }
      }).catch(() => undefined);
    }
    const scale = Math.min(1, 240 / Math.max(video.videoWidth || 240, video.videoHeight || 240));
    canvas.width = Math.max(96, Math.round((video.videoWidth || 240) * scale));
    canvas.height = Math.max(96, Math.round((video.videoHeight || 240) * scale));
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return { canvas, context };
  }

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Image load timed out')), 4500);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error('Image load failed'));
    };
    image.src = dataUrl;
  });
  const scale = Math.min(1, 240 / Math.max(image.naturalWidth || 240, image.naturalHeight || 240));
  canvas.width = Math.max(96, Math.round((image.naturalWidth || 240) * scale));
  canvas.height = Math.max(96, Math.round((image.naturalHeight || 240) * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function imageStats(context: CanvasRenderingContext2D, width: number, height: number) {
  const data = context.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  let exposure = 0;
  let glarePixels = 0;
  let saturationSum = 0;
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    gray[index] = luminance;
    exposure += luminance;
    if (luminance > 235) glarePixels += 1;
    saturationSum += maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
  }

  let gradientSum = 0;
  let gradientCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx = gray[index + 1] - gray[index - 1];
      const gy = gray[index + width] - gray[index - width];
      gradientSum += Math.sqrt(gx * gx + gy * gy);
      gradientCount += 1;
    }
  }

  return {
    gray,
    exposure: exposure / gray.length,
    glareRatio: glarePixels / gray.length,
    blurVariance: gradientCount ? gradientSum / gradientCount : 0,
    colorRichness: saturationSum / gray.length,
  };
}

function recordRegionsFromBuckets(buckets: { score: number; angle: number; radius: number; samples: number }[], targetCount: number) {
  const ranked = buckets
    .filter(bucket => bucket.samples > 0)
    .sort((left, right) => right.score / right.samples - left.score / left.samples)
    .slice(0, targetCount);
  return ranked.map((bucket, index) => {
    const strength = bucket.score / Math.max(1, bucket.samples);
    const severity = strength > 80 ? 'high' : strength > 54 ? 'medium' : 'low';
    const radius = bucket.radius;
    const centerX = 0.5 + Math.cos(bucket.angle) * radius;
    const centerY = 0.5 + Math.sin(bucket.angle) * radius;
    const tangent = bucket.angle + Math.PI / 2;
    const length = severity === 'high' ? 0.2 : severity === 'medium' ? 0.16 : 0.12;
    return {
      x1: round(clamp(centerX - Math.cos(tangent) * length / 2, 0.04, 0.96), 4),
      y1: round(clamp(centerY - Math.sin(tangent) * length / 2, 0.04, 0.96), 4),
      x2: round(clamp(centerX + Math.cos(tangent) * length / 2, 0.04, 0.96), 4),
      y2: round(clamp(centerY + Math.sin(tangent) * length / 2, 0.04, 0.96), 4),
      severity: index === 0 && targetCount > 3 ? severity : severity === 'high' ? 'medium' : severity,
    } as ScratchRegion;
  });
}

async function analyzeRecordSurfaceInBrowser(dataUrl: string, mediaType: 'image' | 'video'): Promise<LpRecognition | null> {
  const media = await canvasFromMedia(dataUrl, mediaType);
  if (!media) return null;
  const { canvas, context } = media;
  const { gray, exposure, glareRatio, blurVariance } = imageStats(context, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const minSide = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const buckets = Array.from({ length: 48 }, (_, index) => ({
    score: 0,
    samples: 0,
    angle: ((index % 12) / 12) * Math.PI * 2,
    radius: 0.18 + Math.floor(index / 12) * 0.08,
  }));
  const annulusValues: number[] = [];
  let annulusSamples = 0;
  let scratchHits = 0;
  let dustHits = 0;
  let centerLum = 0;
  let centerCount = 0;

  for (let y = 2; y < height - 2; y += 2) {
    for (let x = 2; x < width - 2; x += 2) {
      const index = y * width + x;
      const dx = (x - centerX) / minSide;
      const dy = (y - centerY) / minSide;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const luminance = gray[index];
      if (radius < 0.07) {
        centerLum += luminance;
        centerCount += 1;
      }
      if (radius < 0.13 || radius > 0.49) continue;
      annulusSamples += 1;
      annulusValues.push(luminance);
      const gx = gray[index + 1] - gray[index - 1];
      const gy = gray[index + width] - gray[index - width];
      const gradient = Math.sqrt(gx * gx + gy * gy);
      const scratchLike = gradient > 42 && luminance > 55 && luminance < 248;
      if (scratchLike) {
        scratchHits += 1;
        const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
        const angleBucket = Math.floor(angle / (Math.PI * 2) * 12);
        const radiusBucket = clamp(Math.floor((radius - 0.13) / 0.09), 0, 3);
        const bucket = buckets[radiusBucket * 12 + angleBucket];
        bucket.score += gradient;
        bucket.samples += 1;
      }
      if (luminance > 210 && gradient > 22) dustHits += 1;
    }
  }

  const scratchDensity = annulusSamples ? scratchHits / annulusSamples : 0;
  const dustRatio = annulusSamples ? dustHits / annulusSamples : 0;
  const grooveContrast = annulusValues.length ? (percentile(annulusValues, 0.85) - percentile(annulusValues, 0.15)) / 255 : 0;
  const centerAverage = centerCount ? centerLum / centerCount : exposure;
  const annulusAverage = annulusValues.length ? annulusValues.reduce((sum, value) => sum + value, 0) / annulusValues.length : exposure;
  const centerHoleConfidence = clamp((annulusAverage - centerAverage + 18) / 80, 0, 1);
  const scratchCount = Math.round(clamp(scratchDensity * 260 + dustRatio * 20 + glareRatio * 5, 0, 14));
  const dustPenalty = dustRatio * 95;
  const scratchPenalty = scratchDensity * 420;
  const reflectionPenalty = glareRatio * 44;
  const blurPenalty = blurVariance < 9 ? 9 : blurVariance < 15 ? 5 : 0;
  const contrastBoost = clamp(grooveContrast * 8, 0, 5);
  const surfaceScore = Math.round(clamp(94 - scratchPenalty - dustPenalty - reflectionPenalty - blurPenalty + contrastBoost, 42, 96));
  const scratchRegions = recordRegionsFromBuckets(buckets, Math.min(scratchCount, 9));

  return {
    isRecord: true,
    confidence: Math.round(clamp(68 + centerHoleConfidence * 18 + grooveContrast * 18 - glareRatio * 20, 45, 94)),
    surfaceScore,
    surfaceGrade: gradeFromScore(surfaceScore),
    scratchCount,
    scratchRisk: null,
    reflectionRisk: null,
    scratchRegions,
    scratchDetails: {
      displayedRegions: scratchRegions.length,
      highSeverity: scratchRegions.filter(region => region.severity === 'high').length,
      mediumSeverity: scratchRegions.filter(region => region.severity === 'medium').length,
      lowSeverity: scratchRegions.filter(region => region.severity === 'low').length,
      reflectionRatio: round(glareRatio, 3),
      blurVariance: round(blurVariance),
      exposure: round(exposure),
      dustRatio: round(dustRatio, 3),
      grooveContrast: round(grooveContrast, 3),
      scratchDensity: round(scratchDensity, 4),
      centerHoleConfidence: round(centerHoleConfidence, 2),
      detectedDisc: centerHoleConfidence > 0.28 || grooveContrast > 0.16,
    },
    dustOrReflectionNote: glareRatio >= 0.12
      ? '강한 반사가 많아 스크래치 후보가 과대 표시될 수 있습니다. 다른 각도의 사진을 한 장 더 추가하면 판정이 안정됩니다.'
      : dustRatio > 0.035
        ? '먼지 또는 표면 입자가 감지되었습니다. 클리닝 후 재촬영하면 실제 흠집과 먼지를 더 잘 구분할 수 있습니다.'
        : '판면 이미지의 홈 대비와 선형 흠집 후보를 기준으로 계산했습니다.',
    playbackImpact: null,
    signals: [
      `브라우저 Canvas 분석으로 홈 대비 ${round(grooveContrast * 100, 0)}%, 반사 ${round(glareRatio * 100, 1)}%를 확인했습니다.`,
      `스크래치 후보 밀도 ${round(scratchDensity * 100, 2)}%, 먼지/입자 후보 ${round(dustRatio * 100, 1)}%입니다.`,
      `스크래치 분석은 ${gradeFromScore(surfaceScore)} 등급, ${surfaceScore}점입니다.`,
    ],
  };
}

export function recognizeLpImage(dataUrl: string, mediaType: 'image' | 'video' = 'image'): LpRecognition {
  const hasMedia = dataUrl.length > 120;
  return {
    isRecord: hasMedia,
    source: 'fallback',
    analysisAvailable: false,
    analysisUnavailableReason: hasMedia ? '표면 이미지를 정밀 분석하지 못했습니다.' : '표면 이미지 또는 동영상이 없습니다.',
    confidence: 0,
    surfaceScore: 0,
    surfaceGrade: undefined,
    scratchCount: 0,
    scratchRisk: null,
    reflectionRisk: null,
    scratchRegions: [],
    scratchDetails: {
      displayedRegions: 0,
      highSeverity: 0,
      mediumSeverity: 0,
      lowSeverity: 0,
      reflectionRatio: null,
      blurVariance: null,
      exposure: null,
      dustRatio: null,
      grooveContrast: null,
      scratchDensity: null,
      centerHoleConfidence: null,
      detectedDisc: hasMedia,
    },
    dustOrReflectionNote: hasMedia ? '분석 불가 상태입니다. 밝은 환경에서 정면 사진을 다시 촬영해 주세요.' : '표면 이미지 또는 동영상을 추가해 주세요.',
    playbackImpact: null,
    signals: hasMedia
      ? [`${mediaType === 'video' ? '동영상' : '이미지'}를 받았지만 정밀 스크래치 분석은 완료되지 않았습니다.`]
      : ['아직 표면 이미지나 동영상이 없습니다.'],
  };
}

export function recognizeJacketImage(dataUrl: string): JacketRecognition {
  const hasImage = dataUrl.length > 120;
  const seed = stableContentSeed(dataUrl);
  const edgeWearRatio = hasImage ? ((seed >> 4) % 22) / 100 : null;
  const cornerWearRatio = hasImage ? ((seed >> 9) % 18) / 100 : null;
  const glareRatio = hasImage ? ((seed >> 14) % 14) / 100 : null;
  const colorRichness = hasImage ? 0.32 + ((seed >> 18) % 38) / 100 : null;
  const score = hasImage
    ? Math.round(clamp(92 - (edgeWearRatio || 0) * 95 - (cornerWearRatio || 0) * 80 - (glareRatio || 0) * 42 + (colorRichness || 0) * 8, 45, 95))
    : 0;
  return {
    isCover: hasImage,
    source: 'fallback',
    confidence: hasImage ? 58 : 0,
    jacketScore: score,
    jacketGrade: gradeFromScore(score),
    cornerWearRisk: riskFromRatio(cornerWearRatio || 0, 0.08, 0.15),
    edgeWearRisk: riskFromRatio(edgeWearRatio || 0, 0.1, 0.18),
    glareRisk: riskFromRatio(glareRatio || 0, 0.06, 0.12),
    colorFadeRisk: colorRichness !== null && colorRichness < 0.36 ? 'medium' : 'low',
    edgeWearRatio,
    cornerWearRatio,
    glareRatio,
    exposure: null,
    blurVariance: null,
    colorRichness,
    signals: hasImage
      ? ['자켓 이미지 기반 임시 분석입니다.', `자켓 등급은 ${gradeFromScore(score)} 수준으로 추정됩니다.`]
      : ['자켓 이미지를 추가하면 모서리 마모와 색 바램을 확인할 수 있습니다.'],
    recommendation: hasImage
      ? '자켓 모서리와 테두리 상태가 가격 신뢰도에 영향을 줍니다. 빛 반사가 적은 정면 사진을 함께 올리면 좋습니다.'
      : '자켓 정면 사진을 추가해 주세요.',
  };
}

function normalizeRisk(value: unknown): 'low' | 'medium' | 'high' {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function worstRisk(...values: Array<'low' | 'medium' | 'high'>): 'low' | 'medium' | 'high' {
  if (values.includes('high')) return 'high';
  if (values.includes('medium')) return 'medium';
  return 'low';
}

function normalizeServerJacketResponse(payload: Record<string, unknown>): JacketRecognition {
  const details = payload.jacketDetails && typeof payload.jacketDetails === 'object'
    ? payload.jacketDetails as Record<string, unknown>
    : {};
  const score = Number(payload.jacketScore || 70);
  const cornerWearRisk = normalizeRisk(payload.cornerWear);
  const ringWearRisk = normalizeRisk(payload.ringWear);
  const stainRisk = normalizeRisk(payload.stainRisk);
  const tearOrCreaseRisk = normalizeRisk(payload.tearOrCreaseRisk);
  const edgeWearRisk = worstRisk(cornerWearRisk, ringWearRisk, tearOrCreaseRisk);
  const confidencePenalty = [cornerWearRisk, ringWearRisk, stainRisk, tearOrCreaseRisk].filter(risk => risk === 'high').length * 6
    + [cornerWearRisk, ringWearRisk, stainRisk, tearOrCreaseRisk].filter(risk => risk === 'medium').length * 2;
  const notes = Array.isArray(payload.notes) ? payload.notes.map(String).filter(Boolean) : [];

  return {
    isCover: true,
    source: 'server',
    confidence: Math.round(clamp(84 - confidencePenalty, 52, 92)),
    jacketScore: Math.round(clamp(score, 0, 100)),
    jacketGrade: String(payload.jacketGrade || gradeFromScore(score)),
    cornerWearRisk,
    edgeWearRisk,
    glareRisk: 'low',
    colorFadeRisk: stainRisk,
    edgeWearRatio: typeof details.edgeDensity === 'number' ? details.edgeDensity : null,
    cornerWearRatio: typeof details.edgeDensity === 'number' ? details.edgeDensity : null,
    glareRatio: null,
    exposure: null,
    blurVariance: null,
    colorRichness: null,
    signals: [
      '서버 이미지 분석으로 자켓 모서리, 테두리, 얼룩, 접힘 후보를 확인했습니다.',
      ...notes,
    ],
    recommendation: edgeWearRisk === 'high' || stainRisk === 'high'
      ? '자켓 손상 후보가 큽니다. 테두리와 모서리 근접 사진을 추가하면 구매자가 상태를 더 명확히 판단할 수 있습니다.'
      : '자켓 상태는 참고용으로 양호하게 보입니다. 반사가 적은 정면 사진을 함께 등록하면 신뢰도가 높아집니다.',
  };
}

export async function analyzeJacketImage(dataUrl: string): Promise<JacketRecognition> {
  if (!dataUrl) return recognizeJacketImage('');
  try {
    const formData = new FormData();
    formData.append('file', dataUrlToFile(dataUrl, 'jacket-condition.jpg'));
    const response = await fetchApi('/analysis/jacket-condition', { method: 'POST', body: formData }, 12000);
    if (response.ok) {
      return normalizeServerJacketResponse(await response.json() as Record<string, unknown>);
    }
  } catch {
    // Browser analysis below is the offline fallback.
  }
  try {
    const media = await canvasFromMedia(dataUrl, 'image');
    if (!media) return recognizeJacketImage(dataUrl);
    const { canvas, context } = media;
    const { gray, exposure, glareRatio, blurVariance, colorRichness } = imageStats(context, canvas.width, canvas.height);
    const width = canvas.width;
    const height = canvas.height;
    const edgeBand = Math.max(5, Math.round(Math.min(width, height) * 0.08));
    const cornerBand = Math.max(12, Math.round(Math.min(width, height) * 0.18));
    const edgeValues: number[] = [];
    const innerValues: number[] = [];
    let paleEdgePixels = 0;
    let edgePixels = 0;
    let paleCornerPixels = 0;
    let cornerPixels = 0;

    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const value = gray[y * width + x];
        const inEdge = x < edgeBand || y < edgeBand || x >= width - edgeBand || y >= height - edgeBand;
        const inInner = x > edgeBand * 2 && y > edgeBand * 2 && x < width - edgeBand * 2 && y < height - edgeBand * 2;
        const inCorner = (x < cornerBand || x >= width - cornerBand) && (y < cornerBand || y >= height - cornerBand);
        if (inEdge) {
          edgeValues.push(value);
          edgePixels += 1;
          if (value > 188 || value < 32) paleEdgePixels += 1;
        } else if (inInner) {
          innerValues.push(value);
        }
        if (inCorner) {
          cornerPixels += 1;
          if (value > 190 || value < 30) paleCornerPixels += 1;
        }
      }
    }

    const edgeAvg = edgeValues.length ? edgeValues.reduce((sum, value) => sum + value, 0) / edgeValues.length : exposure;
    const innerAvg = innerValues.length ? innerValues.reduce((sum, value) => sum + value, 0) / innerValues.length : exposure;
    const edgeContrast = Math.abs(edgeAvg - innerAvg) / 255;
    const edgeWearRatio = clamp((paleEdgePixels / Math.max(1, edgePixels)) * 0.62 + edgeContrast * 0.72, 0, 1);
    const cornerWearRatio = clamp((paleCornerPixels / Math.max(1, cornerPixels)) * 0.72 + edgeContrast * 0.38, 0, 1);
    const fadeRiskValue = clamp((0.34 - colorRichness) * 2.2 + Math.max(0, exposure - 174) / 190, 0, 1);
    const score = Math.round(clamp(
      96
      - edgeWearRatio * 34
      - cornerWearRatio * 30
      - glareRatio * 18
      - fadeRiskValue * 16
      - (blurVariance < 9 ? 7 : blurVariance < 15 ? 3 : 0),
      42,
      97,
    ));

    return {
      isCover: true,
      source: 'browser',
      confidence: Math.round(clamp(70 + colorRichness * 24 - glareRatio * 28 - edgeWearRatio * 10, 45, 94)),
      jacketScore: score,
      jacketGrade: gradeFromScore(score),
      cornerWearRisk: riskFromRatio(cornerWearRatio, 0.18, 0.32),
      edgeWearRisk: riskFromRatio(edgeWearRatio, 0.18, 0.34),
      glareRisk: riskFromRatio(glareRatio, 0.06, 0.13),
      colorFadeRisk: fadeRiskValue >= 0.48 ? 'high' : fadeRiskValue >= 0.24 ? 'medium' : 'low',
      edgeWearRatio: round(edgeWearRatio, 3),
      cornerWearRatio: round(cornerWearRatio, 3),
      glareRatio: round(glareRatio, 3),
      exposure: round(exposure),
      blurVariance: round(blurVariance),
      colorRichness: round(colorRichness, 3),
      signals: [
        `테두리 마모 후보 ${round(edgeWearRatio * 100, 1)}%, 모서리 마모 후보 ${round(cornerWearRatio * 100, 1)}%입니다.`,
        `색 정보량 ${round(colorRichness * 100, 0)}%, 반사 ${round(glareRatio * 100, 1)}%를 기준으로 자켓 보존도를 계산했습니다.`,
        `자켓 등급은 ${gradeFromScore(score)} 수준으로 추정됩니다.`,
      ],
      recommendation: glareRatio > 0.1
        ? '자켓에 빛 반사가 많습니다. 무광 환경에서 정면 사진을 한 장 더 올리면 구매자가 상태를 더 쉽게 판단할 수 있습니다.'
        : edgeWearRatio > 0.28 || cornerWearRatio > 0.28
          ? '테두리 또는 모서리 마모가 보입니다. 해당 부위를 근접 사진으로 추가하면 분쟁 가능성을 줄일 수 있습니다.'
          : '자켓 상태가 비교적 안정적으로 보입니다. 판면 사진과 함께 등록하면 신뢰도가 높아집니다.',
    };
  } catch {
    return recognizeJacketImage(dataUrl);
  }
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
    const serverResult = await response.json() as LpRecognition & { persisted?: boolean; source?: string };
    if (serverResult.source === 'fallback') {
      const local = await analyzeRecordSurfaceInBrowser(dataUrl, mediaType).catch(() => null);
      if (local) {
        return {
          ...local,
          source: 'browser-canvas',
          signals: [
            ...local.signals,
            '서버 fallback 결과를 그대로 쓰지 않고 브라우저 프레임 분석으로 재확인했습니다.',
          ],
        };
      }
    }
    return serverResult;
  } catch {
    const local = await analyzeRecordSurfaceInBrowser(dataUrl, mediaType).catch(() => null);
    return { ...(local || recognizeLpImage(dataUrl, mediaType)), source: local ? 'browser-canvas' : 'fallback' };
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
    const sourceBuffer = await timeoutAfter(file.arrayBuffer(), 6000, 'Audio file read timed out');
    const decoded = await timeoutAfter(context.decodeAudioData(sourceBuffer.slice(0)), 8000, 'Audio decode timed out');
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

type BrowserAudioSample = AudioSampleAnalysis & {
  rawScore: number;
  noisePower: number;
};

async function decodeAudioFile(file: File) {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  try {
    const buffer = await timeoutAfter(file.arrayBuffer(), 6000, 'Audio file read timed out');
    return await timeoutAfter(context.decodeAudioData(buffer.slice(0)), 8000, 'Audio decode timed out');
  } finally {
    void context.close().catch(() => undefined);
  }
}

function analyzeDecodedAudio(file: File, buffer: AudioBuffer, requestedSeconds: number, label: AudioSampleLabel): BrowserAudioSample {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const mono = new Float32Array(length);
  const channelRms: number[] = [];
  for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
    const channel = buffer.getChannelData(channelIndex);
    let channelPower = 0;
    for (let index = 0; index < length; index += 1) {
      const value = channel[index];
      mono[index] += value / channels;
      channelPower += value * value;
    }
    channelRms.push(Math.sqrt(channelPower / Math.max(1, length)));
  }

  let peak = 0;
  let power = 0;
  let clipped = 0;
  let diffSum = 0;
  const frameRmsDb: number[] = [];
  const highFrequencyFrameRatios: number[] = [];
  const frameSize = Math.min(4096, Math.max(1024, Math.round(sampleRate * 0.046)));
  const hop = Math.max(512, Math.round(frameSize / 2));
  for (let start = 0; start < length; start += hop) {
    let framePower = 0;
    let frameDiffSum = 0;
    let count = 0;
    for (let index = start; index < Math.min(length, start + frameSize); index += 1) {
      const value = mono[index];
      const abs = Math.abs(value);
      peak = Math.max(peak, abs);
      power += value * value;
      if (abs > 0.985) clipped += 1;
      if (index > 0) {
        const delta = Math.abs(value - mono[index - 1]);
        diffSum += delta;
        frameDiffSum += delta;
      }
      framePower += value * value;
      count += 1;
    }
    if (count) {
      const frameRms = Math.sqrt(framePower / count);
      frameRmsDb.push(dbFromAmplitude(frameRms));
      highFrequencyFrameRatios.push(clamp(frameDiffSum / count / Math.max(0.0001, frameRms), 0, 2.5));
    }
  }

  const rms = Math.sqrt(power / Math.max(1, length));
  const noiseFloorDb = percentile(frameRmsDb, 0.16);
  const dynamicRangeDb = percentile(frameRmsDb, 0.92) - percentile(frameRmsDb, 0.18);
  const durationSeconds = length / sampleRate;
  const clippingRatio = clipped / Math.max(1, length);
  const highFrequencyNoise = clamp(diffSum / Math.max(1, length) / Math.max(0.0001, rms), 0, 1.6);
  const highFrequencyMedian = percentile(highFrequencyFrameRatios, 0.5);
  const highFrequencyMad = percentile(highFrequencyFrameRatios.map(value => Math.abs(value - highFrequencyMedian)), 0.5);
  const spectralIssueThreshold = Math.max(0.7, highFrequencyMedian + highFrequencyMad * 4.0);
  const frameSeconds = hop / sampleRate;
  const spectralIssueSummary = summarizeIssueFrames(
    highFrequencyFrameRatios.map(value => label !== 'ambient' && value >= spectralIssueThreshold),
    frameSeconds,
  );
  const spectralIssueDurationRatio = durationSeconds ? spectralIssueSummary.durationSeconds / durationSeconds : 0;
  const spectralIssueRate = durationSeconds ? spectralIssueSummary.count / durationSeconds * 60 : 0;
  const spectralCountPenalty = label === 'ambient' ? 0 : clamp(spectralIssueRate * 0.4, 0, 14);
  const spectralDurationPenalty = label === 'ambient' ? 0 : clamp(spectralIssueDurationRatio * 12, 0, 4);
  const spectralPenalty = spectralCountPenalty + spectralDurationPenalty;
  let clickCount = 0;
  let lastClickIndex = -sampleRate;
  const clickThreshold = Math.max(0.34, rms * 7.4);
  const scanStep = Math.max(1, Math.floor(length / 360000));
  for (let index = scanStep; index < length; index += scanStep) {
    const diff = Math.abs(mono[index] - mono[index - scanStep]);
    if (diff > clickThreshold && Math.abs(mono[index]) > rms * 2.6 && index - lastClickIndex > sampleRate * 0.045) {
      clickCount += 1;
      lastClickIndex = index;
    }
  }
  const clicksPerMinute = durationSeconds ? clickCount / durationSeconds * 60 : 0;
  const channelImbalanceDb = channelRms.length >= 2
    ? Math.abs(dbFromAmplitude(channelRms[0]) - dbFromAmplitude(channelRms[1]))
    : 0;
  const rawScore = label === 'ambient' ? 0 : audioScoreFromClicks(clickCount, durationSeconds);
  return {
    filename: file.name,
    requestedSeconds,
    durationSeconds: round(durationSeconds, 1),
    score: label === 'ambient' ? undefined : rawScore,
    rawScore,
    estimatedNoiseLevel: null,
    scratchRisk: null,
    usableForListingSample: label !== 'ambient' && rawScore >= 70,
    clickCount,
    clicksPerMinute: round(clicksPerMinute),
    noiseFloorDb: round(noiseFloorDb),
    adjustedNoiseFloorDb: null,
    dynamicRangeDb: round(dynamicRangeDb),
    clippingRisk: null,
    clippingRatio: round(clippingRatio, 4),
    channelImbalanceDb: round(channelImbalanceDb),
    peakDb: round(dbFromAmplitude(peak)),
    rmsDb: round(dbFromAmplitude(rms)),
    transientDensity: round(clicksPerMinute / 60, 3),
    highFrequencyNoise: round(highFrequencyNoise, 3),
    spectralIssueCount: spectralIssueSummary.count,
    spectralIssueDurationSeconds: round(spectralIssueSummary.durationSeconds, 2),
    spectralIssueRate: round(spectralIssueRate, 1),
    spectralIssueDurationRatio: round(spectralIssueDurationRatio, 3),
    spectralPenalty: round(spectralPenalty, 1),
    problemFrequencyRangeHz: AUDIO_PROBLEM_FREQUENCY_RANGE_HZ,
    noisePower: 10 ** (noiseFloorDb / 10),
  };
}

async function analyzeAudioSamplesInBrowser(files: AudioAnalysisFiles): Promise<AudioAnalysisResult | null> {
  const primaryFile = files.sample || files.good || files.noisy;
  if (!primaryFile) return null;

  const [primaryBuffer, ambientBuffer] = await Promise.all([
    decodeAudioFile(primaryFile).catch(() => null),
    files.ambient ? decodeAudioFile(files.ambient).catch(() => null) : Promise.resolve(null),
  ]);
  const audioSample = primaryBuffer ? analyzeDecodedAudio(primaryFile, primaryBuffer, MIN_AUDIO_ANALYSIS_SECONDS, 'sample') : null;
  const ambientSample = files.ambient && ambientBuffer ? analyzeDecodedAudio(files.ambient, ambientBuffer, 5, 'ambient') : null;
  if (!audioSample) return null;

  const ambientDb = ambientSample?.noiseFloorDb ?? null;
  audioSample.adjustedNoiseFloorDb = subtractNoiseFloorDb(audioSample.noiseFloorDb, ambientDb);
  const clickCount = audioSample.clickCount || 0;
  const durationSeconds = Number(audioSample.durationSeconds || 0);
  const noiseFloorDb = audioSample.noiseFloorDb ?? null;
  const adjustedNoiseFloorDb = subtractNoiseFloorDb(noiseFloorDb, ambientDb);
  const dynamicRangeDb = audioSample.dynamicRangeDb ?? null;
  const analyzedSamples = [audioSample];
  const spectralIssueCount = analyzedSamples.reduce((sum, sample) => sum + Number(sample.spectralIssueCount || 0), 0);
  const spectralIssueDurationSeconds = analyzedSamples.reduce((sum, sample) => sum + Number(sample.spectralIssueDurationSeconds || 0), 0);
  const spectralTotalDurationSeconds = analyzedSamples.reduce((sum, sample) => sum + Number(sample.durationSeconds || 0), 0);
  const spectralIssueRate = spectralTotalDurationSeconds ? spectralIssueCount / spectralTotalDurationSeconds * 60 : 0;
  const spectralIssueDurationRatio = spectralTotalDurationSeconds ? spectralIssueDurationSeconds / spectralTotalDurationSeconds : 0;
  const spectralPenalty = analyzedSamples.reduce((sum, sample) => sum + Number(sample.spectralPenalty || 0), 0) / Math.max(1, analyzedSamples.length);
  if (durationSeconds < MIN_AUDIO_ANALYSIS_SECONDS) {
    return {
      source: 'browser',
      analysisAvailable: false,
      analysisUnavailableReason: `음질 샘플은 최소 ${MIN_AUDIO_ANALYSIS_SECONDS}초 이상 녹음해야 합니다.`,
      audioScore: null,
      audioGrade: null,
      lpConditionScore: null,
      lpConditionGrade: null,
      environmentScore: null,
      environmentGrade: null,
      playbackRisk: null,
      clickCount,
      noiseFloorDb,
      ambientNoiseFloorDb: ambientDb,
      adjustedNoiseFloorDb,
      dynamicRangeDb,
      clippingRisk: null,
      channelImbalanceDb: audioSample.channelImbalanceDb ?? null,
      highFrequencyNoise: audioSample.highFrequencyNoise ?? null,
      spectralIssueCount,
      spectralIssueDurationSeconds: round(spectralIssueDurationSeconds, 2),
      spectralIssueRate: round(spectralIssueRate, 1),
      spectralIssueDurationRatio: round(spectralIssueDurationRatio, 3),
      spectralPenalty: round(spectralPenalty, 1),
      problemFrequencyRangeHz: AUDIO_PROBLEM_FREQUENCY_RANGE_HZ,
      analysisConfidence: 0,
      warnings: [`음질 샘플이 ${round(durationSeconds, 1)}초라서 최소 ${MIN_AUDIO_ANALYSIS_SECONDS}초 기준을 충족하지 못했습니다.`],
      audioSample,
      goodSample: null,
      noisySample: null,
      ambientSample,
      summary: `음질 샘플은 최소 ${MIN_AUDIO_ANALYSIS_SECONDS}초 이상 녹음해야 합니다.`,
    };
  }
  const audioScore = audioScoreFromClicks(clickCount, durationSeconds);
  const warnings = [
    '서버 분석 대신 기기 내 Web Audio 분석을 사용했습니다.',
    spectralIssueRate >= 16 || spectralIssueCount >= 8 ? '클릭/팝 후보를 음질 점수에 반영했습니다.' : '',
  ].filter(Boolean);
  const analysisConfidence = Math.round(clamp(58 + Math.min(22, durationSeconds / 3) + (dynamicRangeDb || 0), 45, 96));
  const channelImbalanceDb = audioSample.channelImbalanceDb ?? null;

  return {
    source: 'browser',
    analysisAvailable: true,
    audioScore,
    audioGrade: gradeFromScore(audioScore),
    lpConditionScore: audioScore,
    lpConditionGrade: gradeFromScore(audioScore),
    environmentScore: null,
    environmentGrade: null,
    playbackRisk: null,
    clickCount,
    noiseFloorDb,
    ambientNoiseFloorDb: ambientDb,
    adjustedNoiseFloorDb,
    dynamicRangeDb,
    clippingRisk: null,
    channelImbalanceDb,
    highFrequencyNoise: audioSample.highFrequencyNoise ?? null,
    spectralIssueCount,
    spectralIssueDurationSeconds: round(spectralIssueDurationSeconds, 2),
    spectralIssueRate: round(spectralIssueRate, 1),
    spectralIssueDurationRatio: round(spectralIssueDurationRatio, 3),
    spectralPenalty: round(spectralPenalty, 1),
    problemFrequencyRangeHz: AUDIO_PROBLEM_FREQUENCY_RANGE_HZ,
    analysisConfidence,
    warnings,
    audioSample,
    goodSample: null,
    noisySample: null,
    ambientSample,
    summary: `Web Audio 분석 기준 ${gradeFromScore(audioScore)} 등급, ${audioScore}점입니다. 감점은 뚝소리 후보 횟수와 녹음 시간만 반영했습니다.`,
  };
}

function fallbackAudioAnalysis(files: AudioAnalysisFiles, reason = '오디오 파일을 직접 해석하지 못해 분석 불가로 분리했습니다.'): AudioAnalysisResult {
  return {
    source: 'fallback',
    analysisAvailable: false,
    analysisUnavailableReason: reason,
    audioScore: null,
    audioGrade: null,
    lpConditionScore: null,
    lpConditionGrade: null,
    environmentScore: null,
    environmentGrade: null,
    playbackRisk: null,
    clickCount: undefined,
    noiseFloorDb: null,
    ambientNoiseFloorDb: null,
    adjustedNoiseFloorDb: null,
    dynamicRangeDb: null,
    clippingRisk: null,
    channelImbalanceDb: null,
    highFrequencyNoise: null,
    spectralIssueCount: null,
    spectralIssueDurationSeconds: null,
    spectralIssueRate: null,
    spectralIssueDurationRatio: null,
    spectralPenalty: null,
    problemFrequencyRangeHz: null,
    analysisConfidence: 0,
    warnings: [reason],
    audioSample: files.sample ? { filename: files.sample.name, requestedSeconds: MIN_AUDIO_ANALYSIS_SECONDS, estimatedNoiseLevel: null, scratchRisk: null, usableForListingSample: false } : null,
    goodSample: files.good ? { filename: files.good.name, requestedSeconds: 30, estimatedNoiseLevel: null, scratchRisk: null, usableForListingSample: false } : null,
    noisySample: files.noisy ? { filename: files.noisy.name, requestedSeconds: 30, estimatedNoiseLevel: null, scratchRisk: null, usableForListingSample: false } : null,
    ambientSample: files.ambient ? { filename: files.ambient.name, requestedSeconds: 5, score: 0, estimatedNoiseLevel: null, scratchRisk: null, usableForListingSample: false } : null,
    summary: '정밀 파형 해석이 불가능해 음질 점수와 등급을 표시하지 않습니다. WAV/M4A/WebM 파일로 다시 녹음해 주세요.',
  };
}

async function analyzeAudioSamplesOnServer(files: AudioAnalysisFiles) {
  const formData = new FormData();
  const [sample, good, noisy, ambient] = await Promise.all([
    files.sample ? convertAudioFileForAnalysis(files.sample, 'audio-sample') : Promise.resolve(undefined),
    files.good ? convertAudioFileForAnalysis(files.good, 'good-section') : Promise.resolve(undefined),
    files.noisy ? convertAudioFileForAnalysis(files.noisy, 'bad-section') : Promise.resolve(undefined),
    files.ambient ? convertAudioFileForAnalysis(files.ambient, 'ambient') : Promise.resolve(undefined),
  ]);
  if (sample) formData.append('audio_sample', sample);
  if (good) formData.append('good_sample', good);
  if (noisy) formData.append('noisy_sample', noisy);
  if (ambient) formData.append('ambient_sample', ambient);
  const response = await timeoutAfter(fetchApi('/analysis/audio-samples', { method: 'POST', body: formData }, 12000), 14000, 'Audio analysis timed out');
  if (!response.ok) throw new Error('Audio analysis failed');
  return await response.json() as AudioAnalysisResult;
}

function withAudioRecheckWarning(primary: AudioAnalysisResult, secondary: AudioAnalysisResult | null): AudioAnalysisResult {
  if (!secondary) return primary;
  if (primary.analysisAvailable === false || secondary.analysisAvailable === false || primary.audioScore == null || secondary.audioScore == null) return primary;
  const warnings = [...(primary.warnings || [])];
  const scoreGap = Math.abs(Number(primary.audioScore || 0) - Number(secondary.audioScore || 0));
  if (scoreGap >= 10) {
    warnings.push(`서버와 기기 내 보조 분석 결과 차이가 있어 재확인을 권장합니다. 서버 ${primary.audioScore}점, 기기 ${secondary.audioScore}점입니다.`);
  }
  return { ...primary, warnings };
}

export async function analyzeAudioSamples(files: AudioAnalysisFiles): Promise<AudioAnalysisResult> {
  if (!files.sample && !files.good && !files.noisy) {
    return fallbackAudioAnalysis(files, '음질 샘플 녹음이 없어 정밀 분석을 실행할 수 없습니다.');
  }

  const browserResultPromise = timeoutAfter(
    analyzeAudioSamplesInBrowser(files),
    9000,
    'Local audio analysis timed out',
  ).catch(() => null);

  try {
    const serverResult = await analyzeAudioSamplesOnServer(files);
    const browserResult = await browserResultPromise;
    if (serverResult.source === 'fallback' && browserResult) {
      return {
        ...browserResult,
        warnings: [
          ...(browserResult.warnings || []),
          '서버 정밀 분석이 fallback으로 내려와 기기 내 파형 분석 결과로 재확인했습니다.',
        ],
      };
    }
    return withAudioRecheckWarning(serverResult, browserResult);
  } catch {
    const browserResult = await browserResultPromise;
    if (browserResult) return browserResult;
    return fallbackAudioAnalysis(files, '기기 내 분석과 서버 분석이 모두 실패해 분석 불가로 분리했습니다.');
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
}): Promise<PriceRecommendation> {
  const query = new URLSearchParams();
  if (params.catalogNumber) query.set('catalog_number', params.catalogNumber);
  if (params.title) query.set('title', params.title);
  if (params.artist) query.set('artist', params.artist);
  if (params.releaseId) query.set('release_id', String(params.releaseId));
  if (params.surfaceScore) query.set('surface_score', String(params.surfaceScore));
  if (params.audioScore) query.set('audio_score', String(params.audioScore));
  const serverRecommendation = (async () => {
    const response = await timeoutAfter(fetchApi(`/pricing/recommendation?${query.toString()}`, {}, 6500), 7500, 'Price recommendation timed out');
    if (!response.ok) throw new Error('Price recommendation failed');
    return await response.json() as PriceRecommendation;
  })();
  const directRecommendation = delay(1800).then(async () => {
    const direct = await timeoutAfter(fetchDiscogsPriceRecommendationDirect(params), 9000, 'Discogs direct price lookup timed out');
    if (!direct) throw new Error('Discogs direct price lookup failed');
    return direct;
  });

  return firstSuccessful([serverRecommendation, directRecommendation]);
}

function delay(ms: number) {
  return new Promise<void>(resolve => window.setTimeout(resolve, ms));
}

function firstSuccessful<T>(promises: Array<Promise<T>>) {
  return new Promise<T>((resolve, reject) => {
    let pending = promises.length;
    let lastError: unknown = null;
    promises.forEach(promise => {
      promise.then(resolve).catch(error => {
        lastError = error;
        pending -= 1;
        if (pending === 0) reject(lastError instanceof Error ? lastError : new Error('All price lookups failed'));
      });
    });
  }
  );
}

function clientCurrencyToKrw(value: number, currency = 'USD') {
  const rates: Record<string, number> = {
    KRW: 1,
    USD: 1350,
    EUR: 1460,
    GBP: 1710,
    JPY: 9,
  };
  return Math.round(value * (rates[currency.toUpperCase()] || rates.USD));
}

function parseDiscogsPrice(value: unknown) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return parseDiscogsPrice((value as Record<string, unknown>).value);
  const cleaned = String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function directCondition(surfaceScore?: number, audioScore?: number) {
  const surface = Number(surfaceScore || 72);
  const audio = Number(audioScore || 72);
  const combined = surface * 0.45 + audio * 0.55;
  if (combined >= 96) return 'Mint (M)';
  if (combined >= 88) return 'Near Mint (NM or M-)';
  if (combined >= 80) return 'Excellent (EX)';
  if (combined >= 70) return 'Very Good Plus (VG+)';
  if (combined >= 58) return 'Very Good (VG)';
  if (combined >= 45) return 'Good (G)';
  return 'Poor (P)';
}

function directQualityMultiplier(params: { surfaceScore?: number; audioScore?: number }) {
  const surface = Number(params.surfaceScore || 72);
  const audio = Number(params.audioScore || 72);
  let multiplier = 1;
  if (surface >= 88 && audio >= 86) multiplier += 0.05;
  if (surface < 58) multiplier -= 0.06;
  if (audio < 58) multiplier -= 0.06;
  return clamp(multiplier, 0.62, 1.08);
}

async function fetchDiscogsPriceRecommendationDirect(params: {
  catalogNumber?: string;
  title?: string;
  artist?: string;
  releaseId?: number;
  surfaceScore?: number;
  audioScore?: number;
}): Promise<PriceRecommendation | null> {
  let releaseId = params.releaseId || 0;
  let releaseTitle = '';
  if (!releaseId) {
    const lookup = await fetchDiscogsCandidatesDirect(params.catalogNumber || '', params.title || '', params.artist || '');
    const first = lookup.candidates[0];
    releaseId = first?.releaseId || 0;
    releaseTitle = first ? `${first.artist} - ${first.title}` : '';
  }
  if (!releaseId) return null;

  const statsResponse = await fetch(`https://api.discogs.com/marketplace/stats/${releaseId}`);
  if (!statsResponse.ok) return null;
  const stats = await statsResponse.json() as { lowest_price?: { value?: number; currency?: string } | number; num_for_sale?: number };
  const lowest = stats.lowest_price;
  const currency = typeof lowest === 'object' && lowest ? String(lowest.currency || 'USD') : 'USD';
  const amount = parseDiscogsPrice(lowest);
  if (!amount) return null;

  const marketplaceLow = clientCurrencyToKrw(amount, currency);
  const adjusted = Math.max(1000, Math.round((marketplaceLow * 0.96 * directQualityMultiplier(params)) / 1000) * 1000);
  const condition = directCondition(params.surfaceScore, params.audioScore);
  return {
    recommended_price: adjusted,
    price_range: {
      min: Math.round(adjusted * 0.9 / 1000) * 1000,
      max: Math.round(adjusted * 1.12 / 1000) * 1000,
    },
    source: 'discogs',
    condition,
    release_id: releaseId,
    release_title: releaseTitle,
    currency: 'KRW',
    confidence: 74,
    discogs: {
      suggestedPrice: null,
      marketplaceLow,
      numForSale: Number(stats.num_for_sale || 0),
      inputCurrency: currency,
      releaseUrl: `https://www.discogs.com/release/${releaseId}`,
      conditionUsed: condition,
      salesHistoryAvailable: false,
      salesHistorySource: 'Discogs marketplace stats',
      priceSuggestionError: '서버 가격 추천이 지연되어 브라우저에서 Discogs 현재 판매가를 직접 확인했습니다. 판매 이력 가격표는 서버 인증이 필요합니다.',
      conditionPrices: [],
    },
    reason: `Discogs 현재 판매 최저가와 표면 ${params.surfaceScore || '-'}점, 음질 ${params.audioScore || '-'}점을 함께 반영했습니다.`,
  };
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
