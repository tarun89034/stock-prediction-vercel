from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import PredictionRequest, PredictionResult
from app.services.predictor import StockPredictor
from slowapi import Limiter
from slowapi.util import get_remote_address
import asyncio

router = APIRouter()
predictor = StockPredictor()
limiter = Limiter(key_func=get_remote_address)

@router.post("/run", response_model=PredictionResult)
@limiter.limit("10/minute")
async def run_prediction(request: Request, prediction_request: PredictionRequest):
    """Run XGBoost prediction with walk-forward validation."""
    try:
        result = await asyncio.to_thread(predictor.predict, prediction_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")