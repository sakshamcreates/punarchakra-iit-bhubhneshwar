const express =
  require("express");

const matchingController =
  require("../controllers/matchingController");


const router =
  express.Router();


router.post(
  "/find",
  matchingController.findMatches
);


module.exports = router;