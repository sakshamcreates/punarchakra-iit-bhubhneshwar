import { useEffect, useState } from "react";
import { CircleDashed, ScanSearch, Sparkles } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import Button from "../ui/Button";

const READING_STEPS = ["Reading photos", "Matching known device profiles", "Estimating specification"];

export default function UnderstandingStep({
  status,
  onStartAnalysis,
  device,
  category,
  onDeviceFieldChange,
  error,
}) {
  const [readingIndex, setReadingIndex] = useState(0);

  useEffect(() => {
    if (status !== "processing") return undefined;
    setReadingIndex(0);
    const timers = READING_STEPS.map((_, index) =>
      window.setTimeout(() => setReadingIndex(index + 1), (index + 1) * 480)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [status]);

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 2 · Device understanding"
        title="Let the resolution agent identify your device."
        description="We match your photos against known device profiles to suggest brand, series and likely spec — you can adjust anything before continuing."
      />

      {status === "idle" && (
        <div className="sell-v2-empty">
          <span className="sell-v2-empty__icon">
            <CircleDashed size={22} />
          </span>
          <p>
            {error ? error : "No analysis run yet. Start device understanding to get a suggested match."}
          </p>
          <Button variant="primary" onClick={onStartAnalysis} icon={<Sparkles size={16} />} iconPosition="left">
            {error ? "Try again" : "Analyze device"}
          </Button>
        </div>
      )}

      {status === "processing" && (
        <div className="sell-v2-processing">
          <div className="sell-v2-processing__spinner" aria-hidden="true">
            <ScanSearch size={22} />
          </div>
          <ul className="sell-v2-processing__steps">
            {READING_STEPS.map((label, index) => (
              <li key={label} className={index < readingIndex ? "is-done" : index === readingIndex ? "is-active" : ""}>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status === "done" && (
        <>
          <div className="sell-v2-result-card">
            <div className="sell-v2-result-card__top">
              <div>
                <span className="sell-v2-eyebrow-sm">Suggested match</span>
                <h3>
                  {device.brand} {device.series}
                </h3>
              </div>
              <span className="sell-v2-confidence">{device.confidence}% match confidence</span>
            </div>
            <p className="sell-v2-result-card__meta">
              Category: {device.categoryLabel} · Estimated year: {device.year}
            </p>
          </div>

          <div className="sell-v2-field-row sell-v2-field-row--3">
            <div className="form-field">
              <label htmlFor="device-brand">Brand</label>
              <input id="device-brand" value={device.brand} onChange={(e) => onDeviceFieldChange("brand", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="device-series">Model / series</label>
              <input id="device-series" value={device.series} onChange={(e) => onDeviceFieldChange("series", e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="device-year">Likely year</label>
              <input id="device-year" value={device.year} onChange={(e) => onDeviceFieldChange("year", e.target.value)} />
            </div>
          </div>

          <button type="button" className="sell-v2-relink" onClick={onStartAnalysis}>
            Re-run device understanding
          </button>
        </>
      )}
    </div>
  );
}
