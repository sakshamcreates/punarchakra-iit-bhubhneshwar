"""Train a real prototype price model for material price prediction."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT_DIR / "data" / "material_prices.csv"
ARTIFACT_PATH = ROOT_DIR / "artifacts" / "price_model.joblib"

FEATURE_COLUMNS = ["material", "historical_price", "location", "month", "demand", "supply"]
TARGET_COLUMN = "predicted_price"
CATEGORICAL_COLUMNS = ["material", "location"]
NUMERIC_COLUMNS = ["historical_price", "month", "demand", "supply"]


def train_model() -> Pipeline:
	"""Load the dataset, train the regression pipeline, and save the trained artifact."""
	dataset = pd.read_csv(DATA_PATH)
	missing_columns = [column for column in FEATURE_COLUMNS + [TARGET_COLUMN] if column not in dataset.columns]
	if missing_columns:
		raise ValueError(f"Dataset is missing required columns: {missing_columns}")

	features = dataset[FEATURE_COLUMNS]
	target = dataset[TARGET_COLUMN]

	preprocessor = ColumnTransformer(
		transformers=[
			("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_COLUMNS),
			("numeric", "passthrough", NUMERIC_COLUMNS),
		],
	)

	pipeline = Pipeline(
		steps=[
			("preprocess", preprocessor),
			("regressor", RandomForestRegressor(random_state=42, n_estimators=250, n_jobs=-1)),
		]
	)

	X_train, X_test, y_train, y_test = train_test_split(
		features,
		target,
		test_size=0.2,
		random_state=42,
	)

	pipeline.fit(X_train, y_train)
	predictions = pipeline.predict(X_test)

	mae = mean_absolute_error(y_test, predictions)
	rmse = mean_squared_error(y_test, predictions) ** 0.5
	r2 = r2_score(y_test, predictions)

	ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
	joblib.dump(pipeline, ARTIFACT_PATH)

	print(f"Loaded {len(dataset)} rows from {DATA_PATH}")
	print(f"Train/test split: {len(X_train)} train rows, {len(X_test)} test rows")
	print(f"MAE: {mae:.3f}")
	print(f"RMSE: {rmse:.3f}")
	print(f"R²: {r2:.3f}")
	print(f"Saved trained pipeline to {ARTIFACT_PATH}")

	return pipeline


def main() -> None:
	train_model()


if __name__ == "__main__":
	main()
