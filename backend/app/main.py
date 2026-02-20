from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import routes_data, routes_backtest, routes_predict, routes_metrics
from app.config import settings
from app.models.database import engine, Base
import logging

logger = logging.getLogger(__name__)

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
