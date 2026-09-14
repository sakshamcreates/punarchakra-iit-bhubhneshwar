import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Smartphone, Laptop2, Cpu, BatteryCharging, Tv, Refrigerator, Gamepad2, Box } from "lucide-react";
import Button from "../ui/Button";
import { getListings } from "../../services/listingService";

const CATEGORY_ICONS = {
  phone: Smartphone,
  laptop: Laptop2,
  "pc-components": Cpu,
  battery: BatteryCharging,
  tv: Tv,
  appliance: Refrigerator,
  gaming: Gamepad2,
};

function formatPrice(price) {
  if (!price && price !== 0) return null;
  return `₹${Number(price).toLocaleString("en-IN")}`;
}

export default function MarketplacePreview() {
  const [status, setStatus] = useState("loading");
  const [listings, setListings] = useState([]);

  useEffect(() => {
    let cancelled = false;

    getListings()
      .then((data) => {
        if (cancelled) return;
        setListings((data || []).slice(0, 3));
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-section-head home-v2-section-head--split">
        <div>
          <p className="home-v2-eyebrow">Marketplace</p>
          <h2>Recovered devices, ready for a second owner.</h2>
        </div>
        <Button as={Link} variant="secondary" to="/marketplace" icon={<ArrowRight size={16} />} iconPosition="right">
          View all listings
        </Button>
      </div>

      {status === "loading" && (
        <div className="home-v2-listing-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="home-v2-listing-card home-v2-listing-card--skeleton" />
          ))}
        </div>
      )}

      {status === "ready" && listings.length > 0 && (
        <div className="home-v2-listing-grid">
          {listings.map((listing) => {
            const Icon = CATEGORY_ICONS[listing.category] || Box;
            return (
              <Link key={listing.id} to={`/marketplace/${listing.id}`} className="home-v2-listing-card">
                <div className="home-v2-listing-card__media">
                  <Icon size={22} />
                </div>
                <div className="home-v2-listing-card__top">
                  <span className="home-v2-listing-card__condition">{listing.condition}</span>
                  {formatPrice(listing.price) && (
                    <span className="home-v2-listing-card__price">{formatPrice(listing.price)}</span>
                  )}
                </div>
                <h3>{listing.title}</h3>
                <p className="home-v2-listing-card__meta">
                  <MapPin size={14} />
                  {listing.location}
                </p>
              </Link>
            );
          })}
        </div>
      )}

      {status === "ready" && listings.length === 0 && (
        <div className="home-v2-empty-state">
          <p>New listings are being added as devices are inspected and priced.</p>
          <Button as={Link} variant="secondary" to="/marketplace">
            Browse the marketplace
          </Button>
        </div>
      )}

      {status === "unavailable" && (
        <div className="home-v2-empty-state">
          <p>Live listings couldn't be loaded right now.</p>
          <Button as={Link} variant="secondary" to="/marketplace">
            Open the marketplace
          </Button>
        </div>
      )}
    </section>
  );
}
