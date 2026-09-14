import { useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import SectionHeader from "../ui/SectionHeader";
import { deviceCategories } from "../../data/sellFlowMockData";

export default function UploadStep({ images, onFilesSelected, onRemoveImage, category, onCategoryChange }) {
  const [dragActive, setDragActive] = useState(false);
  const hasImages = images.length > 0;

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length) onFilesSelected(files);
  }

  function handleInputChange(event) {
    const files = Array.from(event.target.files || []);
    if (files.length) onFilesSelected(files);
    event.target.value = "";
  }

  return (
    <div className="sell-v2-panel">
      <SectionHeader
        eyebrow="Step 1 · Upload device"
        title="Show us the device you want to resolve."
        description="Clear photos help the resolution agent understand condition, spec and demand accurately. Front, back, and any damaged area work best."
      />

      <label
        className={`sell-v2-dropzone ${dragActive ? "is-dragging" : ""} ${hasImages ? "has-images" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <input type="file" accept="image/*" multiple hidden onChange={handleInputChange} />

        {!hasImages ? (
          <div className="sell-v2-dropzone__empty">
            <span className="sell-v2-dropzone__icon">
              <UploadCloud size={26} />
            </span>
            <strong>{dragActive ? "Drop photos to add them" : "Drop photos here, or tap to upload"}</strong>
            <p>JPG or PNG · front, back, and any damage or model sticker</p>
          </div>
        ) : (
          <div className="sell-v2-dropzone__add-more">
            <span className="sell-v2-dropzone__icon sell-v2-dropzone__icon--sm">
              <ImagePlus size={18} />
            </span>
            <span>Add another photo</span>
          </div>
        )}
      </label>

      {hasImages && (
        <div className="sell-v2-image-grid">
          {images.map((image) => (
            <div className="sell-v2-image-card" key={image.id}>
              <img src={image.preview} alt={image.name} />
              <button
                type="button"
                className="sell-v2-image-card__remove"
                onClick={() => onRemoveImage(image.id)}
                aria-label={`Remove ${image.name}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sell-v2-field-row">
        <div className="form-field">
          <label htmlFor="sell-category">Device category</label>
          <select id="sell-category" value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            {deviceCategories.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
