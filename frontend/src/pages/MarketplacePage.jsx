import { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search } from "lucide-react";
import MarketplaceCard from "../components/marketplace/MarketplaceCard";
import FilterPanel from "../components/marketplace/FilterPanel";
import { getListings } from "../services/listingService";
import { marketplaceListings as fallbackListings } from "../data/mockData";

const CATEGORIES = [
  { label: "Phones", value: "phone" },
  { label: "Laptops", value: "laptop" },
  { label: "PC Components", value: "component" },
  { label: "Batteries", value: "battery" },
  { label: "Gaming", value: "gaming" },
  { label: "Appliances", value: "appliance" }
];

const CONDITIONS = ["Excellent", "Good", "Fair", "For Parts"];
const DISTANCES = [5, 10, 25, 50, null];
const SALE_TYPES = [
  { label: "Fixed Price", value: "fixed" },
  { label: "Auction", value: "auction" }
];
const LISTING_TYPES = [
  { label: "Whole Device", value: "whole" },
  { label: "Components", value: "component" }
];

const SORT_OPTIONS = [
  { label: "Recommended", value: "recommended" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Distance", value: "nearest" },
  { label: "Ending Soon", value: "ending-soon" }
];

function getSearchText(listing) {
  const specs = Object.values(listing.specifications || {}).join(" ");
  return `${listing.title} ${listing.category} ${specs}`.toLowerCase();
}

function formatFilterLabel(key, value) {
  if (key === "category") return CATEGORIES.find((item) => item.value === value)?.label || value;
  if (key === "condition") return value;
  if (key === "saleType") return SALE_TYPES.find((item) => item.value === value)?.label || value;
  if (key === "listingType") return LISTING_TYPES.find((item) => item.value === value)?.label || value;
  if (key === "distance") return `Within ${value} km`;
  if (key === "priceMin") return `Min ₹${value}`;
  if (key === "priceMax") return `Max ₹${value}`;
  if (key === "search") return `Search: ${value}`;
  return value;
}

export default function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState("recommended");
  const [activeFilters, setActiveFilters] = useState({
    category: [],
    condition: [],
    saleType: [],
    listingType: [],
    priceMin: "",
    priceMax: "",
    distance: "any"
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterToggleRef = useRef(null);
  const [favorites, setFavorites] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadListings() {
      setLoading(true);
      setError(null);
      try {
        const backendFilters = {};
        if (searchTerm) backendFilters.search = searchTerm;
        if (activeFilters.category.length) backendFilters.category = activeFilters.category[0];
        if (activeFilters.saleType.length) backendFilters.sale_type = activeFilters.saleType[0];
        if (activeFilters.priceMin) backendFilters.priceMin = activeFilters.priceMin;
        if (activeFilters.priceMax) backendFilters.priceMax = activeFilters.priceMax;
        const data = await getListings(backendFilters);
        if (isMounted) setListings(data);
      } catch (err) {
        if (import.meta.env.VITE_ENABLE_API_FALLBACK !== "false" && isMounted) {
          setListings(fallbackListings);
          setError(null);
        } else if (isMounted) {
          setError(err.message || "Unable to load marketplace listings.");
          setListings([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadListings();
    return () => {
      isMounted = false;
    };
  }, [searchTerm, activeFilters.category, activeFilters.saleType, activeFilters.priceMin, activeFilters.priceMax]);

  const filteredListings = useMemo(() => {
    const source = listings.length ? listings : fallbackListings;
    return source
      .filter((listing) => {
        if (searchTerm) {
          const text = getSearchText(listing);
          if (!text.includes(searchTerm.toLowerCase())) return false;
        }

        if (activeFilters.category.length && !activeFilters.category.includes(listing.category)) return false;
        if (activeFilters.condition.length && !activeFilters.condition.includes(listing.condition)) return false;
        if (activeFilters.saleType.length && !activeFilters.saleType.includes(listing.saleType)) return false;
        if (activeFilters.listingType.length && !activeFilters.listingType.includes(listing.type)) return false;

        if (activeFilters.priceMin) {
          const minValue = Number(activeFilters.priceMin);
          const value = listing.saleType === "fixed" ? listing.price : listing.currentBid || 0;
          if (value < minValue) return false;
        }

        if (activeFilters.priceMax) {
          const maxValue = Number(activeFilters.priceMax);
          const value = listing.saleType === "fixed" ? listing.price : listing.currentBid || 0;
          if (value > maxValue) return false;
        }

        if (activeFilters.distance !== "any") {
          const maxDistance = Number(activeFilters.distance);
          if (listing.distanceKm > maxDistance) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sort === "price-asc") {
          const aValue = a.saleType === "fixed" ? a.price : a.currentBid || 0;
          const bValue = b.saleType === "fixed" ? b.price : b.currentBid || 0;
          return aValue - bValue;
        }
        if (sort === "price-desc") {
          const aValue = a.saleType === "fixed" ? a.price : a.currentBid || 0;
          const bValue = b.saleType === "fixed" ? b.price : b.currentBid || 0;
          return bValue - aValue;
        }
        if (sort === "nearest") return a.distanceKm - b.distanceKm;
        if (sort === "ending-soon") {
          const aEnd = a.auctionEndTime ? new Date(a.auctionEndTime).getTime() : Number.POSITIVE_INFINITY;
          const bEnd = b.auctionEndTime ? new Date(b.auctionEndTime).getTime() : Number.POSITIVE_INFINITY;
          return aEnd - bEnd;
        }
        return 0;
      });
  }, [listings, searchTerm, activeFilters, sort]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (searchTerm) chips.push({ key: "search", value: searchTerm });
    activeFilters.category.forEach((value) => chips.push({ key: "category", value }));
    activeFilters.condition.forEach((value) => chips.push({ key: "condition", value }));
    activeFilters.saleType.forEach((value) => chips.push({ key: "saleType", value }));
    activeFilters.listingType.forEach((value) => chips.push({ key: "listingType", value }));
    if (activeFilters.priceMin) chips.push({ key: "priceMin", value: activeFilters.priceMin });
    if (activeFilters.priceMax) chips.push({ key: "priceMax", value: activeFilters.priceMax });
    if (activeFilters.distance !== "any") chips.push({ key: "distance", value: activeFilters.distance });
    return chips;
  }, [searchTerm, activeFilters]);

  const toggleFilter = (key, value) => {
    setActiveFilters((current) => {
      const values = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value];
      return { ...current, [key]: values };
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setActiveFilters({
      category: [],
      condition: [],
      saleType: [],
      listingType: [],
      priceMin: "",
      priceMax: "",
      distance: "any"
    });
  };

  const removeFilterChip = (key, value) => {
    if (key === "search") {
      setSearchTerm("");
      return;
    }
    if (key === "priceMin") {
      setActiveFilters((current) => ({ ...current, priceMin: "" }));
      return;
    }
    if (key === "priceMax") {
      setActiveFilters((current) => ({ ...current, priceMax: "" }));
      return;
    }
    if (key === "distance") {
      setActiveFilters((current) => ({ ...current, distance: "any" }));
      return;
    }
    setActiveFilters((current) => ({
      ...current,
      [key]: current[key].filter((item) => item !== value)
    }));
  };

  const toggleFavorite = (id) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
  };

  const openFilterPanel = () => setFilterPanelOpen(true);
  const closeFilterPanel = () => setFilterPanelOpen(false);
  const toggleFilterPanel = () => setFilterPanelOpen((current) => !current);

  useEffect(() => {
    if (!filterPanelOpen) return undefined;

    const handleWindowClick = (event) => {
      if (filterToggleRef.current && !filterToggleRef.current.contains(event.target)) {
        setFilterPanelOpen(false);
      }
    };

    window.addEventListener("mousedown", handleWindowClick);
    return () => window.removeEventListener("mousedown", handleWindowClick);
  }, [filterPanelOpen]);

  return (
    <main className="container section marketplace-page">
      <div className="marketplace-hero">
        <div className="marketplace-hero__copy">
          <div className="eyebrow">Marketplace</div>
          <h1>Find refurbished devices and premium components</h1>
          <p>Filter listings by category, price, condition, and distance for the best local deals.</p>
        </div>

        <form className="marketplace-search" onSubmit={handleSearchSubmit}>
          <label className="sr-only" htmlFor="marketplace-search">
            Search listings
          </label>

          <div
            className="marketplace-search__wrapper"
            ref={filterToggleRef}
            onMouseEnter={openFilterPanel}
            onMouseLeave={closeFilterPanel}
          >
            <div className="marketplace-search__control">
              <div className="marketplace-search__input">
                <Search size={18} />
                <input
                  id="marketplace-search"
                  type="search"
                  value={searchTerm}
                  placeholder="Search phones, laptops, components..."
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <button
                className="marketplace-search__filter-button"
                type="button"
                onClick={toggleFilterPanel}
              >
                <Filter size={16} />
                Filters
              </button>

              {filterPanelOpen ? (
                <div
                  className="marketplace-flyout-filters"
                >
                  <FilterPanel
                    activeFilters={activeFilters}
                    toggleFilter={toggleFilter}
                    setDistanceFilter={(value) => setActiveFilters((current) => ({ ...current, distance: value }))}
                    setPriceValue={(key, value) => setActiveFilters((current) => ({ ...current, [key]: value }))}
                    clearFilters={clearFilters}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="marketplace-meta">
            <span>{filteredListings.length} results</span>
            <div className="marketplace-sort">
              <label htmlFor="marketplace-sort">Sort by</label>
              <select id="marketplace-sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </div>

      {activeChips.length > 0 ? (
        <div className="marketplace-active-chips">
          {activeChips.map((chip) => (
            <button
              key={`${chip.key}-${chip.value}`}
              type="button"
              className="filter-chip active"
              onClick={() => removeFilterChip(chip.key, chip.value)}
            >
              {formatFilterLabel(chip.key, chip.value)} ×
            </button>
          ))}
          <button className="filter-chip" type="button" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="marketplace-layout">
        <section className="marketplace-results">
          {loading ? (
            <div className="marketplace-empty-state" role="status">
              <h2>Loading listings…</h2>
              <p>Fetching the latest marketplace data from the backend.</p>
            </div>
          ) : error ? (
            <div className="marketplace-empty-state" role="status">
              <h2>Marketplace is temporarily unavailable</h2>
              <p>{error}</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="marketplace-empty-state" role="status">
              <h2>No listings match these filters</h2>
              <p>Try broadening your search, clearing filters, or checking availability later.</p>
              <button className="btn btn-secondary" type="button" onClick={clearFilters}>
                Reset filters
              </button>
            </div>
          ) : (
            <div className="marketplace-grid">
              {filteredListings.map((listing) => (
                <MarketplaceCard
                  key={listing.id}
                  listing={listing}
                  isFavorite={favorites.includes(listing.id)}
                  onToggleFavorite={() => toggleFavorite(listing.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

    </main>
  );
}
