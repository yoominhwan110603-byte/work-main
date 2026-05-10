import { Disc3 } from 'lucide-react';

interface VinylImageProps {
  src?: string;
  alt: string;
  className?: string;
}

export default function VinylImage({ src, alt, className = '' }: VinylImageProps) {
  if (src) {
    return <img src={src} alt={alt} className={className} />;
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`bg-neutral-900 text-white flex items-center justify-center overflow-hidden ${className}`}
    >
      <div className="relative w-3/4 aspect-square rounded-full bg-zinc-800 shadow-inner">
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <div className="absolute inset-6 rounded-full border border-white/10" />
        <div className="absolute inset-[36%] rounded-full bg-rose-600 flex items-center justify-center">
          <Disc3 size={18} className="text-white/85" />
        </div>
      </div>
    </div>
  );
}
