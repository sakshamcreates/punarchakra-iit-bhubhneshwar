// Future multimodal adapter boundary
// This file is intentionally lightweight so a real image analysis model
// can be plugged in later without changing the AI valuation API.

exports.analyzeProductImages = (images = []) => {
  if (!Array.isArray(images) || images.length === 0) {
    return {
      category: null,
      brand: null,
      model: null,
      confidence: 0
    };
  }

  return {
    category: null,
    brand: null,
    model: null,
    confidence: 0
  };
};
