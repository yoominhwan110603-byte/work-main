from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ..routers.api import compact_persisted_listings, router as api_router
from ..services.storage import initialize_storage


def create_app() -> FastAPI:
    app = FastAPI(title="Vinyl-Check API")

    @app.on_event("startup")
    def initialize_postgres_storage() -> None:
        initialize_storage()
        compact_persisted_listings()

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
    uploaded_images_dir = Path(__file__).resolve().parents[2] / "data" / "uploaded_images"
    uploaded_images_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploaded-images", StaticFiles(directory=str(uploaded_images_dir)), name="uploaded_images")
    app.include_router(api_router)
    return app
