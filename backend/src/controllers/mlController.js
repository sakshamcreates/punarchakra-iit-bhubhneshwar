const mlService = require("../services/mlService");


exports.classifyEWaste = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required"
      });
    }

    const result =
      await mlService.classifyEWaste(req.file);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};


exports.predictPrice = async (req, res, next) => {
  try {
    const result =
      await mlService.predictPrice(req.body);

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};