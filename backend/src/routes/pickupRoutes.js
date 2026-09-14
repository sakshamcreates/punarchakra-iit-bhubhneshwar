const express =
  require("express");

const pickupController =
  require("../controllers/pickupController");


const router =
  express.Router();


router.post(
  "/",
  pickupController.createPickup
);

router.get(
  "/nearby",
  pickupController.nearbyPickups
);

router.get(
  "/kabadiwala/:kabadiwalaId",
  pickupController.kabadiwalaPickups
);

router.get(
  "/kabadiwala/:kabadiwalaId/route",
  pickupController.routePlan
);

router.get(
  "/kabadiwala/:kabadiwalaId/stats",
  pickupController.stats
);

router.get(
  "/seller/:sellerId",
  pickupController.sellerPickups
);

router.post(
  "/:id/accept",
  pickupController.acceptPickup
);

router.post(
  "/:id/advance",
  pickupController.advanceStatus
);

router.patch(
  "/:id/status",
  pickupController.updateStatus
);

router.get(
  "/:id",
  pickupController.getPickup
);

module.exports =
  router;