export interface MarketMetrics {
  listingCount: number;
  buyOrderCount?: number;
  favoriteCount: number;
  wishlistCount?: number;
  viewCount: number;
  recentTradeCount: number;
}

export interface MarketPriceEstimate {
  marketKey: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  recommendedPrice: number;
  instantSalePrice?: number;
  instantSaleAvailable?: boolean;
  sellerPrice: number;
  isValidPrice: boolean;
  priceStatus: 'below_range' | 'within_range' | 'above_range' | string;
  metrics: MarketMetrics;
  reason?: string;
}

export interface MarketAdviceItem {
  type: string;
  severity: 'positive' | 'info' | 'warning' | 'high' | string;
  message: string;
}

export interface MarketAdviceResponse {
  listingId: string;
  estimate: MarketPriceEstimate;
  advice: MarketAdviceItem[];
}

export interface BuyOrder {
  id: string;
  buyerId: string;
  buyerAlias?: string;
  chatId?: string;
  listingId?: string | null;
  marketKey: string;
  maxPrice: number;
  minMediaGrade: string;
  minSleeveGrade: string;
  pressingCondition?: string | null;
  isFirstPressOnly: boolean;
  regionPreference?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface WishlistItem {
  id: string;
  userId: string;
  listingId?: string | null;
  marketKey: string;
  title: string;
  artist: string;
  catalogNumber: string;
  discogsReleaseId?: number | null;
  coverImageUrl?: string;
  releaseLabel?: string;
  releaseCountry?: string;
  year?: number | null;
  pressingCondition?: string | null;
  visibility: 'private' | 'public';
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  catalogNumber: string;
  discogsReleaseId?: number | null;
  discogsCoverImageUrl?: string;
  releaseLabel?: string;
  releaseCountry?: string;
  pressingCondition?: string | null;
  price: number;
  priceRange: { min: number; max: number };
  audioGrade: string;
  audioScore: number;
  jacketGrade?: string;
  jacketScore?: number;
  isRare: boolean;
  isFirstPress: boolean;
  ownedByMe?: boolean;
  audioSamples?: {
    sample?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
    good?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
    noisy?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number; recordedAt?: string };
  };
  images: string[];
  coverImageDataUrl?: string;
  recordImageDataUrl?: string;
  recordVideoDataUrl?: string;
  analysisReport?: Record<string, unknown>;
  description: string;
  tags?: string[];
  seller: {
    id: string;
    name: string;
    rating: number;
    transactionCount: number;
  };
  location: string;
  views: number;
  createdAt: string;
  status?: 'published' | 'hidden' | 'reserved' | 'sold' | string;
  viewCount?: number;
  favoriteCount?: number;
  buyOrderCount?: number;
  wishlistCount?: number;
  marketKey?: string;
  basePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  recommendedPrice?: number;
  instantSalePrice?: number;
  sellerPrice?: number;
  market?: MarketPriceEstimate;
}

const escapeSvgText = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const mockCover = (background: string, accent: string, title: string, subtitle: string) => {
  const safeTitle = escapeSvgText(title);
  const safeSubtitle = escapeSvgText(subtitle);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <rect width="240" height="240" rx="18" fill="${background}"/>
      <rect x="18" y="18" width="204" height="204" rx="12" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="2"/>
      <circle cx="122" cy="124" r="72" fill="#0f172a" opacity=".86"/>
      <circle cx="122" cy="124" r="54" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>
      <circle cx="122" cy="124" r="36" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="2"/>
      <circle cx="122" cy="124" r="20" fill="${accent}"/>
      <circle cx="122" cy="124" r="5" fill="rgba(255,255,255,.82)"/>
      <text x="24" y="46" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="700">${safeTitle}</text>
      <text x="24" y="68" fill="rgba(255,255,255,.72)" font-family="Arial, sans-serif" font-size="12">${safeSubtitle}</text>
      <text x="24" y="206" fill="rgba(255,255,255,.68)" font-family="Arial, sans-serif" font-size="11" letter-spacing="2">VINYL CHECK</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const abbeyRoadAnniversaryCover = '/images/the-beatles-abbey-road-anniversary.jpg';
const abbeyRoadMedleySample = '/audio-samples/abbey-road-medley-vinyl.mp3';
const beatlesLoveSongsCover = '/images/the-beatles-love-songs-1977.jpg';
const beatlesLoveSongsSample = '/audio-samples/the-beatles-love-songs-1977-part2.mp3';
const beatlesLoveSongsDiscogsCover = 'https://i.discogs.com/zvVZCH8EPkFIReDmpmnxX1TlMJNZ_LNu1vl2WEg0iKI/rs:fit/g:sm/q:90/h:600/w:597/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTc5NjQy/MzQtMTQ1MjUzNjQ4/My04MzE0LmpwZWc.jpeg';
const sakamotoPlayingPianoCover = '/images/ryuichi-sakamoto-playing-the-piano-12122020.jpg';
const sakamotoPlayingPianoSample = '/audio-samples/ryuichi-sakamoto-playing-the-piano-12122020.mp3';
const sakamotoPlayingPianoDiscogsCover = 'https://i.discogs.com/tm8n8mJKO-sQqs9760Quz8WWBjWrPgzTKjypfJoIjyY/rs:fit/g:sm/q:90/h:588/w:600/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9SLTIxMzQy/ODgzLTE2NDEyMDg1/MTMtMTkyMS5qcGVn.jpeg';

export const mockAlbums: Album[] = [
  {
    id: 'listing-ryuichi-sakamoto-playing-the-piano-12122020-m',
    title: 'Playing The Piano 12122020',
    artist: 'Ryuichi Sakamoto',
    year: 2021,
    genre: 'Contemporary Classical',
    catalogNumber: 'RZJM-77477~8',
    discogsReleaseId: 21342883,
    discogsCoverImageUrl: sakamotoPlayingPianoDiscogsCover,
    releaseLabel: 'Commmons',
    releaseCountry: 'Japan',
    pressingCondition: '2021 Japan Commmons RZJM-77477~8 - 2x Vinyl LP, Limited Edition, Stereo',
    price: 98000,
    priceRange: { min: 88000, max: 110000 },
    audioGrade: 'M',
    audioScore: 98,
    jacketGrade: 'M',
    jacketScore: 97,
    isRare: false,
    isFirstPress: false,
    audioSamples: {
      good: {
        name: 'Playing The Piano 12122020 vinyl playlist',
        durationSeconds: 3990,
        dataUrl: sakamotoPlayingPianoSample,
        startSeconds: 0,
        endSeconds: 3990,
        recordedAt: '2026-08-09T13:58:09+09:00',
      },
    },
    images: [sakamotoPlayingPianoCover],
    analysisReport: {
      pressing: '2021 Japan Commmons RZJM-77477~8 - 2x Vinyl LP, Limited Edition, Stereo',
      recordSurface: { surfaceScore: 98, surfaceGrade: 'M', scratchCount: 0 },
      jacket: { jacketGrade: 'M', jacketScore: 97 },
      audio: {
        summary: 'The provided MP3 is linked as the full vinyl sample for Playing The Piano 12122020. It was registered with the requested M-grade listing profile.',
        playbackRisk: null,
        sourceFile: '[vinyl] Ryuichi Sakamoto Playing the Piano  [PLAYLIST] Sakamoto Ryuichi 12122020.mp3',
        durationSeconds: 3990,
        bitRateKbps: 192,
      },
      discogs: {
        releaseId: 21342883,
        releaseUrl: 'https://www.discogs.com/release/21342883-Ryuichi-Sakamoto-Playing-The-Piano-12122020',
        marketplaceLowest: { value: 65, currency: 'EUR' },
        numForSale: 5,
      },
    },
    description: [
      'Discogs API matched this to Ryuichi Sakamoto - Playing The Piano 12122020, 2021 Japan limited 2LP stereo pressing.',
      'The supplied 1:06:30 vinyl MP3 is attached as the full playback sample.',
      'Media and jacket are registered as M grade.',
      'Please confirm real photos and playback condition before trading.',
    ].join('\n'),
    tags: ['Ryuichi Sakamoto', 'Playing The Piano', '12122020', 'Commmons', 'RZJM-77477~8', '2LP', 'Limited Edition', 'Contemporary', 'Soundtrack', 'M', 'LP'],
    seller: { id: 'google-23ef336d21ed', name: 'Google User', rating: 0, transactionCount: 0 },
    location: '서울',
    views: 0,
    viewCount: 0,
    favoriteCount: 0,
    buyOrderCount: 0,
    wishlistCount: 0,
    marketKey: 'catalog:rzjm-77477~8|pressing:2021 japan commmons rzjm-77477~8 2x vinyl lp limited edition stereo',
    basePrice: 91000,
    minPrice: 88000,
    maxPrice: 110000,
    recommendedPrice: 98000,
    instantSalePrice: 0,
    sellerPrice: 98000,
    market: {
      marketKey: 'catalog:rzjm-77477~8|pressing:2021 japan commmons rzjm-77477~8 2x vinyl lp limited edition stereo',
      basePrice: 91000,
      minPrice: 88000,
      maxPrice: 110000,
      recommendedPrice: 98000,
      instantSalePrice: 0,
      instantSaleAvailable: false,
      sellerPrice: 98000,
      isValidPrice: true,
      priceStatus: 'within_range',
      metrics: {
        listingCount: 1,
        buyOrderCount: 0,
        favoriteCount: 0,
        wishlistCount: 0,
        viewCount: 0,
        recentTradeCount: 0,
      },
      reason: 'Discogs marketplace stats and the provided M grade sample were used for this listing.',
    },
    createdAt: '2026-08-09T14:18:00+09:00',
    status: 'published',
  },
  {
    id: 'listing-beatles-love-songs-1977-m',
    title: 'Love Songs',
    artist: 'The Beatles',
    year: 1977,
    genre: 'Rock',
    catalogNumber: 'SKBL-11711',
    discogsReleaseId: 7964234,
    discogsCoverImageUrl: beatlesLoveSongsDiscogsCover,
    releaseLabel: 'Capitol Records',
    releaseCountry: 'US',
    pressingCondition: '1977 US Capitol SKBL-11711 - 2x Vinyl LP, Compilation',
    price: 45000,
    priceRange: { min: 39000, max: 56000 },
    audioGrade: 'M',
    audioScore: 98,
    jacketGrade: 'M',
    jacketScore: 97,
    isRare: false,
    isFirstPress: false,
    audioSamples: {
      good: {
        name: 'Love Songs 1977 Part 2 stereo LP sound',
        durationSeconds: 1696,
        dataUrl: beatlesLoveSongsSample,
        startSeconds: 0,
        endSeconds: 1696,
        recordedAt: '2026-08-09T13:55:57+09:00',
      },
    },
    images: [beatlesLoveSongsCover],
    analysisReport: {
      pressing: '1977 US Capitol Records SKBL-11711 - 2x Vinyl LP, Compilation',
      recordSurface: { surfaceScore: 98, surfaceGrade: 'M', scratchCount: 0 },
      jacket: { jacketGrade: 'M', jacketScore: 97 },
      audio: {
        summary: '제공된 MP3 파일을 Love Songs 1977 Part 2 스테레오 LP 샘플로 연결했습니다. 사용자 지정 등급 M 기준으로 등록했습니다.',
        playbackRisk: null,
        sourceFile: 'Vinyl  The Beatles Love Songs 1977 (Part2) stereo LP sound.mp3',
        durationSeconds: 1696,
        bitRateKbps: 192,
      },
      discogs: {
        releaseId: 7964234,
        releaseUrl: 'https://www.discogs.com/release/7964234-The-Beatles-Love-Songs',
        marketplaceLowest: { value: 6.02, currency: 'EUR' },
        numForSale: 46,
      },
    },
    description: [
      'Discogs API에서 확인한 The Beatles - Love Songs 1977 US Capitol Records 2LP 컴필레이션입니다.',
      '제공된 Part 2 스테레오 LP 녹음 파일을 전체 샘플로 연결했습니다.',
      '음반/자켓 등급은 M 기준으로 등록합니다.',
      '중고 LP 특성상 실물 사진과 재생 확인 후 거래 부탁드립니다.',
    ].join('\n'),
    tags: ['The Beatles', 'Love Songs', '1977', 'Capitol Records', 'SKBL-11711', '2LP', 'Compilation', 'Rock', 'M', 'LP'],
    seller: { id: 'google-23ef336d21ed', name: 'Google User', rating: 0, transactionCount: 0 },
    location: '서울',
    views: 0,
    viewCount: 0,
    favoriteCount: 0,
    buyOrderCount: 0,
    wishlistCount: 0,
    marketKey: 'catalog:skbl-11711|pressing:1977 us capitol skbl-11711 2x vinyl lp compilation',
    basePrice: 43000,
    minPrice: 39000,
    maxPrice: 56000,
    recommendedPrice: 45000,
    instantSalePrice: 0,
    sellerPrice: 45000,
    market: {
      marketKey: 'catalog:skbl-11711|pressing:1977 us capitol skbl-11711 2x vinyl lp compilation',
      basePrice: 43000,
      minPrice: 39000,
      maxPrice: 56000,
      recommendedPrice: 45000,
      instantSalePrice: 0,
      instantSaleAvailable: false,
      sellerPrice: 45000,
      isValidPrice: true,
      priceStatus: 'within_range',
      metrics: {
        listingCount: 1,
        buyOrderCount: 0,
        favoriteCount: 0,
        wishlistCount: 0,
        viewCount: 0,
        recentTradeCount: 0,
      },
      reason: 'Discogs release metadata and the provided M grade sample were used for this listing.',
    },
    createdAt: '2026-08-09T14:04:30+09:00',
    status: 'published',
  },
  {
    id: 'listing-abbey-road-anniversary',
    title: 'Abbey Road (Anniversary Edition)',
    artist: 'The Beatles',
    year: 2019,
    genre: '록',
    catalogNumber: '0602577915123',
    releaseLabel: 'Apple Records / Universal Music',
    releaseCountry: 'EU',
    pressingCondition: '2019 Anniversary Edition · New Mix by Giles Martin and Sam Okell',
    price: 72000,
    priceRange: { min: 62000, max: 89000 },
    audioGrade: 'NM',
    audioScore: 91,
    jacketGrade: 'NM',
    jacketScore: 93,
    isRare: false,
    isFirstPress: false,
    audioSamples: {
      good: {
        name: 'Abbey Road Medley 안정 구간',
        durationSeconds: 20,
        dataUrl: abbeyRoadMedleySample,
        startSeconds: 35,
        endSeconds: 55,
        recordedAt: '2026-07-26T14:25:36.000+09:00',
      },
      noisy: {
        name: 'Abbey Road Medley 도입 확인 구간',
        durationSeconds: 15,
        dataUrl: abbeyRoadMedleySample,
        startSeconds: 5,
        endSeconds: 20,
        recordedAt: '2026-07-26T14:25:36.000+09:00',
      },
    },
    images: [abbeyRoadAnniversaryCover],
    analysisReport: {
      pressing: '2019 Anniversary Edition · 50주년 리믹스',
      recordSurface: { surfaceScore: 92, surfaceGrade: 'NM', scratchCount: 0 },
      jacket: { jacketGrade: 'NM', jacketScore: 93 },
      audio: {
        summary: '제공된 Abbey Road Medley 바이닐 샘플 기준으로 잡음이 낮고 다이내믹이 안정적인 더미 감정값입니다.',
        playbackRisk: null,
      },
    },
    description: '사용자가 제공한 실물 커버 이미지와 Abbey Road Medley 바이닐 MP3 샘플을 연결한 더미 판매글입니다.\n수축 비닐이 남아 있는 Anniversary Edition으로, 전면 스티커의 Giles Martin / Sam Okell New Mix 정보를 기준으로 등록했습니다.',
    tags: ['The Beatles', 'Abbey Road', 'Anniversary Edition', 'Giles Martin', 'Sam Okell', '록', 'LP'],
    seller: { id: 'seller-apple-studio', name: 'apple_studio', rating: 4.9, transactionCount: 38 },
    location: '서울 마포구',
    views: 64,
    viewCount: 64,
    favoriteCount: 18,
    buyOrderCount: 3,
    wishlistCount: 11,
    marketKey: 'catalog:0602577915123|pressing:2019 anniversary edition new mix by giles martin and sam okell',
    basePrice: 74000,
    minPrice: 62000,
    maxPrice: 89000,
    recommendedPrice: 76000,
    instantSalePrice: 69000,
    sellerPrice: 72000,
    market: {
      marketKey: 'catalog:0602577915123|pressing:2019 anniversary edition new mix by giles martin and sam okell',
      basePrice: 74000,
      minPrice: 62000,
      maxPrice: 89000,
      recommendedPrice: 76000,
      instantSalePrice: 69000,
      instantSaleAvailable: true,
      sellerPrice: 72000,
      isValidPrice: true,
      priceStatus: 'within_range',
      metrics: {
        listingCount: 2,
        buyOrderCount: 3,
        favoriteCount: 18,
        wishlistCount: 11,
        viewCount: 64,
        recentTradeCount: 4,
      },
      reason: 'Anniversary Edition 실물 상태와 샘플 음질을 반영한 데모 시세입니다.',
    },
    createdAt: '2026-07-26T14:25:36.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-kind-of-blue-6eye',
    title: 'Kind of Blue (Columbia 6-Eye)',
    artist: 'Miles Davis',
    year: 1959,
    genre: '재즈',
    catalogNumber: 'CS 8163',
    price: 92000,
    priceRange: { min: 86000, max: 118000 },
    audioGrade: 'VG+',
    audioScore: 88,
    jacketGrade: 'VG',
    jacketScore: 76,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#1f2937', '#2563eb', 'Kind of Blue', 'Miles Davis')],
    description: 'Columbia 6-Eye 라벨 매물입니다. 표면 헤어라인은 있으나 재생 잡음은 낮은 편입니다.',
    tags: ['Miles Davis', 'Columbia', '6-Eye', '재즈'],
    seller: { id: 'seller-jazz-room', name: 'jazz_room', rating: 4.9, transactionCount: 42 },
    location: '서울 마포구',
    views: 42,
    createdAt: '2026-06-14T02:40:00.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-blue-train-classic',
    title: 'Blue Train (Blue Note Classic)',
    artist: 'John Coltrane',
    year: 1957,
    genre: '재즈',
    catalogNumber: 'BLP 1577',
    price: 68000,
    priceRange: { min: 62000, max: 79000 },
    audioGrade: 'NM',
    audioScore: 92,
    jacketGrade: 'NM',
    jacketScore: 90,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#0f766e', '#f59e0b', 'Blue Train', 'John Coltrane')],
    description: 'Blue Note Classic Series 재발매반입니다. 세척 후 1회 재생했고 재킷 모서리 상태가 좋습니다.',
    tags: ['John Coltrane', 'Blue Note', 'Classic', '재즈', 'LP'],
    seller: { id: 'seller-turntable88', name: 'turntable88', rating: 4.8, transactionCount: 31 },
    location: '서울 용산구',
    views: 35,
    createdAt: '2026-06-13T18:10:00.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-yoo-jae-ha-first',
    title: '사랑하기 때문에',
    artist: '유재하',
    year: 1987,
    genre: '가요',
    catalogNumber: 'SRD-5',
    price: 76000,
    priceRange: { min: 70000, max: 93000 },
    audioGrade: 'VG+',
    audioScore: 87,
    jacketGrade: 'VG+',
    jacketScore: 82,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#7c2d12', '#f97316', '사랑하기 때문에', '유재하')],
    description: '국내 발매반 매물입니다. A면 조용한 구간에 미세 잡음이 있어 감정 점수를 함께 확인해 주세요.',
    tags: ['유재하', '가요'],
    seller: { id: 'seller-seoul-vinyl', name: 'seoul_vinyl', rating: 4.7, transactionCount: 18 },
    location: '서울 강남구',
    views: 57,
    createdAt: '2026-06-12T21:05:00.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-abbey-road-japan',
    title: 'Abbey Road (Japan Press)',
    artist: 'The Beatles',
    year: 1969,
    genre: '록',
    catalogNumber: 'EAS-80560',
    price: 56000,
    priceRange: { min: 50000, max: 68000 },
    audioGrade: 'VG+',
    audioScore: 86,
    jacketGrade: 'VG+',
    jacketScore: 84,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#365314', '#84cc16', 'Abbey Road', 'Japan Press')],
    description: '일본반 OBI 포함 매물입니다. 재킷 보존 상태가 좋고 판 휨은 확인되지 않았습니다.',
    tags: ['The Beatles', 'Japan Press', 'OBI', '록', 'LP'],
    seller: { id: 'seller-obi-collector', name: 'obi_collector', rating: 5, transactionCount: 27 },
    location: '경기 성남시',
    views: 49,
    createdAt: '2026-06-11T15:25:00.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-rumours-us',
    title: 'Rumours (US Press)',
    artist: 'Fleetwood Mac',
    year: 1977,
    genre: '록',
    catalogNumber: 'BSK 3010',
    price: 42000,
    priceRange: { min: 36000, max: 51000 },
    audioGrade: 'VG+',
    audioScore: 84,
    jacketGrade: 'VG',
    jacketScore: 78,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#581c87', '#a855f7', 'Rumours', 'Fleetwood Mac')],
    description: 'US 프레스 중고반입니다. B면 시작부에 약한 틱 노이즈가 있어 가격을 낮춰 등록했습니다.',
    tags: ['Fleetwood Mac', 'US Press', '록', 'LP'],
    seller: { id: 'seller-hongdae-lp', name: 'hongdae_lp', rating: 4.6, transactionCount: 22 },
    location: '서울 서대문구',
    views: 28,
    createdAt: '2026-06-10T12:30:00.000+09:00',
    status: 'published',
  },
  {
    id: 'listing-mint-jams',
    title: 'Mint Jams',
    artist: 'Casiopea',
    year: 1982,
    genre: '퓨전 재즈',
    catalogNumber: 'ALR-20002',
    price: 48000,
    priceRange: { min: 43000, max: 58000 },
    audioGrade: 'VG',
    audioScore: 79,
    jacketGrade: 'VG+',
    jacketScore: 81,
    isRare: false,
    isFirstPress: false,
    images: [mockCover('#0e7490', '#22d3ee', 'Mint Jams', 'Casiopea')],
    description: '시티팝/퓨전 재즈 인기반입니다. 플레이용으로 부담 없이 듣기 좋은 상태입니다.',
    tags: ['Casiopea', 'Fusion', 'City Pop', '재즈', 'LP'],
    seller: { id: 'seller-night-groove', name: 'night_groove', rating: 4.8, transactionCount: 36 },
    location: '부산 수영구',
    views: 33,
    createdAt: '2026-06-09T20:20:00.000+09:00',
    status: 'published',
  },
];
export const albums = mockAlbums;

export interface Notification {
  id: string;
  type: 'offer' | 'chat' | 'listing' | 'favorite' | 'system';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
  listingId?: string;
  wishlistId?: string;
  marketKey?: string;
}

export const mockNotifications: Notification[] = [];

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'offer' | 'image';
}

export const mockChatMessages: ChatMessage[] = [];

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  timestamp: string;
  albumTitle: string;
}

export const mockReviews: Review[] = [];
