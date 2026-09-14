import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Link,
  useParams
} from "react-router-dom";

import {
  ArrowLeft,
  ShieldCheck
} from "lucide-react";

import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

import {
  formatCurrency
} from "../utils/formatters";

import {
  getAuction,
  placeAuctionBid
} from "../services/auctionService";

import {
  getListing
} from "../services/listingService";

import {
  useAuth
} from "../contexts/AuthContext";


function formatDuration(ms) {
  if (ms <= 0) {
    return "00:00:00";
  }

  const totalSeconds =
    Math.floor(
      ms / 1000
    );

  const hours =
    String(
      Math.floor(
        totalSeconds /
        3600
      )
    ).padStart(
      2,
      "0"
    );

  const minutes =
    String(
      Math.floor(
        (
          totalSeconds %
          3600
        ) / 60
      )
    ).padStart(
      2,
      "0"
    );

  const seconds =
    String(
      totalSeconds %
      60
    ).padStart(
      2,
      "0"
    );

  return `${hours}:${minutes}:${seconds}`;
}


function maskBidder(name) {
  if (!name) {
    return "A***";
  }

  const text =
    String(name);

  if (
    text.length === 1
  ) {
    return `${text}***`;
  }

  const first =
    text[0];

  const last =
    text[
      text.length - 1
    ];

  return `${first}***${last}`;
}


export default function AuctionDetailPage() {
  const {
    id
  } = useParams();

  const {
    user
  } = useAuth();

  const [
    auction,
    setAuction
  ] = useState(null);

  const [
    listing,
    setListing
  ] = useState(null);

  const [
    selectedIncrement,
    setSelectedIncrement
  ] = useState(200);

  const [
    timeLeft,
    setTimeLeft
  ] = useState(0);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    bidSubmitting,
    setBidSubmitting
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");


  async function loadAuction(
    silent = false
  ) {
    try {
      if (!silent) {
        setLoading(true);
      }

      const result =
        await getAuction(id);

      setAuction(
        result
      );

      setTimeLeft(
        Math.max(
          0,
          new Date(
            result.end_time
          ).getTime() -
          Date.now()
        )
      );

      if (
        result.listing_id
      ) {
        try {
          const listingResult =
            await getListing(
              result.listing_id
            );

          setListing(
            listingResult
          );
        } catch {
          /*
           * Auction can still work even
           * if listing enrichment fails.
           */
        }
      }

      setError("");
    } catch (err) {
      setError(
        err.message ||
        "Auction not found."
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }


  /*
   * Initial API load.
   */
  useEffect(() => {
    loadAuction();
  }, [id]);


  /*
   * Poll REST API every 5 seconds.
   *
   * No WebSocket required.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadAuction(true);
        },
        5000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [id]);


  /*
   * Smooth local countdown every second.
   */
  useEffect(() => {
    if (
      !auction?.end_time
    ) {
      return undefined;
    }

    const timer =
      window.setInterval(
        () => {
          setTimeLeft(
            Math.max(
              0,
              new Date(
                auction.end_time
              ).getTime() -
              Date.now()
            )
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    auction?.end_time
  ]);


  const currentBid =
    Number(
      auction?.current_bid ||
      auction?.starting_price ||
      0
    );


  const nextBid =
    currentBid +
    selectedIncrement;


  const minimumNextBid =
    currentBid + 200;


  const increments = [
    200,
    500,
    1000
  ];


  const bidHistory =
    useMemo(() => {
      const bids =
        Array.isArray(
          auction?.bid_history
        )
          ? auction.bid_history
          : [];

      return [
        ...bids
      ].sort(
        (a, b) =>
          new Date(
            b.time
          ) -
          new Date(
            a.time
          )
      );
    }, [
      auction?.bid_history
    ]);


  const bidderCount =
    bidHistory.length;


  async function handleBid() {
    if (
      !auction ||
      auction.status !==
        "live" ||
      timeLeft <= 0
    ) {
      setError(
        "This auction is not accepting bids."
      );

      return;
    }

    setBidSubmitting(
      true
    );

    setError("");

    try {
      const updated =
        await placeAuctionBid(
          auction.id,
          {
            amount:
              nextBid,

            bidder:
              user?.id ||
              user?.email ||
              "demo-user"
          }
        );

      /*
       * Immediate UI update from backend
       * response.
       */
      setAuction(
        updated
      );

      setSelectedIncrement(
        200
      );
    } catch (err) {
      setError(
        err.message ||
        "Unable to place bid."
      );

      /*
       * Another bidder may have beaten
       * us between polls.
       *
       * Refresh immediately.
       */
      await loadAuction(
        true
      );
    } finally {
      setBidSubmitting(
        false
      );
    }
  }


  if (loading) {
    return (
      <main className="container section">
        <div className="empty-state">
          Loading auction...
        </div>
      </main>
    );
  }


  if (
    !auction
  ) {
    return (
      <main className="container section">

        <div className="page-intro">

          <div className="eyebrow">
            Auctions
          </div>

          <h1>
            Auction not found
          </h1>

          <p>
            {error ||
              "The auction you are looking for does not exist."}
          </p>

          <Button
            as={Link}
            variant="secondary"
            to="/auctions"
          >
            <ArrowLeft
              size={16}
            />

            Back to auctions
          </Button>

        </div>

      </main>
    );
  }


  const title =
    listing?.title ||
    listing?.model ||
    `Auction ${auction.id.slice(
      0,
      8
    )}`;


  const images =
    Array.isArray(
      listing?.images
    ) &&
    listing.images.length >
      0
      ? listing.images
      : [
          "https://via.placeholder.com/600?text=Punarchakra+Auction"
        ];


  const location =
    listing?.location ||
    "Delhi";


  const condition =
    listing?.condition ||
    "Used";


  const conditionScore =
    listing?.conditionScore ||
    7;


  const seller =
    listing?.seller ||
    "Punarchakra Seller";


  return (
    <main className="container section auction-detail-page">

      <div className="page-intro">

        <div className="eyebrow">
          Auctions
        </div>

        <h1>
          {title}
        </h1>

        <p>
          {location}
          {" • "}
          {condition}
          {" • "}
          AI score{" "}
          {conditionScore}
        </p>

      </div>


      <div className="auction-detail-grid">

        <section className="auction-gallery-column">

          <div className="product-gallery">

            <img
              src={
                images[0]
              }
              alt={
                title
              }
              className="product-gallery__main"
            />


            <div className="product-gallery__thumbnails">

              {images.map(
                (
                  src,
                  index
                ) => (

                  <div
                    key={
                      index
                    }
                    className="product-gallery__thumb"
                  >

                    <img
                      src={
                        src
                      }
                      alt={`${title} ${
                        index + 1
                      }`}
                    />

                  </div>

                )
              )}

            </div>

          </div>


          <div className="card auction-about-card">

            <div className="auction-about-row">

              <div>

                <p className="eyebrow">
                  Seller
                </p>

                <strong>
                  {seller}
                </strong>

              </div>


              <div className="seller-verified">

                <ShieldCheck
                  size={16}
                />

                <span>
                  Verified
                </span>

              </div>

            </div>


            <div className="auction-about-row">

              <div>

                <p className="eyebrow">
                  Location
                </p>

                <strong>
                  {location}
                </strong>

              </div>


              <div className="auction-condition-card">

                <Badge variant="default">
                  {condition}
                </Badge>

              </div>

            </div>

          </div>

        </section>


        <aside className="auction-sidebar">

          <div className="card auction-stats-card">

            <div className="auction-stat">

              <span className="auction-stat__label">
                Current Bid
              </span>

              <strong className="auction-stat__value">
                {formatCurrency(
                  currentBid
                )}
              </strong>

            </div>


            <div className="auction-stat">

              <span className="auction-stat__label">
                Time Remaining
              </span>

              <strong className="auction-stat__value">
                {formatDuration(
                  timeLeft
                )}
              </strong>

            </div>


            <div className="auction-stat">

              <span className="auction-stat__label">
                Number of Bidders
              </span>

              <strong className="auction-stat__value">
                {bidderCount}
              </strong>

            </div>

          </div>


          <div className="card auction-bid-card">

            <div className="auction-bid-card__header">

              <span>
                Minimum Next Bid
              </span>

              <strong>
                {formatCurrency(
                  minimumNextBid
                )}
              </strong>

            </div>


            <div className="increment-selector">

              {increments.map(
                (increment) => (

                  <button
                    key={
                      increment
                    }
                    type="button"
                    className={`btn btn-secondary btn-quick ${
                      selectedIncrement ===
                      increment
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedIncrement(
                        increment
                      )
                    }
                  >
                    +
                    {formatCurrency(
                      increment
                    )}
                  </button>

                )
              )}

            </div>


            {error ? (
              <p className="page-intro__description">
                {error}
              </p>
            ) : null}


            <Button
              className="bid-action-button"
              variant="primary"
              onClick={
                handleBid
              }
              disabled={
                bidSubmitting ||
                auction.status !==
                  "live" ||
                timeLeft <= 0
              }
            >

              {bidSubmitting
                ? "PLACING BID..."
                : `BID ${formatCurrency(
                    nextBid
                  )}`}

            </Button>

          </div>


          <div className="card auction-rules-card">

            <h3>
              Auction Rules
            </h3>

            <ul className="auction-rules">

              <li>
                Minimum increment:
                ₹200
              </li>

              <li>
                Payment window:
                complete payment
                within 24 hours of
                winning
              </li>

              <li>
                Pickup / shipping:
                pickup available
                locally; buyer
                arranges shipping
                costs
              </li>

            </ul>

          </div>

        </aside>

      </div>


      <div className="card bid-history-card">

        <div className="section-header">

          <h2>
            Bid History
          </h2>

          <p>
            Recent bids on this
            auction are shown with
            masked member names.
          </p>

        </div>


        <div className="bid-history-list">

          {bidHistory.length ===
          0 ? (

            <div className="empty-state">
              No bids yet. Be the
              first to bid.
            </div>

          ) : (

            bidHistory.map(
              (bid) => (

                <div
                  key={
                    bid.id ||
                    `${bid.bidder}-${bid.time}`
                  }
                  className="bid-history__row"
                >

                  <span>
                    {maskBidder(
                      bid.bidder
                    )}
                  </span>

                  <span>
                    {formatCurrency(
                      bid.amount
                    )}
                  </span>

                  <span>
                    {new Date(
                      bid.time
                    ).toLocaleTimeString(
                      [],
                      {
                        hour:
                          "2-digit",
                        minute:
                          "2-digit"
                      }
                    )}
                  </span>

                </div>

              )
            )

          )}

        </div>

      </div>


      <div
        style={{
          marginTop: 18
        }}
      >

        <Button
          as={Link}
          variant="secondary"
          to="/auctions"
        >

          <ArrowLeft
            size={16}
          />

          Back to auctions

        </Button>

      </div>

    </main>
  );
}