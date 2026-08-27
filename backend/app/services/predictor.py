import xgboost as xgb
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, accuracy_score
from app.services.data_fetcher import DataFetcher
from app.models.schemas import PredictionRequest, PredictionResult
import logging

logger = logging.getLogger(__name__)

class StockPredictor:
    """
    XGBoost-based prediction with walk-forward validation.

    CRITICAL DESIGN DECISIONS:
    - We predict DIRECTION (up/down), not exact price. Predicting exact
      prices is a fool's errand and gives users false confidence.
    - Walk-forward validation: split the history into equal chunks of trading
      days, train on chunks 1..N and test on chunk N+1, then slide forward.
      This prevents look-ahead bias.
    - Feature engineering uses ONLY lagged features (no future data leakage).
    """

    def __init__(self):
        self.data_fetcher = DataFetcher()

    def predict(self, request: PredictionRequest) -> PredictionResult:
        """Generate prediction with walk-forward validated model."""
        # Fetch 3 years of data (need enough for training + features)
        from datetime import date, timedelta

        end_date = date.today()
        start_date = end_date - timedelta(days=3 * 365)
        df = self.data_fetcher.fetch_historical(request.ticker, start_date, end_date)

        # Build features
        features_df = self._build_features(df)
        features_df.dropna(inplace=True)

        # Walk-forward validation
        wf_accuracy, wf_predictions = self._walk_forward_validate(features_df)

        # Train final model on ALL data
        feature_cols = [c for c in features_df.columns if c.startswith("feat_")]
        X = features_df[feature_cols]
        y = (features_df["target_return"] > 0).astype(int)  # 1 = up, 0 = down

        model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric="logloss",
        )
        model.fit(X, y, verbose=False)

        # Get SHAP explanations
        from app.services.explainer import SHAPExplainer

        explainer = SHAPExplainer()
        shap_explanation = explainer.explain(model, X, feature_cols)

        # Generate forward predictions
        current_price = float(df["close"].iloc[-1])
        predictions = self._generate_forward_predictions(
            model, features_df, feature_cols, current_price, request.prediction_days
        )

        # Determine signal
        avg_pred = np.mean([p["predicted_direction"] for p in predictions])
        if avg_pred > 0.6:
            signal = "BUY"
        elif avg_pred < 0.4:
            signal = "SELL"
        else:
            signal = "HOLD"

        return PredictionResult(
            ticker=request.ticker,
            current_price=round(current_price, 2),
            predictions=predictions,
            signal=signal,
            shap_explanation=shap_explanation,
            # Both scores are percentages (0-100), not fractions -- the API
            # contract and the UI's 53/56% thresholds are expressed that way.
            model_accuracy=round(float(wf_accuracy) * 100, 2),
            walk_forward_score=round(float(wf_accuracy) * 100, 2),
        )

    def _build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Build features from OHLCV data. ALL features are lagged
        to prevent look-ahead bias.
        """
        features = df.copy()

        # Price-based features (all lagged by 1 day)
        features["feat_return_1d"] = features["close"].pct_change(1).shift(1)
        features["feat_return_5d"] = features["close"].pct_change(5).shift(1)
        features["feat_return_20d"] = features["close"].pct_change(20).shift(1)

        # Volatility
        features["feat_volatility_20d"] = (
            features["close"].pct_change().rolling(20).std().shift(1)
        )

        # Moving average ratios
        features["feat_sma_20_ratio"] = (
            features["close"].shift(1)
            / features["close"].rolling(20).mean().shift(1)
        )
        features["feat_sma_50_ratio"] = (
            features["close"].shift(1)
            / features["close"].rolling(50).mean().shift(1)
        )

        # RSI
        delta = features["close"].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss
        features["feat_rsi"] = (100 - (100 / (1 + rs))).shift(1)

        # Volume features
        features["feat_volume_ratio"] = (
            features["volume"].shift(1)
            / features["volume"].rolling(20).mean().shift(1)
        )

        # MACD
        ema12 = features["close"].ewm(span=12).mean()
        ema26 = features["close"].ewm(span=26).mean()
        features["feat_macd"] = (ema12 - ema26).shift(1)
        features["feat_macd_signal"] = (
            (ema12 - ema26).ewm(span=9).mean().shift(1)
        )

        # Target: next-day return (THIS is what we predict)
        features["target_return"] = features["close"].pct_change(1).shift(-1)

        return features

    def _walk_forward_validate(
        self, df: pd.DataFrame, n_splits: int = 6
    ) -> tuple[float, list]:
        """
        Walk-forward validation: the ONLY honest way to validate
        a time-series model.

        Train on expanding window, test on next chunk.
        """
        feature_cols = [c for c in df.columns if c.startswith("feat_")]
        X = df[feature_cols].values
        y = (df["target_return"].values > 0).astype(int)

        split_size = len(df) // (n_splits + 1)
        accuracies = []
        all_predictions = []

        if split_size == 0:
            logger.warning(
                f"Only {len(df)} rows after feature building -- too few for "
                f"{n_splits} walk-forward splits"
            )
            return 0.5, []

        for i in range(1, n_splits + 1):
            # Fold i trains on the first i chunks and tests on chunk i + 1.
            train_end = split_size * i
            test_start = train_end
            test_end = test_start + split_size

            X_train, y_train = X[:train_end], y[:train_end]
            X_test, y_test = X[test_start:test_end], y[test_start:test_end]

            model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                random_state=42,
                eval_metric="logloss",
            )
            model.fit(X_train, y_train, verbose=False)

            preds = model.predict(X_test)
            acc = accuracy_score(y_test, preds)
            accuracies.append(acc)
            all_predictions.extend(preds.tolist())

        avg_accuracy = np.mean(accuracies) if accuracies else 0.5
        logger.info(
            f"Walk-forward accuracy: {avg_accuracy:.4f} "
            f"across {len(accuracies)} splits"
        )
        return avg_accuracy, all_predictions

    def _generate_forward_predictions(
        self,
        model: xgb.XGBClassifier,
        features_df: pd.DataFrame,
        feature_cols: list[str],
        current_price: float,
        days: int,
    ) -> list[dict]:
        """
        Generate forward-looking predictions.
        NOTE: Beyond day 1, these are increasingly unreliable.
        We use the last known features (honest approach).
        """
        from datetime import timedelta

        last_features = features_df[feature_cols].iloc[-1:].values
        last_date = features_df.index[-1]

        predictions = []
        prob = model.predict_proba(last_features)[0]

        for day in range(1, days + 1):
            pred_date = last_date + timedelta(days=day)
            # Confidence decays over time (honest)
            decay = 0.85 ** (day - 1)
            adjusted_prob = 0.5 + (prob[1] - 0.5) * decay

            predictions.append({
                "date": pred_date.isoformat(),
                "predicted_direction": round(float(adjusted_prob), 4),
                "confidence": round(float(decay * max(prob)), 4),
                "label": "UP" if adjusted_prob > 0.5 else "DOWN",
                "disclaimer": "Confidence decreases significantly beyond 1-2 days",
            })

        return predictions