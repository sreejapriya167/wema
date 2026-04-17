from typing import Dict, List

from pydantic import BaseModel


class FraudScoreRequest(BaseModel):
    gps_path_smoothness: float
    zone_history_match: float
    device_age_days: float
    shift_start_before_alert_minutes: float
    order_completion_rate: float
    claim_frequency_last_4_weeks: float
    ip_location_match: float
    cluster_activation: float


class FraudScoreResponse(BaseModel):
    risk_score: float
    risk_level: str
    flag_for_review: bool
    contributing_factors: List[str]
    explanation: str


class FraudModelInfoResponse(BaseModel):
    model_type: str
    training_samples: int
    feature_names: List[str]
    feature_descriptions: Dict[str, str]
    contamination_rate: float
    rationale: str
    sample_predictions: List[Dict[str, object]]
