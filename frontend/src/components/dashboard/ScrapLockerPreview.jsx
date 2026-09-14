import { Archive } from "lucide-react";
import Card from "../ui/Card";

export default function ScrapLockerPreview({ currentKg, goalKg, message }) {
  const progress = Math.min((currentKg / goalKg) * 100, 100);

  return (
    <Card className="scrap-locker-card" hoverable>
      <div className="scrap-locker-card__header">
        <div className="scrap-locker-card__title">
          <div className="scrap-locker-card__icon">
            <Archive size={18} />
          </div>
          <div>
            <h3>Scrap Locker preview</h3>
            <p>Add more weight to unlock free pickup.</p>
          </div>
        </div>
        <div className="scrap-locker-card__weight">{currentKg} / {goalKg} kg</div>
      </div>

      <div className="scrap-locker-card__progress">
        <div className="scrap-locker-card__bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p>{message}</p>
      </div>
    </Card>
  );
}
