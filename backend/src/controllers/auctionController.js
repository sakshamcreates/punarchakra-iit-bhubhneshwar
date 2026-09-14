const auctionService =
  require("../services/auctionService");


function createAuction(
  req,
  res,
  next
) {
  try {
    const auction =
      auctionService
        .createAuction(
          req.body
        );


    return res
      .status(201)
      .json({
        success: true,

        data:
          auction
      });

  } catch (error) {
    next(error);
  }
}


function getAuction(
  req,
  res,
  next
) {
  try {
    const auction =
      auctionService
        .getAuction(
          req.params.id
        );


    return res.json({
      success: true,

      data:
        auction
    });

  } catch (error) {
    next(error);
  }
}


function placeBid(
  req,
  res,
  next
) {
  try {
    const auction =
      auctionService
        .placeBid(
          req.params.id,
          {
            amount:
              req.body.amount,

            /*
             * For now bidder can come
             * directly from body.
             *
             * Later we can replace this
             * with authenticated user ID.
             */
            bidder:
              req.body.bidder
          }
        );


    return res.json({
      success: true,

      message:
        "Bid placed successfully",

      data:
        auction
    });

  } catch (error) {
    next(error);
  }
}

function getAllAuctions(
  req,
  res,
  next
) {
  try {
    const auctions =
      auctionService.getAllAuctions();

    return res.json({
      success: true,
      data: auctions
    });
  } catch (error) {
    next(error);
  }
}
module.exports = {
  createAuction,
  getAuction,
  placeBid,
  getAllAuctions
};