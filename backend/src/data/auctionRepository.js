const { randomUUID } = require("crypto");
const listingRepository = require("./listingRepository");

const nowMs = Date.now();
const auctions = [
  {
    id: "auction-seed-001",
    listing_id: "listing-seed-phone-002",
    starting_price: 12000,
    current_bid: 15000,
    highest_bidder: "TechBuyer_Delhi",
    start_time: new Date(nowMs - 1000 * 60 * 60 * 2).toISOString(),
    end_time: new Date(nowMs + 1000 * 60 * 60 * 24).toISOString(),
    status: "active",
    bid_history: [
      {
        id: "bid-001",
        bidder: "EcoCircular_Bangalore",
        amount: 13500,
        time: new Date(nowMs - 1000 * 60 * 60).toISOString()
      },
      {
        id: "bid-002",
        bidder: "TechBuyer_Delhi",
        amount: 15000,
        time: new Date(nowMs - 1000 * 60 * 30).toISOString()
      }
    ],
    createdAt: new Date(nowMs - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(nowMs - 1000 * 60 * 30).toISOString()
  }
];

function cloneAuction(auction) {
  return {
    ...auction,
    bid_history: [
      ...(auction.bid_history || [])
    ]
  };
}

function createAuction(data) {
  const now = new Date().toISOString();

  const auction = {
    id: data.id || randomUUID(),
    listing_id: data.listing_id,
    starting_price: Number(data.starting_price),
    current_bid: Number(data.starting_price),
    highest_bidder: null,
    start_time: data.start_time || now,
    end_time: data.end_time,
    status: data.status || "scheduled",
    bid_history: [],
    createdAt: now,
    updatedAt: now
  };

  auctions.push(auction);
  return cloneAuction(auction);
}

function findAuctionById(id) {
  return auctions.find((auction) => auction.id === id) || null;
}

function updateAuction(id, updates) {
  const index = auctions.findIndex((auction) => auction.id === id);

  if (index === -1) {
    return null;
  }

  auctions[index] = {
    ...auctions[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  return cloneAuction(auctions[index]);
}

function addBid(auctionId, bid) {
  const auction = findAuctionById(auctionId);

  if (!auction) {
    return null;
  }

  auction.bid_history.push({
    id: randomUUID(),
    bidder: bid.bidder,
    amount: Number(bid.amount),
    time: new Date().toISOString()
  });

  auction.current_bid = Number(bid.amount);
  auction.highest_bidder = bid.bidder;
  auction.updatedAt = new Date().toISOString();

  return cloneAuction(auction);
}

function getAllAuctions() {
  return auctions.map(cloneAuction);
}

function removeWhere(predicate) {
  let removed = 0;
  for (let index = auctions.length - 1; index >= 0; index -= 1) {
    if (predicate(auctions[index])) {
      auctions.splice(index, 1);
      removed += 1;
    }
  }
  return removed;
}

module.exports = {
  createAuction,
  findAuctionById,
  updateAuction,
  addBid,
  getAllAuctions,
  removeWhere
};
