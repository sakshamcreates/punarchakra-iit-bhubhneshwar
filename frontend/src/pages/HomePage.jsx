import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Button from "../components/ui/Button";
import HeroDeviceVisual from "../components/home/HeroDeviceVisual";
import AutonomousResolutionFlow from "../components/home/AutonomousResolutionFlow";
import WhyDifferentSection from "../components/home/WhyDifferentSection";
import BeforeAfterSection from "../components/home/BeforeAfterSection";
import CategoryStrip from "../components/home/CategoryStrip";
import MarketplacePreview from "../components/home/MarketplacePreview";
import ImpactSection from "../components/home/ImpactSection";
import FinalCtaSection from "../components/home/FinalCtaSection";
import { categoryDetails } from "../data/categoryDetails";

export default function HomePage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const selectedCategory = selectedCategoryId
    ? categoryDetails.find((category) => category.id === selectedCategoryId)
    : null;

  useEffect(() => {
    if (!selectedCategoryId) {
      document.body.style.overflow = "";
      return undefined;
    }

    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedCategoryId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = priorOverflow;
    };
  }, [selectedCategoryId]);

  const closeDrawer = () => setSelectedCategoryId(null);

  return (
    <div className="home-v2">
      <section className="container home-v2-hero">
        <div className="home-v2-hero-copy">
          <p className="home-v2-eyebrow">Autonomous resolution agent</p>
          <h1>
            Your old electronics
            <br />
            still have a future.
          </h1>
          <p className="home-v2-hero-lede">
            Punarchakra inspects each device, evaluates every possible outcome, checks what's actually
            possible, decides on the best route, executes it, verifies the result — and replans if something
            doesn't hold up.
          </p>
          <div className="home-v2-hero-actions">
            <Button as={Link} variant="primary" to="/sell" icon={<ArrowRight size={18} />} iconPosition="right">
              Resolve my device
            </Button>
            <Button as={Link} variant="secondary" to="/marketplace">
              Explore marketplace
            </Button>
          </div>
        </div>

        <div className="home-v2-hero-visual">
          <HeroDeviceVisual />
        </div>
      </section>

      <AutonomousResolutionFlow />

      <WhyDifferentSection />

      <BeforeAfterSection />

      <CategoryStrip onSelect={setSelectedCategoryId} />

      <MarketplacePreview />

      <ImpactSection />

      <FinalCtaSection />

      {selectedCategory && (
        <div
          className="category-drawer-backdrop"
          onClick={closeDrawer}
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-drawer-title"
          aria-describedby="category-drawer-desc"
        >
          <div className="category-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="category-drawer__header">
              <div className="category-drawer__title">
                <div className="category-drawer__image" aria-hidden="true">
                  {selectedCategory.title.charAt(0)}
                </div>
                <div>
                  <p className="eyebrow">Popular category</p>
                  <h2 id="category-drawer-title">{selectedCategory.title}</h2>
                </div>
              </div>
              <button
                type="button"
                className="category-drawer__close"
                onClick={closeDrawer}
                aria-label="Close category details"
              >
                ×
              </button>
            </div>

            <div className="category-drawer__content" id="category-drawer-desc">
              <p className="drawer-description">{selectedCategory.description}</p>

              <div className="drawer-section">
                <h3>Popular items</h3>
                <ul>
                  {selectedCategory.popularItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="drawer-section">
                <h3>What you can sell</h3>
                <ul>
                  {selectedCategory.acceptedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="drawer-section drawer-grid">
                <div>
                  <h4>Typical value</h4>
                  <p>{selectedCategory.estimatedValueRange}</p>
                </div>
                <div>
                  <h4>Tip</h4>
                  <p>{selectedCategory.tip}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
