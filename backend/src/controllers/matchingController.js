const matchingService =
  require("../services/matchingService");


function findMatches(req, res, next) {
  try {
    const {
      listing,
      listingId,

      location,
      category,
      quantity,
      condition,
      price,

      limit
    } = req.body || {};


    /*
     * Support either:
     *
     * {
     *   listing: {...}
     * }
     *
     * OR direct fields.
     */

    const input = {
      listingId:
        listing?.id ||
        listingId ||
        null,

      location:
        listing?.location ||
        location,

      category:
        listing?.category ||
        category,

      quantity:
        listing?.quantity ||
        quantity ||
        1,

      condition:
        listing?.condition ||
        condition ||
        "fair",

      price:
        listing?.price ||
        price ||
        0,

      limit
    };


    if (!input.category) {
      return res.status(400).json({
        success: false,
        message:
          "category is required",
        data: null
      });
    }


    if (!input.location) {
      return res.status(400).json({
        success: false,
        message:
          "location is required",
        data: null
      });
    }


    const result =
      matchingService.findMatches(
        input
      );


    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
}


module.exports = {
  findMatches
};