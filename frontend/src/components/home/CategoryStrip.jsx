import {
  ArrowRight,
  BatteryCharging,
  Cpu,
  Gamepad2,
  Laptop2,
  Refrigerator,
  Smartphone,
  Tv,
} from "lucide-react";

const categories = [
  { id: "phones", label: "Phones", icon: Smartphone },
  { id: "laptops", label: "Laptops", icon: Laptop2 },
  { id: "pc-components", label: "PC Components", icon: Cpu },
  { id: "batteries", label: "Batteries", icon: BatteryCharging },
  { id: "tvs", label: "TVs", icon: Tv },
  { id: "appliances", label: "Appliances", icon: Refrigerator },
  { id: "gaming", label: "Gaming", icon: Gamepad2 },
];

export default function CategoryStrip({ onSelect }) {
  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-section-head">
        <p className="home-v2-eyebrow">Popular categories</p>
        <h2>Browse what people bring back into circulation.</h2>
      </div>

      <div className="home-v2-category-strip">
        {categories.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="home-v2-category-chip" onClick={() => onSelect(id)}>
            <span className="home-v2-category-chip__icon">
              <Icon size={20} />
            </span>
            <span className="home-v2-category-chip__label">{label}</span>
            <span className="home-v2-category-chip__link">
              View listings <ArrowRight size={13} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
