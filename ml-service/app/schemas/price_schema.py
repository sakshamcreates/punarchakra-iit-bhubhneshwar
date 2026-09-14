from pydantic import BaseModel, Field


class PricePredictionRequest(BaseModel):
    material: str = Field(..., description="Scrap material name")
    historical_price: float = Field(..., ge=0)
    location: str = Field(..., description="Market location")
    month: int = Field(..., ge=1, le=12)
    demand: float = Field(..., ge=0, le=100)
    supply: float = Field(..., ge=0, le=100)