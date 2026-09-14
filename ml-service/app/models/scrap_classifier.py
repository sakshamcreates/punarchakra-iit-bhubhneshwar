"""Scrap image classifier backed by a MobileNetV3 Small model, served via
ONNX Runtime (no PyTorch/torchvision dependency at inference time).

The model was originally trained with PyTorch (see
``ml-service/training/train_scrap_classifier.py``) and exported once to
``artifacts/scrap_classifier.onnx`` for deployment. That export step is a
local/dev-only utility and still requires PyTorch, but the deployed API
below only needs ``onnxruntime``, ``numpy``, and ``Pillow``.
"""

from __future__ import annotations

import json
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from PIL import Image, UnidentifiedImageError

ROOT_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = ROOT_DIR / "artifacts" / "scrap_classifier.onnx"
CLASS_NAMES_PATH = ROOT_DIR / "artifacts" / "class_names.json"

_IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class ScrapClassifier:
    def __init__(self, model_version: str = "mobilenet-scrap-v1") -> None:
        self.model_version = model_version
        self.session: ort.InferenceSession | None = None
        self.input_name: str | None = None
        self.class_names: list[str] = []
        self.status = "uninitialized"
        self._load_artifacts()

    def _load_artifacts(self) -> None:
        if not MODEL_PATH.exists() or not CLASS_NAMES_PATH.exists():
            self.status = "missing_artifacts"
            return

        try:
            with CLASS_NAMES_PATH.open("r", encoding="utf-8") as handle:
                self.class_names = json.load(handle)
        except Exception as exc:
            self.status = f"class_names_error:{exc}"
            return

        try:
            self.session = ort.InferenceSession(
                str(MODEL_PATH),
                providers=["CPUExecutionProvider"],
            )
            self.input_name = self.session.get_inputs()[0].name
            self.status = "ready"

        except Exception as exc:
            self.session = None
            self.status = f"load_error:{exc}"

    def _preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        if not image_bytes:
            raise ValueError("Uploaded image is empty")

        try:
            pil_image = Image.open(BytesIO(image_bytes))
            pil_image.load()

        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError(
                "Uploaded file is not a valid image"
            ) from exc

        pil_image = pil_image.convert("RGB").resize(
            (224, 224),
            Image.BILINEAR,
        )

        # Match torchvision.transforms.ToTensor() + Normalize(imagenet stats):
        # scale to [0, 1], convert HWC -> CHW, then standardize per channel.
        array = np.asarray(pil_image, dtype=np.float32) / 255.0
        array = (array - _IMAGENET_MEAN) / _IMAGENET_STD
        array = array.transpose(2, 0, 1)  # HWC -> CHW
        array = np.expand_dims(array, axis=0)  # add batch dim

        return np.ascontiguousarray(array, dtype=np.float32)

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        shifted = logits - np.max(logits)
        exp = np.exp(shifted)
        return exp / np.sum(exp)

    def predict(self, image_bytes: bytes) -> dict[str, Any]:
        if self.session is None:
            return {
                "material": None,
                "confidence": None,
                "top_predictions": [],
                "model_version": self.model_version,
                "status": self.status,
                "error": (
                    "Model artifacts were not found or could not be loaded. "
                    "Train the scrap classifier first by running the training script."
                ),
            }

        try:
            input_tensor = self._preprocess_image(image_bytes)
        except (TypeError, ValueError, UnidentifiedImageError) as exc:
            raise ValueError(str(exc)) from exc

        outputs = self.session.run(None, {self.input_name: input_tensor})
        logits = outputs[0][0]
        probabilities = self._softmax(logits)

        k = min(3, len(self.class_names))
        top_indices = np.argsort(probabilities)[::-1][:k]

        labels = [self.class_names[index] for index in top_indices]
        confidences = [
            round(float(probabilities[index]), 4) for index in top_indices
        ]

        return {
            "material": labels[0],
            "confidence": confidences[0],
            "top_predictions": [
                {
                    "material": label,
                    "confidence": confidence,
                }
                for label, confidence in zip(
                    labels,
                    confidences,
                )
            ],
            "model_version": self.model_version,
            "status": "ready",
        }