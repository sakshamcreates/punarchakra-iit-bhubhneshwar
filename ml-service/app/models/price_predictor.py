"""Prototype material price predictor that loads a trained scikit-learn pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping

import joblib
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_ARTIFACT_PATH = ROOT_DIR / "artifacts" / "price_model.joblib"


class PricePredictor:
	def __init__(self, model_version: str = "prototype", artifact_path: str | Path | None = None) -> None:
		self.model_version = model_version
		self.artifact_path = Path(artifact_path) if artifact_path is not None else DEFAULT_ARTIFACT_PATH
		self.pipeline = None
		self.status = "uninitialized"
		self._load_pipeline()

	def _load_pipeline(self) -> None:
		if not self.artifact_path.exists():
			self.status = "missing_artifact"
			return

		try:
			self.pipeline = joblib.load(self.artifact_path)
			self.status = "ready"
		except Exception as exc:  # pragma: no cover - defensive fallback for runtime issues
			self.pipeline = None
			self.status = f"load_error:{exc}"

	def _normalize_features(self, payload: Any) -> dict[str, Any]:
		if hasattr(payload, "model_dump"):
			data = payload.model_dump()
		elif isinstance(payload, Mapping):
			data = dict(payload)
		else:
			data = getattr(payload, "__dict__", {})

		if not isinstance(data, Mapping):
			raise TypeError("Prediction payload must be a mapping or object with fields")

		required_fields = ["material", "historical_price", "location", "month", "demand", "supply"]
		missing_fields = [field for field in required_fields if field not in data]
		if missing_fields:
			raise ValueError(f"Prediction payload is missing fields: {missing_fields}")

		return {
			"material": str(data["material"]),
			"historical_price": float(data["historical_price"]),
			"location": str(data["location"]),
			"month": int(data["month"]),
			"demand": float(data["demand"]),
			"supply": float(data["supply"]),
		}

	def predict(self, payload: Any) -> dict[str, Any]:
		try:
			features = self._normalize_features(payload)
		except (TypeError, ValueError) as exc:
			return {
				"material": None,
				"predicted_price": None,
				"location": None,
				"model_version": self.model_version,
				"status": "invalid_input",
				"error": str(exc),
			}

		if self.pipeline is None:
			return {
				"material": features.get("material"),
				"predicted_price": None,
				"location": features.get("location"),
				"model_version": self.model_version,
				"status": self.status,
				"error": (
					f"Model artifact was not found at {self.artifact_path}. "
					"Train the model first by running training/train_price_model.py."
				),
			}

		try:
			prediction = self.pipeline.predict(pd.DataFrame([features]))[0]
		except Exception as exc:  # pragma: no cover - defensive fallback for runtime issues
			return {
				"material": features.get("material"),
				"predicted_price": None,
				"location": features.get("location"),
				"model_version": self.model_version,
				"status": "prediction_error",
				"error": str(exc),
			}

		return {
			"material": features["material"],
			"predicted_price": round(float(prediction), 2),
			"location": features["location"],
			"model_version": self.model_version,
			"status": "ready",
		}
