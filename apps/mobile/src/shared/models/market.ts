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
  jacketGrade?: string;
  jacketScore?: number;
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
}

export const mockAlbums: Album[] = [];
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
