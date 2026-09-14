import { Link } from "react-router-dom";
import { Heart, MapPin, Star, CheckCircle2 } from "lucide-react";
import Card from "../ui/Card";
import ListingImage from "./ListingImage";
import { formatCurrency } from "../../utils/formatters";

export default function MarketplaceCard({ listing, isFavorite, onToggleFavorite }) {
  const priceLabel =
    listing.saleType === "fixed"
      ? formatCurrency(listing.price)
      : formatCurrency(listing.currentBid || 0);

  return (
    <Card className="marketplace-card" hoverable>
      <div className="marketplace-card__media">
        <Link to={`/marketplace/${listing.id}`} className="marketplace-card__media-link" aria-label={`View ${listing.title}`}>
          <ListingImage
            src={listing.images?.[0]}
            alt={listing.title}
            category={listing.category}
            className="marketplace-card__image"
          />
        </Link>

        <div className="marketplace-card__tags">
          <span className={`marketplace-tag marketplace-tag--${listing.saleType}`}>
            {listing.saleType === "fixed" ? "Fixed price" : "Auction"}
          </span>
        </div>

        <button
          className={`marketplace-card__favorite ${isFavorite ? "is-active" : ""}`}
          type="button"
          aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
          aria-pressed={isFavorite}
          onClick={onToggleFavorite}
        >
          <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="marketplace-card__body">
        <div className="marketplace-card__eyebrow-row">
          <span className="marketplace-card__type">
            {listing.type === "whole" ? "Whole device" : "Component"}
          </span>
          <span className="marketplace-card__condition">{listing.condition}</span>
        </div>

        <h3 className="marketplace-card__title">
          <Link to={`/marketplace/${listing.id}`}>{listing.title}</Link>
        </h3>

        <div className="marketplace-card__location">
          <MapPin size={14} />
          <span>{listing.location}</span>
          <span className="marketplace-card__dot">·</span>
          <span>{listing.distanceKm} km</span>
        </div>

        <div className="marketplace-card__price-row">
          <div className="marketplace-card__price">
            <strong>{priceLabel}</strong>
            <span>{listing.saleType === "fixed" ? "Buy now" : "Current bid"}</span>
          </div>
          <Link to={`/marketplace/${listing.id}`} className="marketplace-card__cta">
            {listing.saleType === "fixed" ? "Buy" : "Bid"}
          </Link>
        </div>

        <div className="marketplace-card__seller">
          <span className="marketplace-card__seller-name">
            {listing.seller}
            {listing.sellerVerified ? <CheckCircle2 size={14} /> : null}
          </span>
          <span className="marketplace-card__seller-rating">
            <Star size={13} fill="currentColor" />
            {listing.sellerRating.toFixed(1)}
          </span>
        </div>
      </div>
    </Card>
  );
}
