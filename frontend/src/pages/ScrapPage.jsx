import { ClipboardList, Recycle, Sparkles, Truck } from "lucide-react";
import MyScrapLocker from "../components/scrap/MyScrapLocker";
import { categoryDetails } from "../data/categoryDetails";

const mockData = {
  estimatedValue: "₹1,840",
  storedKg: 6.8,
  thresholdKg: 10,
  contents: [
    { name: "Old Chargers", weight: 1.4 },
    { name: "Cables", weight: 0.8 },
    { name: "Dead Phones", weight: 1.2 },
    { name: "PCBs", weight: 0.6 },
    { name: "Batteries", weight: 2.8 }
  ]
};

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: "Request",
    description: "Add items to your locker or ask for a pickup whenever you're ready."
  },
  {
    icon: Truck,
    title: "Pickup",
    description: "A collector comes to you once your locker is scheduled for collection."
  },
  {
    icon: Sparkles,
    title: "Sort",
    description: "Items are sorted by category and condition to find the best recovery route."
  },
  {
    icon: Recycle,
    title: "Recover",
    description: "Usable parts and materials are recovered responsibly instead of landfilled."
  }
];

export default function ScrapPage() {
  return (
    <main className="container section scrap-page">
      <div className="page-intro">
        <div className="eyebrow">Scrap Pickup</div>
        <h1>Turn unused electronics into responsible recovery.</h1>
        <p className="page-intro__description">
          Bundle small items in your locker, then request a pickup — no drop-off, no guesswork about
          where your e-waste ends up.
        </p>
      </div>

      <section className="scrap-how-it-works" aria-label="How scrap pickup works">
        <ol className="scrap-steps">
          {HOW_IT_WORKS.map(({ icon: Icon, title, description }, index) => (
            <li className="scrap-step" key={title}>
              <div className="scrap-step__index">{String(index + 1).padStart(2, "0")}</div>
              <div className="scrap-step__icon">
                <Icon size={20} />
              </div>
              <div className="scrap-step__title">{title}</div>
              <p className="scrap-step__description">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <MyScrapLocker data={mockData} />

      <section className="scrap-supported">
        <div className="eyebrow">What we collect</div>
        <h2>Any category you'd sell, we can also collect as scrap.</h2>
        <div className="scrap-supported__grid">
          {categoryDetails.map((category) => (
            <div className="scrap-supported__item" key={category.id}>
              <span className="scrap-supported__title">{category.title}</span>
              <span className="scrap-supported__description">{category.description}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
