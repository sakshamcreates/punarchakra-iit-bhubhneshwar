const auctionRepository =
  require("../data/auctionRepository");


function getAuctionStatus(
  auction
) {
  const now =
    Date.now();

  const start =
    new Date(
      auction.start_time
    ).getTime();

  const end =
    new Date(
      auction.end_time
    ).getTime();


  if (now < start) {
    return "scheduled";
  }


  if (now >= end) {
    return "ended";
  }


  return "live";
}


function refreshAuctionStatus(
  auction
) {
  if (!auction) {
    return null;
  }

  const status =
    getAuctionStatus(
      auction
    );


  if (
    auction.status !== status
  ) {
    return auctionRepository
      .updateAuction(
        auction.id,
        { status }
      );
  }


  return {
    ...auction,

    bid_history: [
      ...(auction.bid_history ||
        [])
    ]
  };
}


function createAuction(data) {
  if (!data.listing_id) {
    throw new Error(
      "listing_id is required"
    );
  }


  const startingPrice =
    Number(
      data.starting_price
    );


  if (
    !Number.isFinite(
      startingPrice
    ) ||
    startingPrice <= 0
  ) {
    throw new Error(
      "starting_price must be greater than 0"
    );
  }


  if (!data.end_time) {
    throw new Error(
      "end_time is required"
    );
  }


  const startTime =
    data.start_time
      ? new Date(
          data.start_time
        )
      : new Date();


  const endTime =
    new Date(
      data.end_time
    );


  if (
    Number.isNaN(
      startTime.getTime()
    )
  ) {
    throw new Error(
      "Invalid start_time"
    );
  }


  if (
    Number.isNaN(
      endTime.getTime()
    )
  ) {
    throw new Error(
      "Invalid end_time"
    );
  }


  if (
    endTime.getTime() <=
    startTime.getTime()
  ) {
    throw new Error(
      "end_time must be after start_time"
    );
  }


  const now =
    Date.now();


  let status =
    "scheduled";


  if (
    now >=
      startTime.getTime() &&
    now <
      endTime.getTime()
  ) {
    status =
      "live";
  }


  const auction =
    auctionRepository
      .createAuction({
        listing_id:
          data.listing_id,

        starting_price:
          startingPrice,

        start_time:
          startTime
            .toISOString(),

        end_time:
          endTime
            .toISOString(),

        status
      });


  return auction;
}


function getAuction(id) {
  const auction =
    auctionRepository
      .findAuctionById(id);


  if (!auction) {
    const error =
      new Error(
        "Auction not found"
      );

    error.statusCode =
      404;

    throw error;
  }


  return refreshAuctionStatus(
    auction
  );
}


function placeBid(
  auctionId,
  {
    amount,
    bidder
  }
) {
  let auction =
    auctionRepository
      .findAuctionById(
        auctionId
      );


  if (!auction) {
    const error =
      new Error(
        "Auction not found"
      );

    error.statusCode =
      404;

    throw error;
  }


  auction =
    refreshAuctionStatus(
      auction
    );


  if (
    auction.status ===
    "scheduled"
  ) {
    const error =
      new Error(
        "Auction has not started yet"
      );

    error.statusCode =
      400;

    throw error;
  }


  if (
    auction.status ===
    "ended"
  ) {
    const error =
      new Error(
        "Auction has ended"
      );

    error.statusCode =
      400;

    throw error;
  }


  const bidAmount =
    Number(amount);


  if (
    !Number.isFinite(
      bidAmount
    ) ||
    bidAmount <= 0
  ) {
    const error =
      new Error(
        "Bid amount must be greater than 0"
      );

    error.statusCode =
      400;

    throw error;
  }


  if (!bidder) {
    const error =
      new Error(
        "bidder is required"
      );

    error.statusCode =
      400;

    throw error;
  }


  /*
   * A new bid must be strictly
   * greater than the current bid.
   */

  if (
    bidAmount <=
    Number(
      auction.current_bid
    )
  ) {
    const error =
      new Error(
        `Bid must be greater than current bid of ₹${auction.current_bid}`
      );

    error.statusCode =
      400;

    throw error;
  }


  return auctionRepository
    .addBid(
      auctionId,
      {
        amount:
          bidAmount,

        bidder
      }
    );
}

function getAllAuctions() {
  const auctions =
    auctionRepository.getAllAuctions();

  return auctions.map(
    (auction) =>
      refreshAuctionStatus(
        auction
      )
  );
}
module.exports = {
  createAuction,
  getAuction,
  getAllAuctions,
  placeBid
};