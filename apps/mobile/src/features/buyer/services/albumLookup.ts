import type { Album } from '@/shared/models/market';
import type { useAppStore } from '@/shared/stores/appStore';

type AppStore = ReturnType<typeof useAppStore>;

export function findAlbumById(store: AppStore, id: unknown): Album | undefined {
  const albumId = String(id || '');
  if (!albumId) return undefined;
  return store.listings.find(album => album.id === albumId);
}

export function fallbackAlbum(store: AppStore, id: unknown): Album {
  return findAlbumById(store, id) || store.listings[0] || {
    id: 'unknown',
    title: '판매글 정보 없음',
    artist: '',
    year: 0,
    genre: '',
    catalogNumber: '',
    price: 0,
    priceRange: { min: 0, max: 0 },
    audioGrade: '-',
    audioScore: 0,
    isRare: false,
    isFirstPress: false,
    images: [],
    description: '',
    seller: { id: 'unknown', name: '판매자', rating: 0, transactionCount: 0 },
    location: '',
    views: 0,
    createdAt: new Date().toISOString(),
  };
}
