import { useState } from "react";
import {
  Smartphone,
  Laptop2,
  Cpu,
  BatteryCharging,
  Gamepad2,
  Refrigerator,
  MemoryStick,
  HardDrive,
  CircuitBoard,
  Box
} from "lucide-react";

// Existing listing data ships with dead `via.placeholder.com` URLs (that
// service has been shut down), which is what produced the broken-image
// icons / alt text on the live marketplace. Rather than fetch a real photo
// (out of scope — no image assets exist in this repo) we render an
// intentional category tile using the same icon language as the finalized
// homepage's MarketplacePreview cards, so the image area never looks broken.
const CATEGORY_ICON = {
  phone: Smartphone,
  laptop: Laptop2,
  component: Cpu,
  pccomponent: Cpu,
  "pc-components": Cpu,
  ram: MemoryStick,
  ssd: HardDrive,
  storage: HardDrive,
  gpu: Cpu,
  motherboard: CircuitBoard,
  battery: BatteryCharging,
  gaming: Gamepad2,
  appliance: Refrigerator,
  tv: Refrigerator
};

function resolveIcon(category) {
  const key = String(category || "").toLowerCase();
  return CATEGORY_ICON[key] || Box;
}

function isUsableSrc(src) {
  if (!src || typeof src !== "string") return false;
  if (src.includes("via.placeholder.com")) return false;
  return true;
}

export default function ListingImage({ src, alt, category, className = "", iconSize = 34 }) {
  const [failed, setFailed] = useState(false);
  const Icon = resolveIcon(category);
  const showFallback = failed || !isUsableSrc(src);

  const classes = ["listing-media"];
  if (className) classes.push(className);

  if (showFallback) {
    return (
      <div className={classes.join(" ")} role="img" aria-label={alt}>
        <Icon size={iconSize} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <div className={classes.join(" ")}>
      <img
        src={src}
        alt={alt}
        className="listing-media__img"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
