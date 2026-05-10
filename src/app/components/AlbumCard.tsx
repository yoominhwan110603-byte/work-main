import { Heart, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Album } from '../data/mockData';
import VinylImage from './VinylImage';

interface AlbumCardProps {
  album: Album;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

export default function AlbumCard({ album, isFavorite, onToggleFavorite }: AlbumCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/app/album/${album.id}`)}
      className="bg-white rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex gap-3">
        <div className="relative flex-shrink-0">
          <VinylImage
            src={album.images[0]}
            alt={album.title}
            className="w-24 h-24 object-cover rounded-lg"
          />
          {album.isRare && (
            <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-yellow-500 text-white text-xs rounded">
              희귀판
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className="truncate">{album.title}</h3>
              <p className="text-sm text-gray-600 truncate">{album.artist}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(album.id);
              }}
              className="p-1 flex-shrink-0"
            >
              <Heart
                size={20}
                className={isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
              {album.audioGrade}
            </span>
            <span className="text-xs text-gray-500">점수 {album.audioScore}</span>
            {album.isFirstPress && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                오리지널
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg">{album.price.toLocaleString()}원</p>
              <p className="text-xs text-gray-500">
                시세 {album.priceRange.min.toLocaleString()}-{album.priceRange.max.toLocaleString()}원
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin size={12} />
              <span>{album.location}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
