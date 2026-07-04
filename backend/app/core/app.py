from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..routers.api import router as api_router


def create_app() -> FastAPI:
    app = FastAPI(title="Vinyl-Check API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    audio_samples_dir = Path(__file__).resolve().parents[2] / "data" / "audio_samples"
    audio_samples_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/audio-samples", StaticFiles(directory=str(audio_samples_dir)), name="audio_samples")
    app.include_router(api_router)
    return app
