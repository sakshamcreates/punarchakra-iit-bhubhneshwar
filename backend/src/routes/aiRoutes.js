const express = require("express");
const multer = require("multer");

const aiController = require("../controllers/aiController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.post(
  "/evaluate",
  upload.single("image"),
  aiController.evaluate
);

module.exports = router;