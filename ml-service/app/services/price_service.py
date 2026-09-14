from app.models.price_predictor import PricePredictor


_price_predictor = PricePredictor()


def predict_price(request):
    return _price_predictor.predict(request)
