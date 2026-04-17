from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

MODEL_PATH = Path(__file__).with_name("fraud_model.pkl")
FEATURE_NAMES = [
    "gps_path_smoothness",
    "zone_history_match",
    "device_age_days",
    "shift_start_before_alert_minutes",
    "order_completion_rate",
    "claim_frequency_last_4_weeks",
    "ip_location_match",
    "cluster_activation",
]

FEATURE_DESCRIPTIONS = {
    "gps_path_smoothness": "How unrealistically smooth the GPS route appears.",
    "zone_history_match": "How closely the current zone matches the rider's historical working zones.",
    "device_age_days": "How long the device has been active in the system.",
    "shift_start_before_alert_minutes": "Whether the shift began well before the alert or suspiciously close to it.",
    "order_completion_rate": "Order completion consistency over recent work.",
    "claim_frequency_last_4_weeks": "How often the rider has claimed recently.",
    "ip_location_match": "How well the IP/network origin matches the claimed GPS zone.",
    "cluster_activation": "Whether many similar accounts activated around the same event.",
}


def generate_training_dataset():
    rng = np.random.default_rng(42)
    normal = np.column_stack(
        [
            rng.uniform(0.3, 0.8, 160),
            rng.uniform(0.6, 1.0, 160),
            rng.uniform(30, 730, 160),
            rng.uniform(-120, -5, 160),
            rng.uniform(0.7, 1.0, 160),
            rng.uniform(0, 3, 160),
            rng.uniform(0.7, 1.0, 160),
            rng.uniform(0, 1, 160),
        ]
    )
    anomalies = np.column_stack(
        [
            rng.uniform(0.85, 1.0, 40),
            rng.uniform(0.0, 0.4, 40),
            rng.uniform(0, 14, 40),
            rng.uniform(-2, 5, 40),
            rng.uniform(0.0, 0.4, 40),
            rng.uniform(4, 12, 40),
            rng.uniform(0.0, 0.3, 40),
            rng.uniform(3, 15, 40),
        ]
    )
    return np.vstack([normal, anomalies])


def build_or_load_model():
    if MODEL_PATH.exists():
        return joblib.load(MODEL_PATH)

    dataset = generate_training_dataset()
    model = IsolationForest(contamination=0.2, n_estimators=100, random_state=42)
    model.fit(dataset)
    joblib.dump(model, MODEL_PATH)
    return model


class FraudScoringService:
    def __init__(self):
        self.training_samples = 200
        self.contamination_rate = 0.2
        self.model = build_or_load_model()

    def build_features(self, payload):
        return np.array(
            [[
                payload.gps_path_smoothness,
                payload.zone_history_match,
                payload.device_age_days,
                payload.shift_start_before_alert_minutes,
                payload.order_completion_rate,
                payload.claim_frequency_last_4_weeks,
                payload.ip_location_match,
                payload.cluster_activation,
            ]]
        )

    def _normalize_score(self, raw_score):
        return float(np.clip(1 / (1 + np.exp(raw_score * 4)), 0, 1))

    def _contributing_factors(self, payload):
        factors = []
        if payload.gps_path_smoothness > 0.82:
            factors.append("GPS path is too smooth to look like a real rider route")
        if payload.zone_history_match < 0.45:
            factors.append("Current zone does not match the rider's usual working history")
        if payload.device_age_days < 21:
            factors.append("Device looks newly registered for delivery work")
        if payload.shift_start_before_alert_minutes > -5:
            factors.append("Shift started suspiciously close to the alert time")
        if payload.order_completion_rate < 0.55:
            factors.append("Recent order completion rate is unusually low")
        if payload.claim_frequency_last_4_weeks > 3:
            factors.append("Claim frequency is unusually high for the past 4 weeks")
        if payload.ip_location_match < 0.45:
            factors.append("IP/network location does not align with the GPS zone")
        if payload.cluster_activation > 2:
            factors.append("Multiple similar accounts activated around the same event")
        return factors or ["Signals look consistent with a legitimate rider"]

    def score(self, payload):
        raw_score = self.model.decision_function(self.build_features(payload))[0]
        risk_score = round(self._normalize_score(raw_score), 4)
        if risk_score < 0.35:
            risk_level = "low"
        elif risk_score <= 0.65:
            risk_level = "medium"
        else:
            risk_level = "high"

        factors = self._contributing_factors(payload)
        explanation = (
            "Claim looks legitimate based on route, device, and network behavior."
            if risk_level == "low"
            else "Claim shows some unusual behavior and should be reviewed."
            if risk_level == "medium"
            else "Claim strongly resembles spoofing or coordinated anomaly behavior."
        )

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "flag_for_review": risk_level != "low",
            "contributing_factors": factors,
            "explanation": explanation,
        }

    def model_info(self):
        samples = [
            {
                "label": "legitimate rider",
                "features": {
                    "gps_path_smoothness": 0.52,
                    "zone_history_match": 0.91,
                    "device_age_days": 240,
                    "shift_start_before_alert_minutes": -65,
                    "order_completion_rate": 0.94,
                    "claim_frequency_last_4_weeks": 1,
                    "ip_location_match": 0.92,
                    "cluster_activation": 0.2,
                },
            },
            {
                "label": "clear spoofer",
                "features": {
                    "gps_path_smoothness": 0.98,
                    "zone_history_match": 0.08,
                    "device_age_days": 3,
                    "shift_start_before_alert_minutes": 2,
                    "order_completion_rate": 0.12,
                    "claim_frequency_last_4_weeks": 9,
                    "ip_location_match": 0.1,
                    "cluster_activation": 8,
                },
            },
            {
                "label": "borderline case",
                "features": {
                    "gps_path_smoothness": 0.81,
                    "zone_history_match": 0.48,
                    "device_age_days": 25,
                    "shift_start_before_alert_minutes": -6,
                    "order_completion_rate": 0.61,
                    "claim_frequency_last_4_weeks": 3,
                    "ip_location_match": 0.5,
                    "cluster_activation": 2.4,
                },
            },
        ]

        sample_predictions = []
        for sample in samples:
            payload = type("Payload", (), sample["features"])
            prediction = self.score(payload)
            sample_predictions.append({
                "label": sample["label"],
                "features": sample["features"],
                "result": prediction,
            })

        return {
            "model_type": "IsolationForest",
            "training_samples": self.training_samples,
            "feature_names": FEATURE_NAMES,
            "feature_descriptions": FEATURE_DESCRIPTIONS,
            "contamination_rate": self.contamination_rate,
            "rationale": "IsolationForest was chosen because fraud labels are scarce, claim events are sparse, and anomaly detection works well before enough supervised data exists.",
            "sample_predictions": sample_predictions,
        }
