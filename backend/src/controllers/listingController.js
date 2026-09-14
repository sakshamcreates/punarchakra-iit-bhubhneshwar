const listingService = require('../services/listingService');

exports.createListing = async (req, res, next) => {
  try {
    const listing = listingService.createListing(req.body, req.user);
    return res.status(201).json({
      success: true,
      data: listing
    });
  } catch (error) {
    next(error);
  }
};

exports.getListings = async (req, res, next) => {
  try {
    const listings = listingService.getListings(req.query);
    return res.json({
      success: true,
      data: listings
    });
  } catch (error) {
    next(error);
  }
};

exports.getListingById = async (req, res, next) => {
  try {
    const listing = listingService.getListingById(req.params.id);
    return res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    next(error);
  }
};

exports.updateListing = async (req, res, next) => {
  try {
    const listing = listingService.updateListing(req.params.id, req.body, req.user);
    return res.json({
      success: true,
      data: listing
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteListing = async (req, res, next) => {
  try {
    listingService.deleteListing(req.params.id, req.user);
    return res.json({
      success: true,
      data: null,
      message: 'Listing deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
