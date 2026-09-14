import { Smartphone, Laptop2, Box } from "lucide-react";
import Card from "../ui/Card";

function resolveIcon(product) {
  const value = String(product || "").toLowerCase();
  if (value.includes("iphone") || value.includes("phone") || value.includes("redmi")) return Smartphone;
  if (value.includes("laptop") || value.includes("inspiron") || value.includes("ideapad") || value.includes("macbook")) return Laptop2;
  return Box;
}

export default function ListingCard({ product, askingPrice, views, offers, status }) {
  const Icon = resolveIcon(product);

  return (
    <Card className="listing-card" hoverable>
      <div className="listing-card__top">
        <div className="listing-card__identity">
          <div className="listing-card__icon">
            <Icon size={18} />
          </div>
          <h4>{product}</h4>
        </div>
        <span className={`listing-card__status listing-card__status--${status.toLowerCase().replace(/\s+/g, "-")}`}>
          {status}
        </span>
      </div>
      <div className="listing-card__body">
        <div>
          <span className="eyebrow">Asking price</span>
          <strong>{askingPrice}</strong>
        </div>
        <div>
          <span className="eyebrow">Views</span>
          <strong>{views}</strong>
        </div>
        <div>
          <span className="eyebrow">Offers</span>
          <strong>{offers}</strong>
        </div>
      </div>
    </Card>
  );
}
