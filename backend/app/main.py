from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.api import routes_data, routes_backtest, routes_predict, routes_metrics
from app.config import settings
from app.models.database import engine, Base
from pathlib import Path
import logging
import os

logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown: cleanup
    await engine.dispose()

app = FastAPI(
    title="Stock Prediction Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_data.router, prefix="/api/data", tags=["Market Data"])
app.include_router(routes_backtest.router, prefix="/api/backtest", tags=["Backtesting"])
app.include_router(routes_predict.router, prefix="/api/predict", tags=["Predictions"])
app.include_router(routes_metrics.router, prefix="/api/metrics", tags=["Performance Metrics"])

# Phase 2: WebSocket router for live price streaming (requires Finnhub API key)
try:
    from app.api import routes_websocket
    app.include_router(routes_websocket.router, tags=["WebSocket"])
    logger.info("WebSocket router loaded (Finnhub live feed enabled)")
except Exception as e:
    logger.warning(f"WebSocket router not loaded: {e}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# ─── Serve Static Frontend ───
# In HuggingFace deployment, the built frontend is placed in backend/static/
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

if STATIC_DIR.exists() and (STATIC_DIR / "index.html").exists():
    logger.info(f"Serving static frontend from {STATIC_DIR}")

    # Serve static assets (_next, images, etc.)
    app.mount("/_next", StaticFiles(directory=str(STATIC_DIR / "_next")), name="next_static")

    # Serve any other static files (favicon, etc.)
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = STATIC_DIR / "favicon.ico"
        if favicon_path.exists():
            return FileResponse(str(favicon_path))
        return FileResponse(str(STATIC_DIR / "index.html"))

    # Catch-all: serve index.html for all non-API routes (client-side routing)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try to serve the exact file first (e.g., /backtest/index.html)
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        # Try with index.html for directory paths
        index_path = STATIC_DIR / full_path / "index.html"
        if index_path.is_file():
            return FileResponse(str(index_path))
        # Fallback to root index.html for client-side routing
        return FileResponse(str(STATIC_DIR / "index.html"))
else:
    logger.info("No static frontend found — running API-only mode")
