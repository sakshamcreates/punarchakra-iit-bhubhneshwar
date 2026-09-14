const express = require('express');
const listingController = require('../controllers/listingController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, listingController.createListing);
router.get('/', listingController.getListings);
router.get('/:id', listingController.getListingById);
router.put('/:id', authMiddleware, listingController.updateListing);
router.delete('/:id', authMiddleware, listingController.deleteListing);

module.exports = router;
