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

export const mockAlbums: Album[] = [
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
    isRare: true,
    isFirstPress: true,
    images: [mockCover('#1f2937', '#2563eb', 'Kind of Blue', 'Miles Davis')],
    description: 'Columbia 6-Eye 라벨 매물입니다. 표면 헤어라인은 있으나 재생 잡음은 낮은 편입니다.',
    tags: ['Miles Davis', 'Columbia', '6-Eye', '초판', '재즈', 'LP'],
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
    isRare: true,
    isFirstPress: true,
    images: [mockCover('#7c2d12', '#f97316', '사랑하기 때문에', '유재하')],
    description: '국내 초반 기준 매물입니다. A면 조용한 구간에 미세 잡음이 있어 감정 점수를 함께 확인해 주세요.',
    tags: ['유재하', '초판', '가요', '희귀', 'LP'],
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
    isRare: true,
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
