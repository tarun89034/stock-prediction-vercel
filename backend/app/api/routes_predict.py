from fastapi import APIRouter, HTTPException
from app.models.schemas import PredictionRequest, PredictionResult
from app.services.predictor import StockPredictor

router = APIRouter()
predictor = StockPredictor()

@router.post("/run", response_model=PredictionResult)
async def run_prediction(request: PredictionRequest):
    """Run XGBoost prediction with walk-forward validation."""
    try:
        result = predictor.predict(request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")