from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    app.include_router(api_router)
    return app
