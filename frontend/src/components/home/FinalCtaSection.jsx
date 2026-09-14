import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Button from "../ui/Button";

export default function FinalCtaSection() {
  return (
    <section className="home-v2-cta-dark">
      <div className="container home-v2-cta-dark__inner">
        <h2>
          Your next device could make
          <br />a bigger impact.
        </h2>
        <p>Resolve your device today and be part of a cleaner, more circular future.</p>
        <div className="home-v2-hero-actions home-v2-hero-actions--center">
          <Button as={Link} variant="primary" to="/sell" icon={<ArrowRight size={18} />} iconPosition="right">
            Resolve my device
          </Button>
          <Button as={Link} variant="secondary" to="/marketplace" className="home-v2-cta-dark__secondary">
            Explore marketplace
          </Button>
        </div>
      </div>
    </section>
  );
}
