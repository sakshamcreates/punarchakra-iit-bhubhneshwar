from app.models.scrap_classifier import ScrapClassifier


_scrap_classifier = ScrapClassifier()


async def classify_scrap(image):
    image_bytes = await image.read()
    return _scrap_classifier.predict(image_bytes)
