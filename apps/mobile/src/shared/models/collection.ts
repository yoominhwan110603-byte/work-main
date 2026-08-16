import { mockAlbums } from '@/shared/models/market';

export interface CollectionAudioSample {
  name: string;
  durationSeconds: number;
  dataUrl?: string;
  startSeconds?: number;
  endSeconds?: number;
  recordedAt: string;
}

export interface VinylCollection {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  catalogNumber: string;
  discogsReleaseId?: number;
  discogsCoverImageUrl?: string;
  releaseLabel?: string;
  releaseCountry?: string;
  pressingInfo?: string;
  ownershipStatus: 'owned' | 'reserved' | 'lent' | 'sold';
  purchasePrice?: number;
  notes: string;
  tags: string[];
  images: string[];
  coverImageDataUrl?: string;
  recordImageDataUrl?: string;
  recordVideoDataUrl?: string;
  audioGrade?: string;
  audioScore?: number;
  jacketGrade?: string;
  jacketScore?: number;
  isRare: boolean;
  isFirstPress: boolean;
  audioSamples?: {
    good?: CollectionAudioSample;
    noisy?: CollectionAudioSample;
  };
  owner: {
    id: string;
    name: string;
    rating: number;
    transactionCount: number;
  };
  visibility: 'public' | 'private';
  contactCount: number;
  convertedListingId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CollectionCreatePayload = Omit<VinylCollection, 'id' | 'owner' | 'contactCount' | 'convertedListingId' | 'createdAt' | 'updatedAt'>;

const mockCollectionFromAlbum = (albumIndex: number, overrides: Partial<VinylCollection>): VinylCollection => {
  const album = mockAlbums[albumIndex];
  const createdAt = new Date(Date.now() - (albumIndex + 2) * 86400000).toISOString();
  return {
    id: `collection-mock-${album.id}`,
    title: album.title,
    artist: album.artist,
    year: album.year,
    genre: album.genre,
    catalogNumber: album.catalogNumber,
    ownershipStatus: 'owned',
    purchasePrice: undefined,
    notes: `${album.artist}의 ${album.title} 소장본입니다. 판매 전 상태 공유용으로 자켓, 판면, 샘플 녹음을 함께 남겼습니다.`,
    tags: ['소장반', album.genre].filter(Boolean),
    images: album.images,
    coverImageDataUrl: album.coverImageDataUrl,
    recordImageDataUrl: album.recordImageDataUrl,
    recordVideoDataUrl: album.recordVideoDataUrl,
    audioGrade: album.audioGrade,
    audioScore: album.audioScore,
    jacketGrade: album.jacketGrade,
    jacketScore: album.jacketScore,
    isRare: false,
    isFirstPress: false,
    audioSamples: {
      good: {
        name: `${album.title} 안정 구간`,
        durationSeconds: 20,
        dataUrl: album.audioSamples?.good?.dataUrl,
        startSeconds: album.audioSamples?.good?.startSeconds || 0,
        endSeconds: album.audioSamples?.good?.endSeconds || 20,
        recordedAt: createdAt,
      },
      noisy: album.audioSamples?.noisy
        ? {
            name: `${album.title} 확인 구간`,
            durationSeconds: album.audioSamples.noisy.durationSeconds,
            dataUrl: album.audioSamples.noisy.dataUrl,
            startSeconds: album.audioSamples.noisy.startSeconds || 0,
            endSeconds: album.audioSamples.noisy.endSeconds || album.audioSamples.noisy.durationSeconds,
            recordedAt: createdAt,
          }
        : undefined,
    },
    owner: album.seller,
    visibility: 'public',
    contactCount: 0,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
};

export const mockCollections: VinylCollection[] = [
  mockCollectionFromAlbum(0, {
    notes: 'Columbia 6-Eye 재즈 컬렉션의 기준반으로 보관 중입니다. 좋은 구간 샘플과 자켓 상태를 공개해 교환/문의가 가능하게 남겨두었습니다.',
    contactCount: 3,
  }),
  mockCollectionFromAlbum(3, {
    notes: '일본반 OBI 포함 컬렉션입니다. 아직 판매글은 아니지만 관심 있는 유저가 상태를 보고 연락할 수 있습니다.',
    contactCount: 5,
  }),
];
