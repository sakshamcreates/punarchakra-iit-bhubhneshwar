ReValue ML Service

Lightweight FastAPI service for the ReValue project.

## Run

```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `POST /scrap/classify`
- `POST /price/predict`

## Notes

- Scrap classification is served by a MobileNetV3 Small model exported to
  ONNX and run via ONNX Runtime (no PyTorch/torchvision required at
  runtime — see `requirements.txt`). The original PyTorch weights
  (`artifacts/scrap_classifier.pth`) are kept for local training/re-export
  only; see `scripts/convert_to_onnx.py`.
- Price prediction is served by a scikit-learn pipeline loaded via
  `joblib` (`artifacts/price_model.joblib`).
- Training scripts (`training/`) still use PyTorch and are for local
  model development, not part of the deployed API.
