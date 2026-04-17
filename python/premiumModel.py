from pathlib import Path

import joblib
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.ensemble import RandomForestRegressor

MODEL_PATH = Path(__file__).with_name("premium_model.pkl")
FEATURE_NAMES = [
    "zone_risk_score",
    "season_index",
    "avg_weekly_earnings",
    "plan_tier",
    "disruption_count_last_4_weeks",
    "work_consistency_score",
]


class PremiumRequest(BaseModel):
    zone_risk_score: float
    season_index: int
    avg_weekly_earnings: float
    plan_tier: int
    disruption_count_last_4_weeks: int
    work_consistency_score: float


def build_training_dataset():
    rows = []
    for idx in range(60):
      zone_risk_score = round(min(1.0, 0.08 + (idx % 10) * 0.1), 2)
      season_index = (idx % 4) + 1
      avg_weekly_earnings = 1500 + (idx * 55) % 3501
      plan_tier = (idx % 4) + 1
      disruption_count = idx % 9
      work_consistency = round(min(1.0, 0.35 + ((idx * 7) % 60) / 100), 2)
      target = (
          18
          + plan_tier * 22
          + zone_risk_score * 28
          + season_index * 6
          + disruption_count * 4
          + (avg_weekly_earnings / 5000) * 18
          - work_consistency * 10
      )
      rows.append(
          [
              zone_risk_score,
              season_index,
              avg_weekly_earnings,
              plan_tier,
              disruption_count,
              work_consistency,
              round(target, 2),
          ]
      )
    data = np.array(rows, dtype=float)
    return data[:, :6], data[:, 6]


def load_or_train_model():
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)

    X, y = build_training_dataset()
    model = RandomForestRegressor(n_estimators=120, random_state=42)
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    return model


app = FastAPI(title="WEMA Premium Model", version="1.0.0")
model = load_or_train_model()
training_X, training_y = build_training_dataset()


@app.post("/predict-premium")
def predict_premium(payload: PremiumRequest):
    features = np.array(
        [[
            payload.zone_risk_score,
            payload.season_index,
            payload.avg_weekly_earnings,
            payload.plan_tier,
            payload.disruption_count_last_4_weeks,
            payload.work_consistency_score,
        ]]
    )
    predicted = float(model.predict(features)[0])
    cap = payload.avg_weekly_earnings * 0.02
    return {
        "predicted_premium": round(min(predicted, cap), 2),
        "premium_cap": round(cap, 2),
    }


@app.get("/premium-model-info")
def premium_model_info():
    sample_features = np.array([[0.45, 3, 3500, 2, 3, 0.74]])
    sample_prediction = float(model.predict(sample_features)[0])
    feature_importances = {
        FEATURE_NAMES[index]: round(float(value) * 100, 2)
        for index, value in enumerate(model.feature_importances_)
    }
    return {
        "model_type": "RandomForestRegressor",
        "training_samples": int(training_X.shape[0]),
        "feature_names": FEATURE_NAMES,
        "feature_importances_percent": feature_importances,
        "sample_prediction": {
            "zone_risk_score": 0.45,
            "season_index": 3,
            "avg_weekly_earnings": 3500,
            "plan_tier": 2,
            "disruption_count_last_4_weeks": 3,
            "work_consistency_score": 0.74,
            "predicted_premium": round(min(sample_prediction, 3500 * 0.02), 2),
        },
    }
