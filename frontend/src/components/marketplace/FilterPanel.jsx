export default function FilterPanel({
  activeFilters,
  toggleFilter,
  setDistanceFilter,
  setPriceValue,
  clearFilters,
  onClose,
  showHeader = true,
  compact = false
}) {
  const categories = [
    { label: "Phones", value: "phone" },
    { label: "Laptops", value: "laptop" },
    { label: "PC Components", value: "component" },
    { label: "Batteries", value: "battery" },
    { label: "Gaming", value: "gaming" },
    { label: "Appliances", value: "appliance" }
  ];

  const conditions = ["Excellent", "Good", "Fair", "For Parts"];
  const distances = [5, 10, 25, 50, null];
  const saleTypes = [
    { label: "Fixed Price", value: "fixed" },
    { label: "Auction", value: "auction" }
  ];
  const listingTypes = [
    { label: "Whole Device", value: "whole" },
    { label: "Components", value: "component" }
  ];

  return (
    <div className={compact ? "marketplace-drawer__body" : ""}>
      {showHeader ? (
        <div className="marketplace-filters__header">
          <h2>Filters</h2>
          <button className="filter-clear-button" type="button" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="marketplace-filter-group">
        <div className="filter-title">Category</div>
        <div className="filter-options">
          {categories.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-chip ${activeFilters.category.includes(item.value) ? "active" : ""}`}
              aria-pressed={activeFilters.category.includes(item.value)}
              onClick={() => toggleFilter("category", item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-filter-group">
        <div className="filter-title">Price</div>
        <div className="price-fields">
          <input
            type="number"
            min="0"
            aria-label="Minimum price"
            placeholder="Min"
            value={activeFilters.priceMin}
            onChange={(event) => setPriceValue("priceMin", event.target.value)}
          />
          <input
            type="number"
            min="0"
            aria-label="Maximum price"
            placeholder="Max"
            value={activeFilters.priceMax}
            onChange={(event) => setPriceValue("priceMax", event.target.value)}
          />
        </div>
      </div>

      <div className="marketplace-filter-group">
        <div className="filter-title">Condition</div>
        <div className="filter-options">
          {conditions.map((option) => (
            <button
              key={option}
              type="button"
              className={`filter-chip ${activeFilters.condition.includes(option) ? "active" : ""}`}
              aria-pressed={activeFilters.condition.includes(option)}
              onClick={() => toggleFilter("condition", option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-filter-group">
        <div className="filter-title">Distance</div>
        <div className="filter-options">
          {distances.map((distance) => (
            <button
              key={distance ?? "any"}
              type="button"
              className={`filter-chip ${String(activeFilters.distance) === String(distance) ? "active" : ""}`}
              aria-pressed={String(activeFilters.distance) === String(distance)}
              onClick={() => setDistanceFilter(distance ?? "any")}
            >
              {distance ? `${distance} km` : "Any"}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-filter-group">
        <div className="filter-title">Sale type</div>
        <div className="filter-options">
          {saleTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-chip ${activeFilters.saleType.includes(item.value) ? "active" : ""}`}
              aria-pressed={activeFilters.saleType.includes(item.value)}
              onClick={() => toggleFilter("saleType", item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="marketplace-filter-group">
        <div className="filter-title">Listing type</div>
        <div className="filter-options">
          {listingTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`filter-chip ${activeFilters.listingType.includes(item.value) ? "active" : ""}`}
              aria-pressed={activeFilters.listingType.includes(item.value)}
              onClick={() => toggleFilter("listingType", item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {onClose ? (
        <div className="marketplace-drawer__actions">
          <button className="btn btn-primary" type="button" onClick={onClose}>
            Apply filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
