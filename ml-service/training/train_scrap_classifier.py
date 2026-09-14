"""Train the scrap image classifier from the populated dataset folders."""

from __future__ import annotations

from torchvision.models import MobileNet_V3_Small_Weights
import json
import random
from collections import Counter
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, models, transforms

ROOT_DIR = Path(__file__).resolve().parents[1]
TRAIN_DIR = ROOT_DIR / "data" / "scrap" / "train"
VAL_DIR = ROOT_DIR / "data" / "scrap" / "val"
ARTIFACT_DIR = ROOT_DIR / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "scrap_classifier.pth"
CLASS_NAMES_PATH = ARTIFACT_DIR / "class_names.json"
METRICS_PATH = ARTIFACT_DIR / "scrap_classifier_metrics.json"

SEED = 42
EPOCHS = 5
BATCH_SIZE = 64
IMAGE_SIZE = 224
NUM_WORKERS = 0


def set_seed(seed: int) -> None:
	random.seed(seed)
	np.random.seed(seed)
	torch.manual_seed(seed)
	if torch.cuda.is_available():
		torch.cuda.manual_seed_all(seed)
		torch.backends.cudnn.deterministic = True
		torch.backends.cudnn.benchmark = False


def build_transforms() -> tuple[transforms.Compose, transforms.Compose]:
	train_transform = transforms.Compose([
		transforms.Resize((256, 256)),
		transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0)),
		transforms.RandomHorizontalFlip(),
		transforms.ToTensor(),
		transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
	])
	val_transform = transforms.Compose([
		transforms.Resize((256, 256)),
		transforms.CenterCrop(IMAGE_SIZE),
		transforms.ToTensor(),
		transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
	])
	return train_transform, val_transform


from torchvision.models import MobileNet_V3_Small_Weights

def build_model(num_classes: int) -> nn.Module:
    weights = MobileNet_V3_Small_Weights.DEFAULT

    model = models.mobilenet_v3_small(
        weights=weights
    )

    classifier = model.classifier

    if not isinstance(classifier, nn.Sequential):
        raise TypeError(
            "Expected MobileNetV3 classifier to be a Sequential module"
        )

    last_layer = classifier[3]

    if not isinstance(last_layer, nn.Linear):
        raise TypeError(
            "Expected MobileNetV3 classifier head to be a Linear layer"
        )

    classifier[3] = nn.Linear(
        last_layer.in_features,
        num_classes
    )

    return model


def count_images_per_class(dataset: datasets.ImageFolder) -> dict[str, int]:
	counts = Counter(dataset.targets)
	return {class_name: int(counts[index]) for index, class_name in enumerate(dataset.classes)}


def has_images(directory: Path) -> bool:
	if not directory.exists():
		return False
	return any(path.is_file() for path in directory.rglob("*"))


def print_class_summary(class_names: list[str], counts: dict[str, int]) -> None:
	print("Detected class names:")
	for class_name in class_names:
		print(f"- {class_name}")
	print("Image count per class:")
	for class_name in class_names:
		print(f"- {class_name}: {counts[class_name]}")
	print(f"Total images: {sum(counts.values())}")


def stratified_split(dataset: datasets.ImageFolder) -> tuple[list[int], list[int]]:
	indices = list(range(len(dataset)))
	train_indices, val_indices = train_test_split(
		indices,
		test_size=0.2,
		random_state=SEED,
		stratify=dataset.targets,
	)
	return list(train_indices), list(val_indices)


def build_dataloaders() -> tuple[
	list[str],
	dict[str, int],
	DataLoader,
	DataLoader,
	int,
	int,
	bool,
]:
	train_transform, val_transform = build_transforms()
	base_dataset = datasets.ImageFolder(TRAIN_DIR)
	class_names = list(base_dataset.classes)
	counts = count_images_per_class(base_dataset)

	train_dataset = datasets.ImageFolder(TRAIN_DIR, transform=train_transform)
	val_dir_has_images = has_images(VAL_DIR)
	validation_source = "split"

	if val_dir_has_images:
		val_dataset = datasets.ImageFolder(VAL_DIR, transform=val_transform)
		if list(val_dataset.classes) == class_names:
			train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS)
			val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
			return class_names, counts, train_loader, val_loader, len(train_dataset), len(val_dataset), False
		validation_source = "split_due_to_class_mismatch"

	train_indices, val_indices = stratified_split(base_dataset)
	train_loader = DataLoader(Subset(train_dataset, train_indices), batch_size=BATCH_SIZE, shuffle=True, num_workers=NUM_WORKERS)
	val_loader = DataLoader(Subset(datasets.ImageFolder(TRAIN_DIR, transform=val_transform), val_indices), batch_size=BATCH_SIZE, shuffle=False, num_workers=NUM_WORKERS)
	return class_names, counts, train_loader, val_loader, len(train_indices), len(val_indices), validation_source == "split_due_to_class_mismatch"


def run_epoch(model: nn.Module, loader: DataLoader, criterion: nn.Module, device: torch.device, optimizer: torch.optim.Optimizer | None = None) -> tuple[float, float, list[int], list[int]]:
	is_training = optimizer is not None
	model.train(mode=is_training)
	total_loss = 0.0
	total_correct = 0
	total_samples = 0
	all_targets: list[int] = []
	all_predictions: list[int] = []

	for images, targets in loader:
		images = images.to(device)
		targets = targets.to(device)

		with torch.set_grad_enabled(is_training):
			outputs = model(images)
			loss = criterion(outputs, targets)
			if is_training:
				optimizer.zero_grad(set_to_none=True)
				loss.backward()
				optimizer.step()

		predictions = outputs.argmax(dim=1)
		batch_size = targets.size(0)
		total_loss += float(loss.item()) * batch_size
		total_correct += int((predictions == targets).sum().item())
		total_samples += batch_size
		all_targets.extend(targets.detach().cpu().tolist())
		all_predictions.extend(predictions.detach().cpu().tolist())

	average_loss = total_loss / max(total_samples, 1)
	accuracy = total_correct / max(total_samples, 1)
	return average_loss, accuracy, all_targets, all_predictions


def metrics_by_class(class_names: list[str], y_true: Iterable[int], y_pred: Iterable[int]) -> dict[str, object]:
	true_labels = list(y_true)
	pred_labels = list(y_pred)
	precision, recall, f1, _ = precision_recall_fscore_support(
		true_labels,
		pred_labels,
		labels=list(range(len(class_names))),
		zero_division=0,
	)
	macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
		true_labels,
		pred_labels,
		average="macro",
		zero_division=0,
	)
	return {
		"macro_precision": float(macro_precision),
		"macro_recall": float(macro_recall),
		"macro_f1": float(macro_f1),
		"per_class": {
			class_names[index]: {
				"precision": float(precision[index]),
				"recall": float(recall[index]),
				"f1": float(f1[index]),
			}
			for index in range(len(class_names))
		},
	}


def train_model() -> dict[str, object]:
	set_seed(SEED)
	device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
	class_names, counts, train_loader, val_loader, train_count, val_count, split_was_adjusted = build_dataloaders()
	num_classes = len(class_names)
	model = build_model(num_classes).to(device)
	criterion = nn.CrossEntropyLoss()
	optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

	print_class_summary(class_names, counts)
	print(f"Train/validation counts: {train_count} train, {val_count} validation")
	if split_was_adjusted:
		print("Validation set used a safe split because the existing val folder had a class mismatch.")
	elif not has_images(VAL_DIR):
		print("Validation set was empty, so a reproducible 80/20 split was created from train/.")
	print(f"Detected number of classes: {num_classes}")
	print(f"Training device: {device}")

	history: list[dict[str, float | int]] = []
	for epoch in range(1, EPOCHS + 1):
		train_loss, train_accuracy, _, _ = run_epoch(model, train_loader, criterion, device, optimizer)
		val_loss, val_accuracy, val_targets, val_predictions = run_epoch(model, val_loader, criterion, device)
		history.append({
			"epoch": epoch,
			"train_loss": float(train_loss),
			"train_accuracy": float(train_accuracy),
			"validation_loss": float(val_loss),
			"validation_accuracy": float(val_accuracy),
		})
		print(
			f"Epoch {epoch}/{EPOCHS} - "
			f"train_loss: {train_loss:.4f} - train_accuracy: {train_accuracy:.4f} - "
			f"validation_loss: {val_loss:.4f} - validation_accuracy: {val_accuracy:.4f}"
		)

	final_train_loss = history[-1]["train_loss"]
	final_train_accuracy = history[-1]["train_accuracy"]
	final_val_loss = history[-1]["validation_loss"]
	final_val_accuracy = history[-1]["validation_accuracy"]
	final_metrics = metrics_by_class(class_names, val_targets, val_predictions)
	validation_accuracy = accuracy_score(val_targets, val_predictions)

	ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
	torch.save(model.state_dict(), MODEL_PATH)
	with CLASS_NAMES_PATH.open("w", encoding="utf-8") as handle:
		json.dump(class_names, handle, indent=2)

	metrics = {
		"detected_class_names": class_names,
		"class_name_to_index": {class_name: index for index, class_name in enumerate(class_names)},
		"image_count_per_class": counts,
		"total_images": int(sum(counts.values())),
		"train_count": int(train_count),
		"validation_count": int(val_count),
		"validation_source": "split" if not has_images(VAL_DIR) else ("existing_val" if not split_was_adjusted else "split_due_to_class_mismatch"),
		"epochs": EPOCHS,
		"device": str(device),
		"history": history,
		"final_metrics": {
			"train_loss": float(final_train_loss),
			"train_accuracy": float(final_train_accuracy),
			"validation_loss": float(final_val_loss),
			"validation_accuracy": float(final_val_accuracy),
			"validation_accuracy_sklearn": float(validation_accuracy),
			"macro_precision": final_metrics["macro_precision"],
			"macro_recall": final_metrics["macro_recall"],
			"macro_f1": final_metrics["macro_f1"],
			"per_class": final_metrics["per_class"],
		},
		"artifacts": {
			"model": str(MODEL_PATH),
			"class_names": str(CLASS_NAMES_PATH),
			"metrics": str(METRICS_PATH),
		},
	}

	with METRICS_PATH.open("w", encoding="utf-8") as handle:
		json.dump(metrics, handle, indent=2)

	print(f"Train loss: {final_train_loss:.4f}")
	print(f"Train accuracy: {final_train_accuracy:.4f}")
	print(f"Validation loss: {final_val_loss:.4f}")
	print(f"Validation accuracy: {final_val_accuracy:.4f}")
	print(f"Macro precision: {final_metrics['macro_precision']:.4f}")
	print(f"Macro recall: {final_metrics['macro_recall']:.4f}")
	print(f"Macro F1: {final_metrics['macro_f1']:.4f}")
	print("Per-class precision/recall/F1:")
	for class_name in class_names:
		class_metrics = final_metrics["per_class"][class_name]
		print(
			f"- {class_name}: precision={class_metrics['precision']:.4f}, "
			f"recall={class_metrics['recall']:.4f}, f1={class_metrics['f1']:.4f}"
		)
	print(f"Saved model to {MODEL_PATH}")
	print(f"Saved class names to {CLASS_NAMES_PATH}")
	print(f"Saved metrics to {METRICS_PATH}")

	return metrics


def main() -> None:
	train_model()


if __name__ == "__main__":
	main()
