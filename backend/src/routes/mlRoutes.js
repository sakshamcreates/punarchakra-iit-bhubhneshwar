const express = require("express");
const multer = require("multer");

const mlController =
  require("../controllers/mlController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});


router.post(
  "/classify",
  upload.single("image"),
  mlController.classifyEWaste
);


router.post(
  "/predict-price",
  mlController.predictPrice
);


module.exports = router;