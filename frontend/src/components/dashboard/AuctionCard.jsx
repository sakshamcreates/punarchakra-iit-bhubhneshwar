import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Button from "../ui/Button";
import { formatCurrency } from "../../utils/formatters";

function formatMs(ms) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / (1000 * 60)) % 60;
  const h = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (d > 0) return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h`;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

export default function AuctionCard({ auction, onPlaceBid }) {
  const navigate = useNavigate();
  const {
    id,
    title,
    currentBid,
    bidsCount,
    condition,
    conditionScore,
    location,
    seller,
    endTime,
    image,
    myBid
  } = auction;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(endTime).getTime() - now;
  const ended = remainingMs <= 0;

  return (
    <Card
      className="auction-card card--hoverable"
      onClick={() => navigate(`/auctions/${id}`)}
      tabIndex={0}
      role="link"
      onKeyDown={(event) => {
        if (event.key === "Enter") navigate(`/auctions/${id}`);
      }}
    >
      <div className="auction-card__media">
        <img src={image} alt={title} className="auction-card__image" />
      </div>

      <div className="auction-card__content">
        <div className="auction-card__head">
          <div className="auction-title">{title}</div>
          <div className="auction-top">
            <Badge variant={ended ? "default" : "live"}>{ended ? "Ended" : remainingMs < 1000 * 60 * 60 ? "Ending Soon" : "Live"}</Badge>
            <div className="auction-condition">{condition}</div>
          </div>
        </div>

        <div className="auction-card__body">
          <div className="auction-info">
            <div className="auction-score">AI Score <strong>{conditionScore}</strong></div>
            <div className="auction-location">{location}</div>
            <div className="auction-seller">
              <div className="seller-name">{seller?.name}</div>
              <div className="seller-verified">{seller?.verified ? "✓ Verified" : "Unverified"}</div>
            </div>
          </div>

          <div className="auction-stats">
            <div className="current-bid">
              <div className="muted">Current Bid</div>
              <div className="auction-price">{formatCurrency(currentBid)}</div>
            </div>

            <div className="bids-count">
              <div className="metric-small">{bidsCount}</div>
              <div className="muted">Bidders</div>
            </div>

            <div className="countdown-wrap">
              <div className="auction-countdown">{formatMs(remainingMs)}</div>
              <div className="muted">{ended ? "Ended" : "Ends in"}</div>
            </div>
          </div>
        </div>

        <div className="auction-card__foot">
          <div className="auction-card__actions">
            {myBid ? (
              <Button variant="success" disabled>
                Bid Placed
                <span className="auction-card__placed-value">{formatCurrency(currentBid)}</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={ended}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!ended) onPlaceBid?.();
                }}
              >
                Place Bid
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
