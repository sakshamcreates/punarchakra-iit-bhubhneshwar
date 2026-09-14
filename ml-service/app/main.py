from fastapi import (
    FastAPI,
    File,
    HTTPException,
    UploadFile,
    status,
)

from app.schemas.price_schema import PricePredictionRequest
from app.services.price_service import predict_price
from app.services.scrap_service import classify_scrap


app = FastAPI(
    title="Punarchakra ML Service",
    version="0.1.0",
)


# --------------------------------------------------
# HEALTH
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "success": True,
        "service": "Punarchakra ML Service",
    }


# --------------------------------------------------
# MOBILENET E-WASTE CLASSIFIER
# --------------------------------------------------

@app.post("/scrap/classify")
async def scrap_classify(
    image: UploadFile = File(...)
):
    if image is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image file was uploaded",
        )

    content_type = (
        image.content_type or ""
    ).lower()

    if not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be an image",
        )

    try:
        result = await classify_scrap(image)

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    model_status = str(
        result.get("status", "")
    )

    # Model files do not exist
    if model_status == "missing_artifacts":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Scrap classifier artifacts are missing. "
                "Train the MobileNet model first."
            ),
        )

    # class_names.json failed
    if model_status.startswith(
        "class_names_error"
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Could not load classifier class names: "
                f"{model_status}"
            ),
        )

    # Model failed to load
    if model_status.startswith("load_error"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Scrap classifier could not be loaded: "
                f"{model_status}"
            ),
        )

    if model_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Scrap classifier is unavailable: "
                f"{model_status}"
            ),
        )

    return {
        "success": True,
        "data": result,
    }


# --------------------------------------------------
# RANDOM FOREST MARKET PRICE MODEL
# --------------------------------------------------

@app.post("/price/predict")
def price_prediction(
    request: PricePredictionRequest
):
    result = predict_price(request)

    model_status = str(
        result.get("status", "")
    )

    if model_status == "missing_artifact":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Price model artifact is missing. "
                "Train the Random Forest model first."
            ),
        )

    if model_status.startswith("load_error"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Price model could not be loaded: "
                f"{model_status}"
            ),
        )

    if model_status == "invalid_input":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get(
                "error",
                "Invalid price prediction input",
            ),
        )

    if model_status == "prediction_error":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get(
                "error",
                "Price prediction failed",
            ),
        )

    if model_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Price predictor is unavailable: "
                f"{model_status}"
            ),
        )

    return {
        "success": True,
        "data": result,
    }