const beforeSteps = ["Consumer", "Kabadiwala", "Scrap Dealer", "Recycler", "Manufacturer"];
const afterSteps = ["Upload Device", "AI Understanding", "AI Valuation", "Best Route Selection", "Buyer Matching / Pickup"];

export default function BeforeAfterSection() {
  return (
    <section className="container home-v2-section home-v2-section--tight">
      <div className="home-v2-section-head">
        <p className="home-v2-eyebrow">The difference</p>
        <h2>Before vs After Punarchakra.</h2>
      </div>

      <div className="home-v2-compare">
        <div className="home-v2-compare-col">
          <div className="home-v2-compare-col__label">Before</div>
          <div className="home-v2-compare-flow">
            {beforeSteps.map((step, index) => (
              <span key={step} className="home-v2-compare-flow__item">
                {step}
                {index < beforeSteps.length - 1 && <span className="home-v2-compare-flow__arrow">→</span>}
              </span>
            ))}
          </div>
          <span className="home-v2-compare-tag home-v2-compare-tag--warning">Value lost</span>
        </div>

        <div className="home-v2-compare-col home-v2-compare-col--bright">
          <div className="home-v2-compare-col__label">After Punarchakra</div>
          <div className="home-v2-compare-flow">
            {afterSteps.map((step, index) => (
              <span key={step} className="home-v2-compare-flow__item">
                {step}
                {index < afterSteps.length - 1 && <span className="home-v2-compare-flow__arrow">→</span>}
              </span>
            ))}
          </div>
          <span className="home-v2-compare-tag home-v2-compare-tag--positive">Coordinated resolution. Higher value.</span>
        </div>
      </div>
    </section>
  );
}
