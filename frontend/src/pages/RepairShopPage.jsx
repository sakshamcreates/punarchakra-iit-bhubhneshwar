import { useEffect, useMemo, useState } from "react";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import SectionHeader from "../components/ui/SectionHeader";
import {
  getAvailableDevices,
  getCompatibleParts,
  postPartRequirement
} from "../services/ecosystemService.js";

const emptyRequirement = {
  device: "Dell Latitude 5420",
  partRequired: "",
  quantity: 1,
  location: ""
};

export default function RepairShopPage() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(emptyRequirement.device);
  const [parts, setParts] = useState([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [requirement, setRequirement] = useState(emptyRequirement);
  const [posting, setPosting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    getAvailableDevices()
      .then((items) => {
        if (!mounted) return;
        setDevices(items);
        if (!items.find((item) => item.label === selectedDevice) && items.length > 0) {
          setSelectedDevice(items[0].label);
          setRequirement((current) => ({ ...current, device: items[0].label }));
        }
      })
      .catch(() => setError("Unable to load devices."));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setLoadingParts(true);
    setError("");
    getCompatibleParts(selectedDevice)
      .then((items) => {
        setParts(items);
      })
      .catch(() => setError("Unable to load compatible parts."))
      .finally(() => setLoadingParts(false));
  }, [selectedDevice]);

  const currentPartOptions = useMemo(
    () => parts.map((part) => ({ value: part.partName, label: part.partName })),
    [parts]
  );

  const handleRequirementChange = (key, value) => {
    setRequirement((current) => ({ ...current, [key]: value }));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setPosting(true);
    setSuccessMessage("");
    try {
      const response = await postPartRequirement(requirement);
      if (response.success) {
        setSuccessMessage(response.message);
        setRequirement((current) => ({ ...emptyRequirement, device: current.device }));
      } else {
        setError("Could not post requirement. Please try again.");
      }
    } catch {
      setError("Could not post requirement. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <main className="container section ecosystem-page">
      <div className="page-intro">
        <SectionHeader
          eyebrow="Repair Shop"
          title="Need a Part?"
          description="Find compatible replacement parts and post requirements to the Punarchakra ecosystem."
        />
      </div>

      <Card className="ecosystem-card ecosystem-card--top">
        <div className="form-field">
          <label htmlFor="repair-device">Device</label>
          <select
            id="repair-device"
            value={selectedDevice}
            onChange={(event) => {
              setSelectedDevice(event.target.value);
              handleRequirementChange("device", event.target.value);
            }}
          >
            {devices.map((device) => (
              <option key={device.id} value={device.label}>
                {device.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ecosystem-actions">
          <Button variant="primary" onClick={() => setFormOpen(true)}>
            POST REQUIREMENT
          </Button>
        </div>
      </Card>

      <SectionHeader
        title="AI Compatible Parts"
        description="Structured compatibility and inventory estimates for your selected device."
      />

      {loadingParts ? (
        <Card className="ecosystem-loading">Loading compatible parts…</Card>
      ) : error ? (
        <Card className="ecosystem-error">{error}</Card>
      ) : parts.length === 0 ? (
        <Card className="ecosystem-empty">No compatible parts found for this device.</Card>
      ) : (
        <div className="ecosystem-grid">
          {parts.map((part) => (
            <Card key={part.id} className="ecosystem-part-card">
              <div className="part-item-header">
                <div>
                  <strong>{part.partName}</strong>
                  <div className="part-item-subtitle">{part.compatibilityScore}% compatible</div>
                </div>
                <div className="part-item-quantity">{part.availableQuantity} available</div>
              </div>
              <div className="part-item-footer">Estimated price: {part.estimatedPriceRange}</div>
            </Card>
          ))}
        </div>
      )}

      {formOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Post Part Requirement</h3>
              <button className="modal-close" type="button" onClick={() => setFormOpen(false)}>
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={handleFormSubmit}>
              <div className="form-field">
                <label htmlFor="requirement-device">Device</label>
                <input
                  id="requirement-device"
                  value={requirement.device}
                  onChange={(event) => handleRequirementChange("device", event.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="requirement-part">Part Required</label>
                <select
                  id="requirement-part"
                  value={requirement.partRequired}
                  onChange={(event) => handleRequirementChange("partRequired", event.target.value)}
                >
                  <option value="">Select a part</option>
                  {currentPartOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="requirement-quantity">Quantity</label>
                <input
                  id="requirement-quantity"
                  type="number"
                  min="1"
                  value={requirement.quantity}
                  onChange={(event) => handleRequirementChange("quantity", Number(event.target.value))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="requirement-location">Location</label>
                <input
                  id="requirement-location"
                  value={requirement.location}
                  onChange={(event) => handleRequirementChange("location", event.target.value)}
                />
              </div>
              {successMessage ? <div className="success-banner">{successMessage}</div> : null}
              {error ? <div className="error-banner">{error}</div> : null}
              <div className="modal-actions">
                <Button variant="secondary" type="button" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={posting || !requirement.partRequired || !requirement.location}>
                  {posting ? "Posting…" : "Submit Requirement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
