"""One-off conversion script: scrap_classifier.pth -> scrap_classifier.onnx

This is a LOCAL/DEV-ONLY utility. It requires PyTorch + torchvision to load
the existing trained weights and export them to ONNX. It is NOT part of the
deployed inference runtime (which uses ONNX Runtime only -- see
app/models/scrap_classifier.py and requirements.txt).

Run this again whenever the model is retrained (training/train_scrap_classifier.py
produces a new artifacts/scrap_classifier.pth) to refresh artifacts/scrap_classifier.onnx.

Requires: torch, torchvision, onnx (install separately -- these are NOT in
requirements.txt on purpose, since they are not needed to serve the API).

Usage (from the ml-service/ directory):
    pip install torch torchvision onnx
    python scripts/convert_to_onnx.py
"""
from __future__ import annotations

import json
from pathlib import Path

import torch
from torchvision import models

ROOT_DIR = Path(__file__).resolve().parents[1]  # ml-service/
ARTIFACTS_DIR = ROOT_DIR / "artifacts"
PTH_PATH = ARTIFACTS_DIR / "scrap_classifier.pth"
CLASS_NAMES_PATH = ARTIFACTS_DIR / "class_names.json"
ONNX_PATH = ARTIFACTS_DIR / "scrap_classifier.onnx"


def main() -> None:
    if not PTH_PATH.exists():
        raise FileNotFoundError(
            f"Trained weights not found at {PTH_PATH}. "
            "Run training/train_scrap_classifier.py first."
        )

    with CLASS_NAMES_PATH.open("r", encoding="utf-8") as handle:
        class_names = json.load(handle)

    model = models.mobilenet_v3_small(weights=None, num_classes=len(class_names))
    state_dict = torch.load(PTH_PATH, map_location="cpu")
    model.load_state_dict(state_dict)
    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    torch.onnx.export(
        model,
        dummy_input,
        str(ONNX_PATH),
        export_params=True,
        opset_version=13,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={
            "input": {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
        dynamo=False,
    )

    print(f"Exported ONNX model to: {ONNX_PATH}")
    print(f"File size: {ONNX_PATH.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
