import shap
import numpy as np
import pandas as pd
import xgboost as xgb

class SHAPExplainer:
    """
    SHAP-based model explanations.
    Shows users WHY the model made a prediction.

    CAVEAT: Financial features are correlated, so SHAP values
    should be treated as approximate, not gospel.
    """

    def explain(
        self,
        model: xgb.XGBClassifier,
        X: pd.DataFrame,
        feature_names: list[str],
        top_n: int = 8,
    ) -> list[dict]:
        """Get SHAP explanation for the most recent prediction."""
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X.iloc[-1:])

        # Get feature importances for last prediction
        if isinstance(shap_values, list):
            # Binary classification: use class 1 (UP)
            values = shap_values[1][0] if len(shap_values) > 1 else shap_values[0][0]
        else:
            values = shap_values[0]

        feature_impacts = []
        for name, shap_val, feat_val in zip(
            feature_names, values, X.iloc[-1].values
        ):
            clean_name = name.replace("feat_", "").replace("_", " ").title()
            feature_impacts.append({
                "feature": clean_name,
                "raw_name": name,
                "value": round(float(feat_val), 4),
                "shap_impact": round(float(shap_val), 4),
                "direction": "Bullish" if shap_val > 0 else "Bearish",
                "magnitude": abs(float(shap_val)),
            })

        # Sort by absolute impact, return top N
        feature_impacts.sort(key=lambda x: x["magnitude"], reverse=True)
        return feature_impacts[:top_n]