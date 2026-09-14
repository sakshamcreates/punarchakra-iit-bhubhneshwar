import {
  useEffect,
  useMemo,
  useState
} from "react";

import SectionHeader from "../components/ui/SectionHeader";
import AuctionCard from "../components/dashboard/AuctionCard";

import {
  formatCurrency
} from "../utils/formatters";

import {
  getAuctions,
  placeAuctionBid
} from "../services/auctionService";

import {
  getListing
} from "../services/listingService";

import {
  useAuth
} from "../contexts/AuthContext";


const TABS = [
  "Live",
  "Ending Soon",
  "Upcoming",
  "My Bids"
];


function statusOf(
  auction,
  now
) {
  const start =
    new Date(
      auction.startTime
    ).getTime();

  const end =
    new Date(
      auction.endTime
    ).getTime();

  if (now < start) {
    return "upcoming";
  }

  if (now >= end) {
    return "ended";
  }

  return "live";
}


function isEndingSoon(
  auction,
  now
) {
  return (
    statusOf(
      auction,
      now
    ) === "live" &&
    new Date(
      auction.endTime
    ).getTime() -
      now <=
      1000 * 60 * 60 * 4
  );
}


function formatMs(ms) {
  if (ms <= 0) {
    return "Ended";
  }

  const seconds =
    Math.floor(
      ms / 1000
    ) % 60;

  const minutes =
    Math.floor(
      ms /
        (1000 * 60)
    ) % 60;

  const hours =
    Math.floor(
      ms /
        (1000 * 60 * 60)
    ) % 24;

  const days =
    Math.floor(
      ms /
        (1000 * 60 * 60 * 24)
    );

  if (days > 0) {
    return `${String(days).padStart(
      2,
      "0"
    )}d ${String(hours).padStart(
      2,
      "0"
    )}h`;
  }

  return `${String(hours).padStart(
    2,
    "0"
  )}h ${String(minutes).padStart(
    2,
    "0"
  )}m ${String(seconds).padStart(
    2,
    "0"
  )}s`;
}


async function normalizeAuction(
  auction,
  currentUser
) {
  let listing = null;

  try {
    listing =
      await getListing(
        auction.listing_id
      );
  } catch {
    listing = null;
  }

  const bidHistory =
    Array.isArray(
      auction.bid_history
    )
      ? auction.bid_history
      : [];

  const myIdentifier =
    currentUser?.id ||
    currentUser?.email ||
    null;

  return {
    id:
      auction.id,

    listingId:
      auction.listing_id,

    title:
      listing?.title ||
      listing?.model ||
      `Auction ${auction.id.slice(
        0,
        8
      )}`,

    image:
      listing?.images?.[0] ||
      null,

    currentBid:
      Number(
        auction.current_bid ||
        auction.starting_price ||
        0
      ),

    bidsCount:
      bidHistory.length,

    condition:
      listing?.condition ||
      "Used",

    conditionScore:
      listing?.conditionScore ||
      7,

    location:
      listing?.location ||
      "Delhi",

    seller: {
      name:
        listing?.seller ||
        "Punarchakra Seller",

      verified: true
    },

    startTime:
      auction.start_time,

    endTime:
      auction.end_time,

    backendStatus:
      auction.status,

    highestBidder:
      auction.highest_bidder,

    myBid:
      Boolean(
        myIdentifier &&
        bidHistory.some(
          (bid) =>
            bid.bidder ===
            myIdentifier
        )
      )
  };
}


export default function AuctionsPage() {
  const {
    user
  } = useAuth();

  const [
    tab,
    setTab
  ] = useState("Live");

  const [
    now,
    setNow
  ] = useState(
    Date.now()
  );

  const [
    auctions,
    setAuctions
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState("");

  const [
    selectedAuctionId,
    setSelectedAuctionId
  ] = useState(null);

  const [
    bidAmount,
    setBidAmount
  ] = useState("");

  const [
    bidSubmitting,
    setBidSubmitting
  ] = useState(false);


  async function loadAuctions(
    silent = false
  ) {
    try {
      if (!silent) {
        setLoading(true);
      }

      const backendAuctions =
        await getAuctions();

      const normalized =
        await Promise.all(
          backendAuctions.map(
            (auction) =>
              normalizeAuction(
                auction,
                user
              )
          )
        );

      setAuctions(
        normalized
      );

      setError("");
    } catch (err) {
      console.error(
        "Unable to load auctions:",
        err
      );

      setError(
        err.message ||
        "Unable to load auctions."
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }


  /*
   * Initial load.
   */
  useEffect(() => {
    loadAuctions();
  }, []);


  /*
   * REST polling instead of WebSockets.
   *
   * Every 5 seconds the auction page
   * refreshes current bids/status.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadAuctions(true);
        },
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);


  /*
   * Existing countdown animation.
   */
  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setNow(
            Date.now()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);


  const selectedAuction =
    auctions.find(
      (auction) =>
        auction.id ===
        selectedAuctionId
    );


  const closeBidDrawer =
    () => {
      setSelectedAuctionId(
        null
      );

      setError("");
    };


  useEffect(() => {
    if (
      selectedAuction
    ) {
      const baseBid =
        Number(
          selectedAuction
            .currentBid ||
          0
        );

      setBidAmount(
        String(
          baseBid + 200
        )
      );
    } else {
      setBidAmount("");
    }
  }, [
    selectedAuction
      ?.currentBid,
    selectedAuctionId
  ]);


  useEffect(() => {
    const handleKeyDown =
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          closeBidDrawer();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, []);


  async function handlePlaceBid() {
    if (
      !selectedAuction
    ) {
      return;
    }

    const amount =
      Number(
        bidAmount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <=
        selectedAuction.currentBid
    ) {
      setError(
        "Bid must be greater than the current bid."
      );

      return;
    }

    setBidSubmitting(
      true
    );

    setError("");

    try {
      await placeAuctionBid(
        selectedAuction.id,
        {
          amount,

          bidder:
            user?.id ||
            user?.email ||
            "demo-user"
        }
      );

      /*
       * Immediately refresh rather
       * than waiting 5 seconds.
       */
      await loadAuctions(
        true
      );

      closeBidDrawer();
    } catch (err) {
      setError(
        err.message ||
        "Unable to place bid."
      );
    } finally {
      setBidSubmitting(
        false
      );
    }
  }


  const openBidDrawer =
    (auctionId) => {
      setSelectedAuctionId(
        auctionId
      );

      setError("");
    };


  const filtered =
    useMemo(() => {
      if (
        tab === "Live"
      ) {
        return auctions.filter(
          (auction) =>
            statusOf(
              auction,
              now
            ) === "live"
        );
      }

      if (
        tab ===
        "Ending Soon"
      ) {
        return auctions.filter(
          (auction) =>
            isEndingSoon(
              auction,
              now
            )
        );
      }

      if (
        tab ===
        "Upcoming"
      ) {
        return auctions.filter(
          (auction) =>
            statusOf(
              auction,
              now
            ) ===
            "upcoming"
        );
      }

      if (
        tab ===
        "My Bids"
      ) {
        return auctions.filter(
          (auction) =>
            auction.myBid
        );
      }

      return auctions;
    }, [
      tab,
      auctions,
      now
    ]);


  return (
    <main className="container section">

      <div className="page-intro">

        <div className="eyebrow">
          Live marketplace
        </div>

        <h1>
          Auctions
        </h1>

        <p>
          Bid on devices and components
          while demand is strongest.
        </p>

      </div>


      <SectionHeader
        title="Open listings"
      />


      <div
        className="tabs"
        role="tablist"
        aria-label="Auction filters"
      >
        {TABS.map(
          (currentTab) => (

            <button
              key={
                currentTab
              }
              className={`tab ${
                currentTab ===
                tab
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setTab(
                  currentTab
                )
              }
              type="button"
              role="tab"
              aria-selected={
                currentTab ===
                tab
              }
            >
              {
                currentTab
              }
            </button>

          )
        )}
      </div>


      {loading ? (
        <div className="empty-state">
          Loading auctions...
        </div>
      ) : null}


      {!loading && error &&
      !selectedAuction ? (
        <div className="empty-state">
          {error}
        </div>
      ) : null}


      {!loading ? (
        <div className="auction-grid">

          {filtered.length ===
          0 ? (

            <div className="empty-state">
              No auctions match
              this filter.
            </div>

          ) : (

            filtered.map(
              (auction) => (

                <AuctionCard
                  key={
                    auction.id
                  }
                  auction={
                    auction
                  }
                  onPlaceBid={() =>
                    openBidDrawer(
                      auction.id
                    )
                  }
                />

              )
            )

          )}

        </div>
      ) : null}


      {selectedAuction ? (

        <div
          className="auction-bid-drawer-backdrop"
          onClick={
            closeBidDrawer
          }
        >

          <section
            className="auction-bid-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auction-bid-drawer-title"
            onClick={
              (event) =>
                event.stopPropagation()
            }
          >

            <div className="auction-bid-drawer__header">

              <div>

                <h2 id="auction-bid-drawer-title">
                  Place your bid
                </h2>

                <p className="drawer-description">
                  Submit a bid for
                  this auction and
                  update your bid
                  activity instantly.
                </p>

              </div>


              <button
                type="button"
                className="auction-bid-drawer__close"
                onClick={
                  closeBidDrawer
                }
                aria-label="Close bid drawer"
              >
                ×
              </button>

            </div>


            <div className="auction-bid-drawer__content">

              <div className="auction-bid-drawer__row">

                <div>

                  <div className="muted">
                    Product
                  </div>

                  <div className="auction-bid-drawer__product-title">
                    {
                      selectedAuction.title
                    }
                  </div>

                </div>


                <div>

                  <div className="muted">
                    Seller
                  </div>

                  <div className="auction-bid-drawer__seller">
                    {
                      selectedAuction
                        .seller
                        .name
                    }
                  </div>

                </div>

              </div>


              <div className="auction-bid-drawer__row">

                <div>

                  <div className="muted">
                    Current Bid
                  </div>

                  <div className="auction-bid-drawer__value">
                    {formatCurrency(
                      selectedAuction.currentBid
                    )}
                  </div>

                </div>


                <div>

                  <div className="muted">
                    Minimum next bid
                  </div>

                  <div className="auction-bid-drawer__value">
                    {formatCurrency(
                      selectedAuction.currentBid +
                      200
                    )}
                  </div>

                </div>

              </div>


              <div className="auction-bid-drawer__row">

                <div>

                  <div className="muted">
                    Ending
                  </div>

                  <div className="auction-bid-drawer__value">
                    {formatMs(
                      new Date(
                        selectedAuction.endTime
                      ).getTime() -
                      now
                    )}
                  </div>

                </div>


                <div>

                  <div className="muted">
                    Status
                  </div>

                  <div className="auction-bid-drawer__value">
                    {statusOf(
                      selectedAuction,
                      now
                    ) === "ended"
                      ? "Ended"
                      : "Open"}
                  </div>

                </div>

              </div>


              <div className="auction-bid-drawer__section">

                <h3>
                  Quick bid options
                </h3>


                <div className="auction-bid-drawer__quick-options">

                  {[200, 500, 1000].map(
                    (step) => {

                      const amount =
                        selectedAuction.currentBid +
                        step;

                      return (

                        <button
                          key={
                            step
                          }
                          type="button"
                          className={`btn btn-quick ${
                            Number(
                              bidAmount
                            ) ===
                            amount
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setBidAmount(
                              String(
                                amount
                              )
                            )
                          }
                        >
                          +₹{step}
                        </button>

                      );
                    }
                  )}

                </div>

              </div>


              <div className="auction-bid-drawer__section">

                <h3>
                  Custom amount
                </h3>

                <input
                  className="auction-bid-drawer__input"
                  type="number"
                  min={
                    selectedAuction.currentBid +
                    200
                  }
                  step="100"
                  value={
                    bidAmount
                  }
                  onChange={
                    (event) =>
                      setBidAmount(
                        event.target.value
                      )
                  }
                  aria-label="Custom bid amount"
                />

              </div>


              <div className="auction-bid-drawer__summary">

                <div className="muted">
                  Your Bid
                </div>

                <div className="auction-bid-drawer__summary-value">
                  {formatCurrency(
                    Number(
                      bidAmount
                    ) ||
                    selectedAuction.currentBid +
                    200
                  )}
                </div>

              </div>


              {error ? (
                <p className="page-intro__description">
                  {error}
                </p>
              ) : null}


              <div className="auction-bid-drawer__actions">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={
                    closeBidDrawer
                  }
                >
                  Cancel
                </button>


                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    bidSubmitting ||
                    statusOf(
                      selectedAuction,
                      now
                    ) !== "live" ||
                    Number(
                      bidAmount
                    ) <
                      selectedAuction.currentBid +
                      200
                  }
                  onClick={
                    handlePlaceBid
                  }
                >

                  {bidSubmitting
                    ? "Placing..."
                    : "Place Bid"}

                </button>

              </div>

            </div>

          </section>

        </div>

      ) : null}

    </main>
  );
}