const pickupService =
  require("../services/pickupService");


function createPickup(
  req,
  res,
  next
) {
  try {
    const pickup =
      pickupService
        .createPickup(
          req.body
        );

    return res
      .status(201)
      .json({
        success: true,
        data: pickup
      });

  } catch (error) {
    next(error);
  }
}


function getPickup(
  req,
  res,
  next
) {
  try {
    const pickup =
      pickupService
        .getPickup(
          req.params.id
        );

    return res.json({
      success: true,
      data: pickup
    });

  } catch (error) {
    next(error);
  }
}


function nearbyPickups(
  req,
  res,
  next
) {
  try {
    const pickups =
      pickupService
        .getNearbyPickups(
          req.query.location,
          req.query.limit
        );

    return res.json({
      success: true,
      data: pickups
    });

  } catch (error) {
    next(error);
  }
}


function acceptPickup(
  req,
  res,
  next
) {
  try {
    const pickup =
      pickupService
        .acceptPickup(
          req.params.id,
          req.body.kabadiwala
        );

    return res.json({
      success: true,
      message:
        "Pickup accepted",
      data: pickup
    });

  } catch (error) {
    next(error);
  }
}


function updateStatus(
  req,
  res,
  next
) {
  try {
    const pickup =
      pickupService
        .updatePickupStatus(
          req.params.id,
          req.body.status
        );

    return res.json({
      success: true,
      message:
        "Pickup status updated",
      data: pickup
    });

  } catch (error) {
    next(error);
  }
}


function advanceStatus(
  req,
  res,
  next
) {
  try {
    const pickup =
      pickupService
        .advancePickupStatus(
          req.params.id
        );

    return res.json({
      success: true,
      message:
        "Pickup advanced",
      data: pickup
    });

  } catch (error) {
    next(error);
  }
}


function kabadiwalaPickups(
  req,
  res,
  next
) {
  try {
    const pickups =
      pickupService
        .getKabadiwalaPickups(
          req.params.kabadiwalaId
        );

    return res.json({
      success: true,
      data: pickups
    });

  } catch (error) {
    next(error);
  }
}


function sellerPickups(
  req,
  res,
  next
) {
  try {
    const pickups =
      pickupService
        .getSellerPickups(
          req.params.sellerId
        );

    return res.json({
      success: true,
      data: pickups
    });

  } catch (error) {
    next(error);
  }
}


function routePlan(
  req,
  res,
  next
) {
  try {
    const result =
      pickupService
        .getOptimizedRoute(
          req.params.kabadiwalaId,
          req.query.location ||
            "Delhi"
        );

    return res.json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
}


function stats(
  req,
  res,
  next
) {
  try {
    const result =
      pickupService
        .getKabadiwalaStats(
          req.params.kabadiwalaId,
          req.query.location ||
            "Delhi"
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
  createPickup,
  getPickup,
  nearbyPickups,
  acceptPickup,
  updateStatus,
  advanceStatus,
  kabadiwalaPickups,
  sellerPickups,
  routePlan,
  stats
};