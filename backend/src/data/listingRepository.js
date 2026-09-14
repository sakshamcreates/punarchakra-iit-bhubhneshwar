const { v4: uuidv4 } = require('uuid');

function now() {
  return new Date().toISOString();
}

const seedListings = [
  {
    id: 'listing-seed-laptop-001',
    seller_id: 'user_1',
    category: 'electronics',
    subcategory: 'laptop',
    brand: 'Dell',
    model: 'Latitude 7490',
    condition: 'good',
    description: 'Well-maintained Dell Latitude ideal for office work and light multimedia.',
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Dell_Latitude_7490_notebook_computer.jpg/320px-Dell_Latitude_7490_notebook_computer.jpg'],
    price: 45000,
    location: 'Delhi',
    sale_type: 'fixed',
    status: 'active'
  },
  {
    id: 'listing-seed-phone-002',
    seller_id: 'user_2',
    category: 'electronics',
    subcategory: 'smartphone',
    brand: 'Samsung',
    model: 'Galaxy S20',
    condition: 'fair',
    description: 'Used Samsung Galaxy S20 with a few scratches, fully functional.',
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg/250px-Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg'],
    price: 15000,
    location: 'Mumbai',
    sale_type: 'auction',
    status: 'active'
  },
  {
    id: 'listing-seed-appliance-003',
    seller_id: 'user_3',
    category: 'home_appliances',
    subcategory: 'washing_machine',
    brand: 'LG',
    model: 'FHM1009ZD',
    condition: 'good',
    description: 'Front-load washing machine available for parts or donation.',
    images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Washing_machine%2C_open.jpg/240px-Washing_machine%2C_open.jpg'],
    price: 0,
    location: 'Bengaluru',
    sale_type: 'donation',
    status: 'active'
  }
];

const listings = seedListings.map((seed) => ({
  id: seed.id || uuidv4(),
  ...seed,
  createdAt: now(),
  updatedAt: now()
}));

function clone(listing) {
  return listing ? JSON.parse(JSON.stringify(listing)) : null;
}

exports.findAll = () => {
  return listings.map(clone);
};

exports.findById = (id) => {
  return listings.find((listing) => listing.id === id) || null;
};

exports.create = ({ id, seller_id, category, subcategory, brand, model, condition, description, images, price, location, sale_type, status }) => {
  const listing = {
    id: id || uuidv4(),
    seller_id,
    category,
    subcategory,
    brand,
    model,
    condition,
    description,
    images,
    price,
    location,
    sale_type,
    status,
    createdAt: now(),
    updatedAt: now()
  };

  const existingIndex = listings.findIndex((item) => item.id === listing.id);
  if (existingIndex >= 0) {
    listings[existingIndex] = listing;
  } else {
    listings.push(listing);
  }
  return listing;
};

exports.update = (id, updates) => {
  const listing = listings.find((item) => item.id === id);
  if (!listing) {
    return null;
  }

  Object.keys(updates || {}).forEach((key) => {
    if (updates[key] === undefined) {
      delete listing[key];
    } else {
      listing[key] = updates[key];
    }
  });
  listing.updatedAt = now();
  return listing;
};

exports.remove = (id) => {
  const index = listings.findIndex((item) => item.id === id);
  if (index === -1) {
    return false;
  }

  listings.splice(index, 1);
  return true;
};

exports.removeWhere = (predicate) => {
  let removed = 0;
  for (let index = listings.length - 1; index >= 0; index -= 1) {
    if (predicate(listings[index])) {
      listings.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
};
