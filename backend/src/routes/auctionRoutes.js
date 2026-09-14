const express =
  require("express");

const auctionController =
  require("../controllers/auctionController");


const router =
  express.Router();


/*
 * POST /api/auction
 *
 * Create auction
 */
router.post(
  "/",
  auctionController
    .createAuction
);


/*
 * GET /api/auction/:id
 *
 * Fetch auction +
 * current bid +
 * highest bidder +
 * status +
 * bid history
 */
router.get(
  "/",
  auctionController.getAllAuctions
);

router.get(
  "/:id",
  auctionController
    .getAuction
);


/*
 * POST /api/auction/:id/bid
 *
 * Place new bid.
 */
router.post(
  "/:id/bid",
  auctionController
    .placeBid
);


module.exports =
  router;