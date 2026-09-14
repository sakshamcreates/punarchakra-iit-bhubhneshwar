import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, MapPin, Star } from "lucide-react";
import Button from "../components/ui/Button";
import ListingImage from "../components/marketplace/ListingImage";
import { marketplaceListings as fallbackListings } from "../data/mockData";
import { formatCurrency } from "../utils/formatters";
import { getListing } from "../services/listingService";

const sellerMemberSince = {
  MumbaiMobiles: "2021",
  PhoneBazaar: "2020",
  CampusComputers: "2019",
  AppleCertified: "2022",
  StorageMart: "2018",
  RAMWorld: "2023",
  GameKart: "2021",
  BatteryHub: "2019",
  BoardBarn: "2017",
  SSDZone: "2022",
  ValuePhones: "2020",
  OfficeResale: "2016"
};

const relatedPartsMap = {
  laptop: ["16GB DDR4 RAM", "512GB SSD", "Replacement Battery", "65W Charger"],
  phone: ["Fast Charger", "Tempered Glass", "Protective Case", "Power Bank"],
  component: ["Thermal Paste", "Screwdriver Set", "USB-C Adapter", "Maintenance Kit"],
  battery: ["Replacement Charger", "Battery Health Checker", "Power Savings Cable", "Protective Case"],
  default: ["16GB DDR4 RAM", "512GB SSD", "Replacement Battery", "65W Charger"]
};

function formatDuration(milliseconds) {
  if (milliseconds <= 0) return "00:00:00";
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getConditionLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  return "Needs review";
}

function deriveDescription(listing) {
  if (listing.description) return listing.description;

  const { brand, model, processor, storage, ram, capacity, compatibleWith } = listing.specifications || {};
  if (listing.type === "whole") {
    return `${brand ?? listing.title} ${model ?? "device"} in ${listing.condition.toLowerCase()} condition, ready for immediate use and local pickup from ${listing.location}.`; 
  }
  if (listing.type === "component") {
    return `${listing.title} is a reliable ${brand ?? "component"} with ${capacity ?? storage ?? "strong"} performance, suitable for upgrades and repairs.`;
  }

  return `A well-maintained listing from ${listing.seller} with detailed specifications and a condition score to help you choose the right product.`;
}

export default function MarketplaceListingPage() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadListing() {
      setLoading(true);
      setError(null);
      try {
        const data = await getListing(id);
        if (isMounted) {
          setListing(data);
          setSelectedImage(data?.images?.[0] || "");
        }
      } catch (err) {
        if (import.meta.env.VITE_ENABLE_API_FALLBACK !== "false" && isMounted) {
          const fallback = fallbackListings.find((item) => item.id === id) || null;
          setListing(fallback);
          setSelectedImage(fallback?.images?.[0] || "");
        } else if (isMounted) {
          setError(err.message || "Unable to load this listing.");
          setListing(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (id) {
      loadListing();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const sellerListings = useMemo(
    () => fallbackListings.filter((item) => item.seller === listing?.seller).length,
    [listing]
  );

  const relatedParts = useMemo(
    () => relatedPartsMap[listing?.category] || relatedPartsMap.default,
    [listing]
  );

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerError, setOfferError] = useState("");
  const [offerSent, setOfferSent] = useState(false);

  const rawOfferValue = Number(offerAmount.replace(/,/g, ""));

  const openOfferModal = () => {
    setOfferError("");
    setOfferSent(false);
    setIsOfferModalOpen(true);
  };

  const closeOfferModal = () => {
    setIsOfferModalOpen(false);
  };

  const handleOfferChange = (event) => {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    setOfferAmount(digits ? Number(digits).toLocaleString("en-IN") : "");
  };

  const selectQuickOffer = (percent) => {
    const value = Math.floor((listing.price * percent) / 100);
    setOfferAmount(value.toLocaleString("en-IN"));
    setOfferError("");
  };

  const submitOffer = (event) => {
    event.preventDefault();
    const amount = rawOfferValue;
    if (!amount || amount <= 0) {
      setOfferError("Offer cannot be ₹0.");
      return;
    }
    if (amount > listing.price) {
      setOfferError("Offer cannot exceed listing price.");
      return;
    }
    setOfferError("");
    setOfferSent(true);
  };

  if (loading) {
    return (
      <main className="container section">
        <div className="page-intro">
          <div className="eyebrow">Marketplace</div>
          <h1>Loading listing…</h1>
          <p>Fetching the listing details from the connected backend.</p>
        </div>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="container section">
        <div className="page-intro">
          <div className="eyebrow">Marketplace</div>
          <h1>Listing not found</h1>
          <p>{error || "The listing you are looking for does not exist or may have been removed."}</p>
          <Button as={Link} variant="secondary" to="/marketplace">
            <ArrowLeft size={16} /> Back to marketplace
          </Button>
        </div>
      </main>
    );
  }

  const mainImage = selectedImage || listing.images[0];
  const conditionScore = Math.min(100, Math.max(60, listing.conditionScore * 10 + 4));
  const conditionLabel = getConditionLabel(conditionScore);
  const aiMetrics = [
    { label: "Exterior", value: Math.min(100, Math.max(62, conditionScore - 6)) },
    { label: "Functionality", value: Math.min(100, Math.max(72, conditionScore + 8)) },
    { label: "Battery", value: Math.min(100, Math.max(58, conditionScore - 14)) },
    { label: "Components", value: Math.min(100, Math.max(70, conditionScore + 2)) }
  ];

  const auctionEndTime = listing.auctionEndTime ? new Date(listing.auctionEndTime).getTime() : null;
  const timeRemaining = auctionEndTime ? formatDuration(auctionEndTime - Date.now()) : null;
  const priceLabel = listing.saleType === "fixed" ? formatCurrency(listing.price) : formatCurrency(listing.currentBid || 0);

  return (
    <main className="container section listing-v2">
      <Button as={Link} variant="secondary" to="/marketplace" className="listing-v2__back">
        <ArrowLeft size={16} /> Back to marketplace
      </Button>

      {/* Row 1 — everything needed for a decision, above the fold: gallery
          on the left, WHAT / PRICE / CONDITION / LOCATION / ACTION on the right. */}
      <div className="listing-v2__top">
        <section className="listing-v2__gallery">
          <div className="listing-v2__gallery-main">
            <ListingImage
              src={mainImage}
              alt={listing.title}
              category={listing.category}
              className="listing-v2__gallery-image"
              iconSize={56}
            />
          </div>
          {listing.images.length > 1 ? (
            <div className="listing-v2__thumbs">
              {listing.images.map((image, index) => (
                <button
                  key={image + index}
                  type="button"
                  className={`listing-v2__thumb ${mainImage === image ? "is-active" : ""}`}
                  onClick={() => setSelectedImage(image)}
                  aria-label={`Show photo ${index + 1}`}
                >
                  <ListingImage src={image} alt={`${listing.title} ${index + 1}`} category={listing.category} iconSize={20} />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="listing-v2__buybox">
          <div className="listing-v2__tags">
            <span className={`marketplace-badge marketplace-badge--${listing.saleType}`}>
              {listing.saleType === "fixed" ? "Fixed price" : "Auction"}
            </span>
            <span className={`marketplace-badge marketplace-badge--type-${listing.type}`}>
              {listing.type === "whole" ? "Whole device" : "Component"}
            </span>
          </div>

          <h1 className="listing-v2__title">{listing.title}</h1>

          <div className="listing-v2__facts">
            <div className="listing-v2__fact">
              <span>Condition</span>
              <strong>{listing.condition}</strong>
            </div>
            <div className="listing-v2__fact">
              <span>Location</span>
              <strong>
                <MapPin size={14} /> {listing.location} · {listing.distanceKm} km
              </strong>
            </div>
          </div>

          <div className="listing-v2__price">
            <strong>{priceLabel}</strong>
            <span>{listing.saleType === "fixed" ? "Buy now price" : "Current bid"}</span>
          </div>

          {listing.saleType === "fixed" ? (
            <div className="listing-v2__actions">
              <Button variant="primary">Buy now</Button>
              <Button variant="secondary" onClick={openOfferModal}>
                Make offer
              </Button>
            </div>
          ) : (
            <div className="listing-v2__actions listing-v2__actions--auction">
              <div className="listing-v2__auction-row">
                <span>Time remaining</span>
                <strong>{timeRemaining}</strong>
              </div>
              <Button variant="primary">View auction</Button>
            </div>
          )}

          <div className="listing-v2__seller">
            <div>
              <span className="listing-v2__seller-name">
                {listing.seller}
                {listing.sellerVerified ? <CheckCircle2 size={15} /> : null}
              </span>
              <span className="listing-v2__seller-meta">
                Member since {sellerMemberSince[listing.seller] || "2022"} · {sellerListings} listing
                {sellerListings === 1 ? "" : "s"}
              </span>
            </div>
            <span className="listing-v2__seller-rating">
              <Star size={14} fill="currentColor" /> {listing.sellerRating.toFixed(1)}
            </span>
          </div>

          {listing.id ? (
            <Link to={`/agent/${listing.id}`} className="inline-link listing-v2__agent-link">
              Try autonomous resolution for this item →
            </Link>
          ) : null}
        </section>
      </div>

      {/* Row 2 — overview, condition detail, and related parts, in natural
          reading order below the fold. */}
      <div className="listing-v2__detail">
        <section className="card listing-v2__overview">
          <h2>Product overview</h2>
          <p>{deriveDescription(listing)}</p>

          <div className="product-specs">
            <h3>Specifications</h3>
            <dl>
              {Object.entries(listing.specifications || {}).map(([key, value]) => (
                <div key={key} className="product-specs__row">
                  <dt>{key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <article className="card ai-score-card">
          <div className="ai-score-card__header">
            <span className="eyebrow">AI CONDITION SCORE</span>
            <div>
              <strong>{conditionScore} / 100</strong>
              <p>{conditionLabel}</p>
            </div>
          </div>

          <div className="ai-score-card__metrics">
            {aiMetrics.map((metric) => (
              <div key={metric.label} className="ai-score-card__metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>

          <p className="ai-score-card__note">
            Based on seller photos and condition assessment answers. This score is an estimate and not a guarantee.
          </p>
        </article>
      </div>

      <section className="card related-parts listing-v2__related">
        <div className="section-header">
          <h2>Related parts</h2>
          <p>Compact accessories and upgrades that pair well with this listing.</p>
        </div>
        <div className="related-parts__grid">
          {relatedParts.map((part) => (
            <div key={part} className="related-part-card">
              <strong>{part}</strong>
            </div>
          ))}
        </div>
      </section>

      {isOfferModalOpen && (
        <div className="offer-modal-backdrop" role="dialog" aria-modal="true">
          <div className="offer-modal">
            <div className="offer-modal__header">
              <div>
                <p className="eyebrow">Make offer</p>
                <h2>Submit your bid</h2>
              </div>
              <button className="offer-modal__close" type="button" onClick={closeOfferModal}>
                Close
              </button>
            </div>

            <form className="offer-modal__form" onSubmit={submitOffer}>
              <div className="offer-modal__row">
                <label>Listing Price</label>
                <p className="offer-modal__listing-price">{formatCurrency(listing.price)}</p>
              </div>

              <div className="offer-modal__row">
                <label htmlFor="offer-amount">Your Offer</label>
                <input
                  id="offer-amount"
                  type="text"
                  inputMode="numeric"
                  value={offerAmount}
                  onChange={handleOfferChange}
                  placeholder="₹________"
                />
              </div>

              <div className="offer-modal__quick-options">
                {[95, 90, 85].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    className="btn btn-secondary btn-quick"
                    onClick={() => selectQuickOffer(percent)}
                  >
                    {percent}%
                  </button>
                ))}
              </div>

              <div className="offer-modal__row">
                <label htmlFor="offer-message">Optional Message</label>
                <textarea
                  id="offer-message"
                  value={offerMessage}
                  onChange={(event) => setOfferMessage(event.target.value)}
                  placeholder="Write a short note to the seller"
                  rows={4}
                />
              </div>

              {offerError && <p className="offer-modal__error">{offerError}</p>}
              {offerSent && <p className="offer-modal__success">Offer sent to seller.</p>}

              <div className="offer-modal__actions">
                <Button variant="primary" type="submit">SEND OFFER</Button>
                <Button variant="secondary" type="button" onClick={closeOfferModal}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
