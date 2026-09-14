"""Generate synthetic prototype training data for material price prediction.

This script intentionally creates *synthetic prototype* data for ReValue.
It does not use or claim to contain real market prices.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


ROOT_DIR = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT_DIR / "data" / "material_prices.csv"

SEED = 42
ROWS_TARGET = 2400

MATERIALS = ["copper", "aluminium", "pcb", "battery", "plastic", "steel"]
LOCATIONS = ["Delhi", "Mumbai", "Bengaluru", "Kolkata", "Chennai", "Hyderabad"]
MONTHS = list(range(1, 13))

# These values define a synthetic prototype relationship, not real-world pricing.
MATERIAL_BASE_PRICE = {
	"copper": 720.0,
	"aluminium": 185.0,
	"pcb": 260.0,
	"battery": 95.0,
	"plastic": 38.0,
	"steel": 62.0,
}

LOCATION_MODIFIER = {
	"Delhi": 1.02,
	"Mumbai": 1.05,
	"Bengaluru": 1.00,
	"Kolkata": 0.98,
	"Chennai": 1.01,
	"Hyderabad": 0.99,
}

MONTH_MODIFIER = {
	1: 0.98,
	2: 0.99,
	3: 1.00,
	4: 1.01,
	5: 1.02,
	6: 1.03,
	7: 1.02,
	8: 1.01,
	9: 1.00,
	10: 1.01,
	11: 1.03,
	12: 1.04,
}

MATERIAL_TREND = {
	"copper": 36.0,
	"aluminium": 12.0,
	"pcb": 18.0,
	"battery": 9.0,
	"plastic": 4.5,
	"steel": 6.5,
}


def _clamp(value: float, minimum: float, maximum: float) -> float:
	return float(max(minimum, min(maximum, value)))


def _generate_row(rng: np.random.Generator, material: str, location: str, month: int) -> dict[str, object]:
	"""Build one synthetic prototype row with correlated features."""
	# Demand and supply are synthetic intensity scores (1-100), not actual market measurements.
	demand = int(rng.integers(35, 96))
	supply = int(rng.integers(30, 101))

	base_price = MATERIAL_BASE_PRICE[material]
	location_factor = LOCATION_MODIFIER[location]
	month_factor = MONTH_MODIFIER[month]
	material_trend = MATERIAL_TREND[material]

	# Historical price is correlated with the material baseline and the market context.
	historical_noise = rng.normal(0, base_price * 0.06)
	historical_price = (
		base_price
		* location_factor
		* month_factor
		* (1.0 + (demand - 55) / 220.0)
		* (1.0 - (supply - 55) / 260.0)
		+ historical_noise
	)
	historical_price = _clamp(historical_price, base_price * 0.55, base_price * 1.85)

	# The target depends on the requested inputs and includes limited noise so it is not deterministic.
	prediction_noise = rng.normal(0, base_price * 0.045)
	predicted_price = (
		historical_price * 0.60
		+ base_price * 0.22
		+ material_trend
		+ (demand - 50) * base_price * 0.0035
		- (supply - 50) * base_price * 0.0030
		+ (location_factor - 1.0) * base_price * 2.4
		+ (month_factor - 1.0) * base_price * 6.0
		+ prediction_noise
	)
	predicted_price = _clamp(predicted_price, base_price * 0.45, base_price * 2.1)

	return {
		"material": material,
		"historical_price": round(historical_price, 2),
		"location": location,
		"month": month,
		"demand": demand,
		"supply": supply,
		"predicted_price": round(predicted_price, 2),
	}


def generate_dataset(row_count: int = ROWS_TARGET, seed: int = SEED) -> pd.DataFrame:
	"""Generate a balanced synthetic dataset for prototype model training."""
	rng = np.random.default_rng(seed)
	grid = [(material, location, month) for material in MATERIALS for location in LOCATIONS for month in MONTHS]
	base_rows = [
		_generate_row(rng, material, location, month)
		for material, location, month in grid
	]

	rows = list(base_rows)
	while len(rows) < row_count:
		material = rng.choice(MATERIALS)
		location = rng.choice(LOCATIONS)
		month = int(rng.choice(MONTHS))
		rows.append(_generate_row(rng, material, location, month))

	return pd.DataFrame(rows[:row_count], columns=[
		"material",
		"historical_price",
		"location",
		"month",
		"demand",
		"supply",
		"predicted_price",
	])


def main() -> None:
	"""Write the synthetic prototype dataset to disk and print a short summary."""
	OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
	dataset = generate_dataset()
	dataset.to_csv(OUTPUT_PATH, index=False)

	print(f"Saved synthetic prototype dataset to {OUTPUT_PATH}")
	print(f"number of rows: {len(dataset)}")
	print(f"columns: {list(dataset.columns)}")
	print("material distribution:")
	print(dataset["material"].value_counts().sort_index().to_string())
	print("sample rows:")
	print(dataset.head(5).to_string(index=False))


if __name__ == "__main__":
	main()
