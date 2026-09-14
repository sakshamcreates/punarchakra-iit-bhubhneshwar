export const valuationRoutes = [
  { name: "Sell Whole", value: "₹12,500", time: "1–3 days", note: "Fastest sale", href: "/marketplace" },
  { name: "Sell Components", value: "₹15,800", time: "3–7 days", note: "Recommended", href: "/dashboard" },
  { name: "Repair + Sell", value: "₹14,200", time: "7–12 days", note: "Requires repair", href: "/dashboard" },
  { name: "Auction", value: "₹13,000–17,000", time: "1–5 days", note: "Price discovery", href: "/auctions" },
  { name: "Scrap", value: "₹2,300", time: "Same day", note: "Low effort", href: "/scrap" },
  { name: "Donate", value: "Social impact", time: "Same day", note: "Non-cash route", href: "/dashboard" }
];

export const marketplaceListings = [
  {
    id: "m-001",
    title: "Samsung Galaxy M32 5G",
    category: "phone",
    type: "whole",
    saleType: "fixed",
    condition: "Very Good",
    conditionScore: 8,
    price: 9999,
    currentBid: null,
    location: "Mumbai",
    distanceKm: 5,
    seller: "MumbaiMobiles",
    sellerVerified: true,
    sellerRating: 4.6,
    specifications: {
      brand: "Samsung",
      model: "Galaxy M32 5G",
      storage: "128GB",
      ram: "6GB",
      battery: "5000mAh",
      colour: "Blue"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg/250px-Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-002",
    title: "iPhone 11 64GB",
    category: "phone",
    type: "whole",
    saleType: "auction",
    condition: "Good",
    conditionScore: 7,
    price: 0,
    currentBid: 18200,
    location: "Bengaluru",
    distanceKm: 18,
    seller: "PhoneBazaar",
    sellerVerified: false,
    sellerRating: 4.2,
    specifications: {
      brand: "Apple",
      model: "iPhone 11",
      storage: "64GB",
      ram: "4GB",
      colour: "Black"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/IPhone_11_Black.svg/240px-IPhone_11_Black.svg.png"],
    bids: [
      { bidder: "AnitaK", amount: 16800, time: "2026-08-08T08:15:00Z", isMine: false },
      { bidder: "Rohan94", amount: 17450, time: "2026-08-08T09:20:00Z", isMine: false },
      { bidder: "You", amount: 18200, time: "2026-08-08T09:45:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 1.5).toISOString()
  },
  {
    id: "m-003",
    title: "Dell Inspiron 15 3511",
    category: "laptop",
    type: "whole",
    saleType: "fixed",
    condition: "Good",
    conditionScore: 7,
    price: 25999,
    currentBid: null,
    location: "Pune",
    distanceKm: 22,
    seller: "CampusComputers",
    sellerVerified: true,
    sellerRating: 4.7,
    specifications: {
      brand: "Dell",
      model: "Inspiron 15 3511",
      processor: "Intel Core i5 11th Gen",
      ram: "8GB DDR4",
      storage: "512GB SSD",
      screen: "15.6-inch FHD"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Dell_Latitude_7490_notebook_computer.jpg/320px-Dell_Latitude_7490_notebook_computer.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-004",
    title: "MacBook Air M1 256GB",
    category: "laptop",
    type: "whole",
    saleType: "auction",
    condition: "Excellent",
    conditionScore: 9,
    price: 0,
    currentBid: 45200,
    location: "Hyderabad",
    distanceKm: 12,
    seller: "AppleCertified",
    sellerVerified: true,
    sellerRating: 4.9,
    specifications: {
      brand: "Apple",
      model: "MacBook Air M1",
      processor: "Apple M1",
      ram: "8GB",
      storage: "256GB SSD",
      screen: "13.3-inch Retina"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/MacBook_Air_M1.png/320px-MacBook_Air_M1.png"],
    bids: [
      { bidder: "TechJatin", amount: 39800, time: "2026-08-08T05:10:00Z", isMine: false },
      { bidder: "ShefaliP", amount: 42200, time: "2026-08-08T06:40:00Z", isMine: false },
      { bidder: "You", amount: 45200, time: "2026-08-08T09:05:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 28).toISOString()
  },
  {
    id: "m-005",
    title: "Kingston NV2 1TB SSD",
    category: "SSD",
    type: "component",
    saleType: "fixed",
    condition: "Excellent",
    conditionScore: 9,
    price: 3699,
    currentBid: null,
    location: "Chennai",
    distanceKm: 8,
    seller: "StorageMart",
    sellerVerified: true,
    sellerRating: 4.5,
    specifications: {
      brand: "Kingston",
      model: "NV2",
      capacity: "1TB",
      interface: "NVMe PCIe 3.0",
      formFactor: "M.2 2280"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/M.2_Solid-State_Drive.jpg/320px-M.2_Solid-State_Drive.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-006",
    title: "Corsair Vengeance 16GB DDR4 3200MHz",
    category: "RAM",
    type: "component",
    saleType: "fixed",
    condition: "Very Good",
    conditionScore: 8,
    price: 2499,
    currentBid: null,
    location: "Delhi",
    distanceKm: 16,
    seller: "RAMWorld",
    sellerVerified: false,
    sellerRating: 4.1,
    specifications: {
      brand: "Corsair",
      kit: "16GB (2x8GB)",
      speed: "3200MHz",
      type: "DDR4",
      voltage: "1.35V"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Swissbit_2GB_PC2-6400_CL5_ECC.jpg/320px-Swissbit_2GB_PC2-6400_CL5_ECC.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-007",
    title: "NVIDIA GTX 1650 4GB",
    category: "GPU",
    type: "component",
    saleType: "auction",
    condition: "Good",
    conditionScore: 7,
    price: 0,
    currentBid: 12999,
    location: "Kolkata",
    distanceKm: 20,
    seller: "GameKart",
    sellerVerified: true,
    sellerRating: 4.4,
    specifications: {
      brand: "NVIDIA",
      model: "GTX 1650",
      memory: "4GB GDDR5",
      interface: "PCIe 3.0",
      power: "75W"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/GeForce_GTX_1080_Ti.jpg/320px-GeForce_GTX_1080_Ti.jpg"],
    bids: [
      { bidder: "RaviG", amount: 11900, time: "2026-08-08T06:50:00Z", isMine: false },
      { bidder: "You", amount: 12999, time: "2026-08-08T09:25:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 3).toISOString()
  },
  {
    id: "m-008",
    title: "HP Pavilion 15 Laptop Battery",
    category: "battery",
    type: "component",
    saleType: "fixed",
    condition: "Excellent",
    conditionScore: 9,
    price: 1499,
    currentBid: null,
    location: "Ahmedabad",
    distanceKm: 14,
    seller: "BatteryHub",
    sellerVerified: true,
    sellerRating: 4.8,
    specifications: {
      compatibleWith: "HP Pavilion 15",
      capacity: "52Wh",
      cellType: "Li-ion",
      warranty: "6 months"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Li-Ion-18650.jpg/240px-Li-Ion-18650.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-009",
    title: "ASUS TUF B450-Plus Gaming Motherboard",
    category: "motherboard",
    type: "component",
    saleType: "fixed",
    condition: "Very Good",
    conditionScore: 8,
    price: 7499,
    currentBid: null,
    location: "Jaipur",
    distanceKm: 27,
    seller: "BoardBarn",
    sellerVerified: false,
    sellerRating: 4.0,
    specifications: {
      brand: "ASUS",
      chipset: "AMD B450",
      socket: "AM4",
      formFactor: "ATX",
      memorySupport: "DDR4 4400MHz"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/PCB_design_and_realisation_smt_and_through_hole.jpg/320px-PCB_design_and_realisation_smt_and_through_hole.jpg"],
    bids: [],
    auctionEndTime: null
  },
  {
    id: "m-010",
    title: "Samsung 970 EVO Plus 500GB SSD",
    category: "SSD",
    type: "component",
    saleType: "auction",
    condition: "Excellent",
    conditionScore: 9,
    price: 0,
    currentBid: 4499,
    location: "Lucknow",
    distanceKm: 21,
    seller: "SSDZone",
    sellerVerified: true,
    sellerRating: 4.7,
    specifications: {
      brand: "Samsung",
      model: "970 EVO Plus",
      capacity: "500GB",
      interface: "NVMe PCIe 3.0",
      formFactor: "M.2 2280"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/M.2_Solid-State_Drive.jpg/320px-M.2_Solid-State_Drive.jpg"],
    bids: [
      { bidder: "PriyaA", amount: 4200, time: "2026-08-08T07:30:00Z", isMine: false },
      { bidder: "You", amount: 4499, time: "2026-08-08T08:50:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString()
  },
  {
    id: "m-011",
    title: "Redmi Note 10 Pro 64GB",
    category: "phone",
    type: "whole",
    saleType: "auction",
    condition: "Good",
    conditionScore: 7,
    price: 0,
    currentBid: 11999,
    location: "Gurgaon",
    distanceKm: 19,
    seller: "ValuePhones",
    sellerVerified: false,
    sellerRating: 4.3,
    specifications: {
      brand: "Xiaomi",
      model: "Redmi Note 10 Pro",
      storage: "64GB",
      ram: "6GB",
      battery: "5020mAh"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg/250px-Samsung_Galaxy_S20_5G_-_Cosmic_Grey_%28white_background%29.jpg"],
    bids: [
      { bidder: "SonaK", amount: 10800, time: "2026-08-08T07:20:00Z", isMine: false },
      { bidder: "You", amount: 11999, time: "2026-08-08T09:10:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString()
  },
  {
    id: "m-012",
    title: "Lenovo ThinkPad T14 Gen 1",
    category: "laptop",
    type: "whole",
    saleType: "auction",
    condition: "Very Good",
    conditionScore: 8,
    price: 0,
    currentBid: 29999,
    location: "Kochi",
    distanceKm: 31,
    seller: "OfficeResale",
    sellerVerified: true,
    sellerRating: 4.6,
    specifications: {
      brand: "Lenovo",
      model: "ThinkPad T14 Gen 1",
      processor: "Intel Core i5 10th Gen",
      ram: "16GB",
      storage: "512GB SSD"
    },
    images: ["https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Dell_Latitude_7490_notebook_computer.jpg/320px-Dell_Latitude_7490_notebook_computer.jpg"],
    bids: [
      { bidder: "SnehaR", amount: 27500, time: "2026-08-08T08:00:00Z", isMine: false },
      { bidder: "You", amount: 29999, time: "2026-08-08T09:30:00Z", isMine: true }
    ],
    auctionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString()
  }
];

export const auctions = marketplaceListings
  .filter((listing) => listing.saleType === "auction")
  .map((listing) => {
    const endTime = new Date(listing.auctionEndTime);
    const now = Date.now();
    const startTime =
      endTime.getTime() - 1000 * 60 * 60 * 6 > now
        ? new Date(now + 1000 * 60 * 60).toISOString()
        : new Date(Math.max(now - 1000 * 60 * 60 * 3, endTime.getTime() - 1000 * 60 * 60 * 12)).toISOString();

    return {
      id: listing.id,
      title: listing.title,
      image: listing.images[0] || null,
      currentBid: listing.currentBid,
      bidsCount: listing.bids.length,
      condition: listing.condition,
      conditionScore: listing.conditionScore * 10,
      location: listing.location,
      seller: { name: listing.seller, verified: listing.sellerVerified },
      startTime,
      endTime: listing.auctionEndTime,
      myBid: listing.bids.some((bid) => bid.isMine)
    };
  });
