import Button from "../ui/Button";
import Card from "../ui/Card";

export default function MyScrapLocker({ data }) {
  const { estimatedValue, storedKg, thresholdKg, contents } = data;
  const remaining = Math.max(thresholdKg - storedKg, 0).toFixed(1);
  const progress = Math.min((storedKg / thresholdKg) * 100, 100);

  return (
    <section className="my-scrap-locker">
      <div className="my-scrap-locker__header">
        <div>
          <div className="eyebrow">MY SCRAP LOCKER</div>
          <h2>Keep and bundle small items for smarter pickups</h2>
        </div>
        <div className="my-scrap-locker__metrics">
          <div>
            <div className="metric">{estimatedValue}</div>
            <div className="eyebrow">Estimated value</div>
          </div>
          <div>
            <div className="metric">{storedKg} kg</div>
            <div className="eyebrow">Stored weight</div>
          </div>
          <div>
            <div className="metric">{thresholdKg} kg</div>
            <div className="eyebrow">Free pickup threshold</div>
          </div>
        </div>
      </div>

      <Card className="my-scrap-locker__progresscard">
        <div className="scrap-summary">
          <div className="scrap-summary__left">
            <div className="scrap-weight">{storedKg} / {thresholdKg} KG</div>
            <div className="scrap-sub">Add another <strong>{remaining} kg</strong> to unlock free pickup.</div>
          </div>

          <div className="scrap-summary__right">
            <div className="scrap-bar">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="scrap-actions">
              <Button variant="secondary">Add Scrap</Button>
              <Button variant="primary">Schedule Pickup</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="my-scrap-locker__body grid grid-2">
        <Card>
          <h3>Locker contents</h3>
          <div className="locker-contents">
            {contents.map((c) => (
              <div className="locker-row" key={c.name}>
                <span>{c.name}</span>
                <strong>{c.weight} kg</strong>
              </div>
            ))}
          </div>
        </Card>

        <Card className="why-wait-card">
          <h3>Why wait for {thresholdKg} kg?</h3>
          <ul>
            <li>Bundling reduces collection cost per pickup.</li>
            <li>Higher volumes improve collector economics.</li>
            <li>Bundled pickups can increase your payout and reduce emissions.</li>
          </ul>
          <p className="muted">Designed to help you save on pickup fees and get better returns — not an industrial interface.</p>
        </Card>
      </div>
    </section>
  );
}
