const listingRepository = require('../data/listingRepository');
const { SALE_TYPES, STATUSES } = require('../constants/listingConstants');

const requiredCreateFields = [
  'category',
  'subcategory',
  'brand',
  'model',
  'condition',
  'description',
  'images',
  'price',
  'location',
  'sale_type'
];

const validateCreatePayload = (payload) => {
  const missingFields = requiredCreateFields.filter(
    (field) => payload[field] === undefined || payload[field] === null || payload[field] === ''
  );

  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
    error.status = 400;
    throw error;
  }

  if (!Array.isArray(payload.images) || payload.images.length === 0) {
    const error = new Error('Images must be a non-empty array');
    error.status = 400;
    throw error;
  }

  if (!SALE_TYPES.includes(payload.sale_type)) {
    const error = new Error(`sale_type must be one of: ${SALE_TYPES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  if (payload.status && !STATUSES.includes(payload.status)) {
    const error = new Error(`status must be one of: ${STATUSES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  if (typeof payload.price !== 'number' || Number.isNaN(payload.price) || payload.price < 0) {
    const error = new Error('price must be a valid non-negative number');
    error.status = 400;
    throw error;
  }
};

const validateUpdatePayload = (payload) => {
  if (payload.images !== undefined && (!Array.isArray(payload.images) || payload.images.length === 0)) {
    const error = new Error('Images must be a non-empty array');
    error.status = 400;
    throw error;
  }

  if (payload.sale_type !== undefined && !SALE_TYPES.includes(payload.sale_type)) {
    const error = new Error(`sale_type must be one of: ${SALE_TYPES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  if (payload.status !== undefined && !STATUSES.includes(payload.status)) {
    const error = new Error(`status must be one of: ${STATUSES.join(', ')}`);
    error.status = 400;
    throw error;
  }

  if (payload.price !== undefined && (typeof payload.price !== 'number' || Number.isNaN(payload.price) || payload.price < 0)) {
    const error = new Error('price must be a valid non-negative number');
    error.status = 400;
    throw error;
  }
};

exports.createListing = (payload, user) => {
  validateCreatePayload(payload);

  const listing = listingRepository.create({
    seller_id: user.id,
    category: payload.category,
    subcategory: payload.subcategory,
    brand: payload.brand,
    model: payload.model,
    condition: payload.condition,
    description: payload.description,
    images: payload.images,
    price: payload.price,
    location: payload.location,
    sale_type: payload.sale_type,
    status: payload.status || 'draft'
  });

  return listing;
};

exports.getListings = (query) => {
  let listings = listingRepository.findAll();

  if (query.category) {
    listings = listings.filter(
      (listing) => listing.category.toLowerCase() === String(query.category).toLowerCase()
    );
  }

  if (query.sale_type) {
    listings = listings.filter(
      (listing) => listing.sale_type.toLowerCase() === String(query.sale_type).toLowerCase()
    );
  }

  if (query.status) {
    listings = listings.filter(
      (listing) => listing.status.toLowerCase() === String(query.status).toLowerCase()
    );
  }

  if (query.location) {
    listings = listings.filter(
      (listing) => listing.location.toLowerCase() === String(query.location).toLowerCase()
    );
  }

  if (query.seller_id) {
    listings = listings.filter((listing) => listing.seller_id === query.seller_id);
  }

  if (query.search) {
    const searchTerm = String(query.search).toLowerCase();
    listings = listings.filter((listing) => {
      return [
        listing.brand,
        listing.model,
        listing.category,
        listing.subcategory,
        listing.description
      ].some((value) => value && value.toLowerCase().includes(searchTerm));
    });
  }

  return listings;
};

exports.getListingById = (id) => {
  const listing = listingRepository.findById(id);
  if (!listing) {
    const error = new Error('Listing not found');
    error.status = 404;
    throw error;
  }

  return listing;
};

exports.updateListing = (id, payload, user) => {
  const listing = listingRepository.findById(id);
  if (!listing) {
    const error = new Error('Listing not found');
    error.status = 404;
    throw error;
  }

  if (listing.seller_id !== user.id && user.role !== 'admin') {
    const error = new Error('Forbidden: you cannot edit this listing');
    error.status = 403;
    throw error;
  }

  validateUpdatePayload(payload);

  const updates = {};
  const updatableFields = [
    'category',
    'subcategory',
    'brand',
    'model',
    'condition',
    'description',
    'images',
    'price',
    'location',
    'sale_type',
    'status'
  ];

  updatableFields.forEach((field) => {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return listing;
  }

  updates.updatedAt = new Date().toISOString();

  return listingRepository.update(id, updates);
};

exports.deleteListing = (id, user) => {
  const listing = listingRepository.findById(id);
  if (!listing) {
    const error = new Error('Listing not found');
    error.status = 404;
    throw error;
  }

  if (listing.seller_id !== user.id && user.role !== 'admin') {
    const error = new Error('Forbidden: you cannot delete this listing');
    error.status = 403;
    throw error;
  }

  listingRepository.remove(id);
  return listing;
};
