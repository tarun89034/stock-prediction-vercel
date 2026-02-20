"""
Phase 2: WebSocket endpoint for live price streaming.
Polls Finnhub every 15 seconds and pushes to connected clients.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime_feed import FinnhubFeed
import asyncio
import json

router = APIRouter()
feed = FinnhubFeed()

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, ticker: str):
        await websocket.accept()
        if ticker not in self.active_connections:
            self.active_connections[ticker] = []
        self.active_connections[ticker].append(websocket)

    def disconnect(self, websocket: WebSocket, ticker: str):
        if ticker in self.active_connections:
            self.active_connections[ticker].remove(websocket)

    async def broadcast(self, ticker: str, data: dict):
        if ticker in self.active_connections:
            dead = []
            for ws in self.active_connections[ticker]:
                try:
                    await ws.send_text(json.dumps(data))
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.active_connections[ticker].remove(ws)

manager = ConnectionManager()

@router.websocket("/ws/price/{ticker}")
async def price_stream(websocket: WebSocket, ticker: str):
    """Stream live prices every 15 seconds."""
    await manager.connect(websocket, ticker)
    try:
        while True:
            quote = feed.get_quote(ticker)
            await manager.broadcast(ticker, {
                "ticker": ticker,
                "data": quote,
                "type": "price_update",
            })
            await asyncio.sleep(15)  # Don't hammer the free API
    except WebSocketDisconnect:
        manager.disconnect(websocket, ticker)