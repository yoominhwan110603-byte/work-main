export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  catalogNumber: string;
  price: number;
  priceRange: { min: number; max: number };
  audioGrade: string;
  audioScore: number;
  isRare: boolean;
  isFirstPress: boolean;
  ownedByMe?: boolean;
  audioSamples?: {
    good?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number };
    noisy?: { name: string; durationSeconds: number; dataUrl?: string; startSeconds?: number; endSeconds?: number };
  };
  images: string[];
  coverImageDataUrl?: string;
  recordImageDataUrl?: string;
  recordVideoDataUrl?: string;
  description: string;
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
}

export const mockAlbums: Album[] = [
  {
    id: '1',
    title: 'Kind of Blue',
    artist: 'Miles Davis',
    year: 1959,
    genre: '재즈',
    catalogNumber: 'CL 1355',
    price: 280000,
    priceRange: { min: 250000, max: 320000 },
    audioGrade: 'NM',
    audioScore: 92,
    isRare: true,
    isFirstPress: true,
    images: [],
    description: 'Columbia 6-eye 프레스. 표면 상태가 깨끗하고 재생 샘플이 안정적입니다.',
    seller: { id: 'seller1', name: 'Jazz Collector', rating: 4.9, transactionCount: 127 },
    location: '서울 강남구',
    views: 234,
    createdAt: '2026-04-15',
  },
  {
    id: '2',
    title: 'Abbey Road',
    artist: 'The Beatles',
    year: 1969,
    genre: '록',
    catalogNumber: 'PCS 7088',
    price: 420000,
    priceRange: { min: 380000, max: 500000 },
    audioGrade: 'VG+',
    audioScore: 85,
    isRare: true,
    isFirstPress: true,
    images: [],
    description: 'UK Apple 프레스. 표면 점수와 음질 샘플을 함께 확인한 판매글입니다.',
    seller: { id: 'seller2', name: 'Beatles Picker', rating: 4.8, transactionCount: 89 },
    location: '서울 마포구',
    views: 567,
    createdAt: '2026-04-17',
  },
  {
    id: '3',
    title: 'Blue Train',
    artist: 'John Coltrane',
    year: 1957,
    genre: '재즈',
    catalogNumber: 'BLP 1577',
    price: 350000,
    priceRange: { min: 320000, max: 400000 },
    audioGrade: 'VG+',
    audioScore: 88,
    isRare: true,
    isFirstPress: false,
    images: [],
    description: 'Blue Note 리이슈. 표면 반사가 적고 재생 샘플 기준 잡음이 낮은 편입니다.',
    seller: { id: 'seller3', name: 'JazzVinyl', rating: 4.7, transactionCount: 156 },
    location: '서울 용산구',
    views: 189,
    createdAt: '2026-04-18',
  },
  {
    id: '4',
    title: 'Dark Side of the Moon',
    artist: 'Pink Floyd',
    year: 1973,
    genre: '록',
    catalogNumber: 'SHVL 804',
    price: 180000,
    priceRange: { min: 150000, max: 220000 },
    audioGrade: 'VG',
    audioScore: 78,
    isRare: false,
    isFirstPress: false,
    images: [],
    description: '70년대 중반 프레스. 스크래치 후보가 있어 재생 확인을 권장합니다.',
    seller: { id: 'seller4', name: 'Rock Archive', rating: 4.6, transactionCount: 43 },
    location: '서울 송파구',
    views: 423,
    createdAt: '2026-04-16',
  },
  {
    id: '5',
    title: 'Thriller',
    artist: 'Michael Jackson',
    year: 1982,
    genre: '팝',
    catalogNumber: 'QE 38112',
    price: 95000,
    priceRange: { min: 80000, max: 120000 },
    audioGrade: 'VG+',
    audioScore: 82,
    isRare: false,
    isFirstPress: false,
    images: [],
    description: '일본 프레스. 표면 확인 결과 재생 상태는 양호합니다.',
    seller: { id: 'seller5', name: 'MJ Shop', rating: 4.9, transactionCount: 67 },
    location: '경기 성남시',
    views: 312,
    createdAt: '2026-04-19',
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
}

export const mockNotifications: Notification[] = [
  { id: '1', type: 'offer', title: '새 가격 제안', message: 'Kind of Blue에 250,000원 제안이 도착했습니다.', timestamp: '2026-04-19T10:30:00', isRead: false, link: '/transaction/offers/received' },
  { id: '2', type: 'chat', title: '새 메시지', message: '거래 장소 조율 메시지가 도착했습니다.', timestamp: '2026-04-19T09:15:00', isRead: false, link: '/transaction/chat/1' },
  { id: '3', type: 'favorite', title: '관심 상품 가격 변경', message: 'Blue Train 가격이 350,000원으로 변경되었습니다.', timestamp: '2026-04-18T14:20:00', isRead: true },
  { id: '4', type: 'listing', title: '새 매물 등록', message: '선호 장르에 맞는 LP가 새로 등록되었습니다.', timestamp: '2026-04-18T11:00:00', isRead: true, link: '/app' },
];

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'offer' | 'image';
}

export const mockChatMessages: ChatMessage[] = [
  { id: '1', senderId: 'seller1', senderName: 'Jazz Collector', message: '관심 가져주셔서 감사합니다.', timestamp: '2026-04-19T10:00:00', type: 'text' },
  { id: '2', senderId: 'me', senderName: '나', message: '표면 상태가 좋아 보이네요. 직거래 가능할까요?', timestamp: '2026-04-19T10:05:00', type: 'text' },
  { id: '3', senderId: 'seller1', senderName: 'Jazz Collector', message: '가능합니다. 강남역 근처에서 거래할 수 있어요.', timestamp: '2026-04-19T10:10:00', type: 'text' },
];

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  timestamp: string;
  albumTitle: string;
}

export const mockReviews: Review[] = [
  { id: '1', userId: 'user1', userName: 'LP 애호가', rating: 5, comment: '설명과 같은 상태였고 포장이 꼼꼼했습니다.', timestamp: '2026-04-10', albumTitle: 'Kind of Blue' },
  { id: '2', userId: 'user2', userName: '음악덕후', rating: 4, comment: '사진 설명과 같았고 재생도 안정적이었습니다.', timestamp: '2026-04-05', albumTitle: 'Abbey Road' },
];
