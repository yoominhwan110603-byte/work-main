import { useNavigate } from 'react-router';
import { ArrowLeft, Camera, Image } from 'lucide-react';

export default function CameraScreen() {
  const navigate = useNavigate();

  return (
    <div className="size-full bg-black flex flex-col">
      <header className="px-4 py-4 flex items-center justify-between text-white z-10">
        <button onClick={() => navigate(-1)} className="p-2">
          <ArrowLeft size={24} />
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center relative">
        <div className="w-full max-w-md aspect-square border-2 border-white/50 rounded-lg">
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-center">
            앨범 자켓을<br />프레임 안에 맞춰주세요
          </p>
        </div>
      </div>

      <div className="p-8 flex items-center justify-center gap-8">
        <button className="p-4 bg-white/20 rounded-full">
          <Image size={24} className="text-white" />
        </button>
        <button
          onClick={() => navigate('/sell')}
          className="w-20 h-20 bg-white rounded-full flex items-center justify-center"
        >
          <Camera size={32} className="text-black" />
        </button>
        <div className="w-12 h-12" />
      </div>
    </div>
  );
}
