import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../../services/api.js";
import {
  Button,
  Card,
  Badge,
  SearchBox,
  Select,
  Modal,
  Tabs,
  ProductCardSkeleton,
  EmptyState,
  ContactFarmerModal,
} from "../../components/common/index.js";
import { ProductCard } from "../../components/product/ProductCard.jsx";
import { GlobalLocationSelector } from "../../components/common/GlobalLocationSelector.jsx";
import { MapBoxView } from "../../components/common/MapBoxView.jsx";
import { MapPin, Globe, Compass, Search as SearchIcon, Heart, Cart as CartIcon, Star, Check } from "../../components/icons/Icons.jsx";
import { formatCurrency, formatDate } from "../../utils/formatters.js";
import { CATEGORIES, REGIONS } from "../../utils/constants.js";
import { useData } from "../../hooks/useData.js";
import { useCart } from "../../hooks/useCart.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useDebounce } from "../../hooks/useDebounce.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { useAuth } from "../../hooks/useAuth.js";
import { calculateDistanceKm, formatDistance } from "../../services/mapProvider.js";

const CATEGORY_FALLBACKS = {
  Vegetables: "/images/products/tomatoes.jpg",
  Grains: "/images/products/rice.jpg",
  Fruits: "/images/farmconnect-produce.jpg",
  Spices: "/images/farmconnect-produce.jpg",
  Dairy: "/images/farmconnect-farm.jpg"
};

function MarketplaceBase() {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { products } = useData();
  const { wishlist, addToCart, toggleWishlist } = useCart();
  const { notifySuccess } = useNotifications();
  const navigate = useNavigate();
  const { productId } = useParams();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [locationFilter, setLocationFilter] = useState({ countryCode: "All", region: "All", district: "All" });
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'map'
  const [userCoords, setUserCoords] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [maxDistance, setMaxDistance] = useState("All");
  const [sortBy, setSortBy] = useState("recommended");
  const [maxPrice, setMaxPrice] = useState(1000);
  const [minMoq, setMinMoq] = useState(1000);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [freshOnly, setFreshOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addedFlash, setAddedFlash] = useState(null);
  const [viewProduct, setViewProduct] = useState(null);
  const [contactModal, setContactModal] = useState({ open: false, farmer: null, product: null, mode: "message" });

  // Dynamic Farmers lookup
  const [farmers, setFarmers] = useState([]);
  const [selectedCompare, setSelectedCompare] = useState([]);

  // Reviews state for viewed product
  const [reviews, setReviews] = useState([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Auto-complete suggestion states
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch farmers list from server
  const fetchFarmers = useCallback(async () => {
    try {
      const users = await apiFetch("/api/users");
      if (Array.isArray(users)) {
        setFarmers(users.filter((u) => u.role === "farmer"));
      }
    } catch (err) {
      console.error("Failed to fetch farmers:", err);
    }
  }, []);

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationReason, setRecommendationReason] = useState("");
  const [naturalAiInput, setNaturalAiInput] = useState("");
  const [searchingAi, setSearchingAi] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/ai/recommendations");
      if (data && data.products) {
        setRecommendations(data.products);
        setRecommendationReason(data.reason || "");
      }
    } catch {
      /* ignore recommendation errors */
    }
  }, []);

  useEffect(() => {
    fetchFarmers();
    fetchRecommendations();
    const timer = setTimeout(() => setLoading(false), 550);
    return () => clearTimeout(timer);
  }, [fetchFarmers, fetchRecommendations]);

  const handleNaturalAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!naturalAiInput.trim()) return;

    setSearchingAi(true);
    try {
      const data = await apiFetch("/api/ai/natural-search", {
        method: "POST",
        body: JSON.stringify({ queryText: naturalAiInput.trim() })
      });

      if (data && data.filters) {
        const f = data.filters;
        if (f.queryText) setSearch(f.queryText);
        if (f.category && f.category !== "All") setCategory(f.category);
        if (f.organic) setOrganicOnly(true);
        if (f.maxPrice) setMaxPrice(f.maxPrice);
        notifySuccess("AI applied natural search filters!");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingAi(false);
    }
  };

  // Fetch reviews when viewed product changes
  const fetchReviews = useCallback(async (prodId) => {
    try {
      const data = await apiFetch(`/api/reviews?productId=${prodId}`);
      if (Array.isArray(data)) {
        setReviews(data);
      }
    } catch (err) {
      console.error("Failed to load reviews:", err);
    }
  }, []);

  useEffect(() => {
    if (viewProduct) {
      fetchReviews(viewProduct.id);
      setNewComment("");
      setNewRating(5);
    }
  }, [viewProduct, fetchReviews]);

  // Sync viewed product with URL parameter
  useEffect(() => {
    if (productId && products && products.length > 0) {
      const found = products.find((p) => p.id === productId);
      if (found) {
        setViewProduct(found);
      }
    } else {
      setViewProduct(null);
    }
  }, [productId, products]);

  const handleCloseModal = useCallback(() => {
    setViewProduct(null);
    if (productId) {
      navigate("/vendor/marketplace");
    }
  }, [productId, navigate]);

  const debouncedSearch = useDebounce(search, 300);

  // Generate suggestions based on search string
  useEffect(() => {
    if (search.trim().length > 1) {
      const matching = products
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 5);
      setSuggestions(matching);
    } else {
      setSuggestions([]);
    }
  }, [search, products]);

  const getFarmer = useCallback(
    (id) => {
      return (
        farmers.find((f) => f.id === id) || {
          name: "Unknown Grower",
          farmName: "Patil Estates",
          region: "Maharashtra",
          verificationStatus: "Verified",
          rating: 4.6,
        }
      );
    },
    [farmers]
  );

  const getDistance = useCallback((product) => {
    const farmer = getFarmer(product.farmerId);
    const pLat = product.lat || farmer.lat || 19.9975;
    const pLng = product.lng || farmer.lng || 73.7898;

    if (userCoords && userCoords.lat && userCoords.lng) {
      return calculateDistanceKm(userCoords.lat, userCoords.lng, pLat, pLng);
    }
    const charSum = (product.id || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (charSum % 38) + 4;
  }, [userCoords, getFarmer]);

  const handleNearMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocatingUser(false);
        setSortBy("distance");
        notifySuccess("Sorting products by distance from your current location!");
      },
      (err) => {
        setLocatingUser(false);
        alert(`Location access notice: ${err.message}. You can filter by location instead.`);
      },
      { timeout: 10000 }
    );
  }, [notifySuccess]);

  const isFresh = useCallback((harvestDateStr) => {
    if (!harvestDateStr) return false;
    const diffTime = Math.abs(new Date() - new Date(harvestDateStr));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }, []);

  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    let result = products
      .filter((p) => (category === "All" ? true : p.category === category))
      .filter((p) => {
        if (!locationFilter.countryCode || locationFilter.countryCode === "All") return true;
        const farmer = getFarmer(p.farmerId);
        const cCode = p.countryCode || farmer.countryCode || "IN";
        return cCode === locationFilter.countryCode;
      })
      .filter((p) => {
        if (!locationFilter.region || locationFilter.region === "All") return true;
        const farmer = getFarmer(p.farmerId);
        const reg = p.region || farmer.region || "";
        return reg.toLowerCase() === locationFilter.region.toLowerCase();
      })
      .filter((p) => {
        if (!locationFilter.district || locationFilter.district === "All") return true;
        const farmer = getFarmer(p.farmerId);
        const dist = p.district || farmer.district || "";
        return dist.toLowerCase() === locationFilter.district.toLowerCase();
      })
      .filter((p) => p.price <= maxPrice)
      .filter((p) => p.moq <= minMoq)
      .filter((p) => (organicOnly ? p.organic === 1 : true))
      .filter((p) => (freshOnly ? isFresh(p.harvestDate) : true))
      .filter((p) => (maxDistance === "All" ? true : getDistance(p) <= Number(maxDistance)))
      .filter((p) => {
        if (!term) return true;
        const farmer = getFarmer(p.farmerId);
        const pName = p?.name?.toLowerCase() || "";
        const fName = farmer?.name?.toLowerCase() || "";
        const fFarm = farmer?.farmName?.toLowerCase() || "";
        const cCity = (p?.city || farmer?.city || "").toLowerCase();
        return pName.includes(term) || fName.includes(term) || fFarm.includes(term) || cCity.includes(term);
      });

    if (sortBy === "price_asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "rating") {
      result.sort((a, b) => (getFarmer(b.farmerId).rating || 0) - (getFarmer(a.farmerId).rating || 0));
    } else if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "distance") {
      result.sort((a, b) => getDistance(a) - getDistance(b));
    }

    return result;
  }, [products, category, locationFilter, maxPrice, minMoq, organicOnly, freshOnly, maxDistance, sortBy, debouncedSearch, getFarmer, isFresh, getDistance]);

  const handleAdd = useCallback(
    (id) => {
      const prod = products.find((p) => p.id === id);
      const moq = prod ? prod.moq : 10;
      addToCart(id, moq);
      setAddedFlash(id);
      notifySuccess(t("addedToCart"));
      setTimeout(() => setAddedFlash((cur) => (cur === id ? null : cur)), 900);
    },
    [products, addToCart, notifySuccess, t]
  );

  const handleWishlist = useCallback(
    (id) => {
      const wasIn = wishlist.includes(id);
      toggleWishlist(id);
      notifySuccess(wasIn ? t("removedFromWishlist") : t("addedToWishlist"));
    },
    [wishlist, toggleWishlist, notifySuccess, t]
  );

  const clearFilters = useCallback(() => {
    setCategory("All");
    setLocationFilter({ countryCode: "All", region: "All", district: "All" });
    setMaxPrice(1000);
    setMinMoq(1000);
    setOrganicOnly(false);
    setFreshOnly(false);
    setSearch("");
  }, []);

  // Comparison toggle
  const toggleCompare = useCallback(
    (product) => {
      setSelectedCompare((prev) => {
        const exists = prev.find((p) => p.id === product.id);
        if (exists) {
          return prev.filter((p) => p.id !== product.id);
        }
        if (prev.length >= 3) {
          notifySuccess("You can compare up to 3 products at a time.");
          return prev;
        }
        return [...prev, product];
      });
    },
    [notifySuccess]
  );

  // Identify cheapest compared product
  const cheapestCompareId = useMemo(() => {
    if (selectedCompare.length < 2) return null;
    let minPrice = Infinity;
    let cheapestId = null;
    selectedCompare.forEach((p) => {
      if (p.price < minPrice) {
        minPrice = p.price;
        cheapestId = p.id;
      }
    });
    return cheapestId;
  }, [selectedCompare]);

  // Submit product review
  const handleSubmitReview = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newComment.trim()) return;

      setSubmittingReview(true);
      try {
        const res = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: viewProduct.id,
            farmerId: viewProduct.farmerId,
            vendorId: currentUser.id,
            vendorName: currentUser.name,
            rating: newRating,
            comment: newComment,
          }),
        });

        if (res.ok) {
          const added = await res.json();
          setReviews((prev) => [added, ...prev]);
          setNewComment("");
          setNewRating(5);
          notifySuccess("Review submitted successfully!");
          fetchFarmers();
        } else {
          notifySuccess("Failed to submit review.");
        }
      } catch (err) {
        console.error("Error submitting review:", err);
      } finally {
        setSubmittingReview(false);
      }
    },
    [viewProduct, currentUser, newRating, newComment, notifySuccess, fetchFarmers]
  );

  const categoryTabs = useMemo(() => {
    return ["All", ...CATEGORIES].map((c) => ({
      id: c,
      label: c === "All" ? t("all") : c,
    }));
  }, [t]);

  return (
    <div className="fc-page-transition">
      {/* Premium AgriTech Hero Header Banner */}
      <div
        className="fc-hero"
        style={{
          background: "var(--gradient-hero)",
          padding: "36px 32px",
          borderRadius: "var(--radius-lg)",
          marginBottom: "28px",
          color: "#ffffff",
          boxShadow: "var(--shadow-md)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div className="fc-hero-inner" style={{ maxWidth: "720px", position: "relative", zIndex: 2 }}>
          <div className="fc-hero-eyebrow">
            🌱 DIRECT FROM VERIFIED GROWERS
          </div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "32px", fontWeight: 800, margin: "0 0 10px 0", lineHeight: 1.2 }}>
            Fresh from the Farm
          </h1>
          <p style={{ fontSize: "14.5px", opacity: 0.9, lineHeight: 1.5, margin: "0 0 20px 0", maxWidth: "600px" }}>
            Source fresh produce directly from verified farmers with transparent wholesale pricing.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "12px", opacity: 0.95 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "999px", fontWeight: 600 }}>
              <Check size={13} /> 100% Verified Indian Growers
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: "999px", fontWeight: 600 }}>
              <Check size={13} /> Transparent Wholesale Tiers
            </span>
          </div>
        </div>
      </div>

      {/* Natural Language AI Smart Search Bar */}
      <Card style={{ padding: "16px 20px", marginBottom: "20px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
        <form onSubmit={handleNaturalAiSearch} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800, fontSize: "13.5px", color: "var(--brand-dark)", display: "flex", alignItems: "center", gap: "6px", minWidth: "160px" }}>
            🌱 Natural AI Search:
          </div>
          <input
            className="fc-input"
            value={naturalAiInput}
            onChange={(e) => setNaturalAiInput(e.target.value)}
            placeholder="Try: 'Show organic tomatoes under ₹50 near me' or 'எனக்கு அருகில் ஆர்கானிக் தக்காளி வேண்டும்'"
            style={{ flex: 1, minWidth: "260px", fontSize: "13px" }}
          />
          <Button type="submit" variant="primary" disabled={searchingAi || !naturalAiInput.trim()} style={{ fontWeight: 700, padding: "10px 18px" }}>
            {searchingAi ? "Parsing..." : "AI Search →"}
          </Button>
        </form>
      </Card>

      {/* Recommended for You Section */}
      {recommendations.length > 0 && (
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "14px" }}>
            <div>
              <h3 className="fc-h3" style={{ margin: 0 }}>Recommended for You</h3>
              <p className="fc-soft" style={{ fontSize: "12.5px", margin: "2px 0 0 0" }}>
                {recommendationReason || "Personalized B2B produce recommendations."}
              </p>
            </div>
          </div>
          <div className="fc-product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {recommendations.slice(0, 4).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onSelect={(prod) => navigate(`/vendor/products/${prod.id}`)}
                onAddToCart={(prod) => addToCart(prod.id, prod.moq || 10)}
                isInWishlist={wishlist.includes(p.id)}
                onToggleWishlist={(prod) => toggleWishlist(prod.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Prominent Search Section & Category Chips */}
      <div className="fc-panel" style={{ padding: "20px", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
          <div style={{ flex: 1, minWidth: "280px", position: "relative" }}>
            <SearchBox
              value={search}
              onChange={(val) => {
                setSearch(val);
                setShowSuggestions(true);
              }}
              placeholder="Search crop, farmer name or farm..."
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{ width: "100%" }}
            />

            {/* Autocomplete Suggestions Popup */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "100%",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "var(--shadow-lg)",
                  zIndex: 30,
                  marginTop: "4px",
                  overflow: "hidden",
                }}
              >
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSearch(p.name);
                      setShowSuggestions(false);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      fontSize: "13px",
                      color: "var(--text)",
                    }}
                  >
                    <span>🔍 <strong>{p.name}</strong></span>
                    <span className="fc-soft">{p.category}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Near Me & View Mode Switcher */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleNearMe}
              disabled={locatingUser}
              style={{ fontSize: "12px" }}
            >
              <Compass size={14} /> {locatingUser ? "Locating..." : "Near Me"}
            </Button>

            <div style={{ display: "flex", background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "2px" }}>
              <button
                type="button"
                className={`fc-btn fc-btn-xs ${viewMode === "grid" ? "fc-btn-primary" : "fc-btn-ghost"}`}
                onClick={() => setViewMode("grid")}
              >
                Grid View
              </button>
              <button
                type="button"
                className={`fc-btn fc-btn-xs ${viewMode === "map" ? "fc-btn-primary" : "fc-btn-ghost"}`}
                onClick={() => setViewMode("map")}
              >
                Map View
              </button>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ minWidth: "160px" }}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              options={[
                { value: "recommended", label: "Recommended" },
                { value: "price_asc", label: "Price: Low to High" },
                { value: "price_desc", label: "Price: High to Low" },
                { value: "rating", label: "Highest Rated" },
                { value: "newest", label: "Newest Harvest" },
                { value: "distance", label: "Nearest to Me" },
              ]}
              style={{ fontSize: "13px", padding: "8px 12px" }}
            />
          </div>

          <div className="fc-soft" style={{ fontSize: "13px", fontWeight: 600 }}>
            {filtered.length} listings
          </div>
        </div>

        {/* Scrollable Category Chips */}
        <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
          <Tabs
            tabs={categoryTabs}
            activeTab={category}
            onChange={(tabId) => setCategory(tabId)}
            variant="chip"
          />
        </div>
      </div>

      {/* Main Layout Grid: Filters Sidebar + Products */}
      <div className="fc-market-layout">
        {/* Advanced Filters Sidebar */}
        <aside className="fc-filters fc-card" style={{ padding: "20px" }}>
          <div className="fc-filters-title">
            <span style={{ fontSize: "12.5px", fontWeight: 800 }}>FILTERS</span>
            <button className="fc-link-btn" onClick={clearFilters} style={{ fontSize: "12px" }}>
              {t("clearFilters")}
            </button>
          </div>

          <div className="fc-filters-title" style={{ marginTop: 14 }}>
            🌐 GLOBAL LOCATION FILTER
          </div>
          <GlobalLocationSelector
            value={locationFilter}
            onChange={(newLoc) => setLocationFilter(newLoc)}
            allowSearchMode={false}
          />

          <div className="fc-filters-title" style={{ marginTop: 14 }}>
            📍 Radius Filter
          </div>
          <Select
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
            options={[
              { value: "All", label: "All Distances" },
              { value: "5", label: "Within 5 km" },
              { value: "10", label: "Within 10 km" },
              { value: "25", label: "Within 25 km" },
              { value: "50", label: "Within 50 km" },
            ]}
            style={{ fontSize: "13px", padding: "8px 12px" }}
          />

          <div className="fc-filters-title" style={{ marginTop: 14 }}>
            {t("category")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {["All", ...CATEGORIES].map((c) => (
              <label key={c} className="fc-filter-row" style={{ cursor: "pointer", fontSize: 13 }}>
                <input
                  type="radio"
                  name="category_filter"
                  checked={category === c}
                  onChange={() => setCategory(c)}
                  style={{ marginRight: 6 }}
                />
                {c === "All" ? t("all") : c}
              </label>
            ))}
          </div>

          <div className="fc-filters-title" style={{ marginTop: 18 }}>
            Price Caps: {formatCurrency(maxPrice)}
          </div>
          <input
            type="range"
            min="10"
            max="1000"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="fc-range"
          />

          <div className="fc-filters-title" style={{ marginTop: 18 }}>
            MOQ Limits: {minMoq} unit
          </div>
          <input
            type="range"
            min="10"
            max="1000"
            value={minMoq}
            onChange={(e) => setMinMoq(Number(e.target.value))}
            className="fc-range"
          />

          <div className="fc-filters-title" style={{ marginTop: 22 }}>
            Specifications
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={organicOnly}
              onChange={(e) => setOrganicOnly(e.target.checked)}
            />
            🌿 Organic Harvest Only
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={freshOnly}
              onChange={(e) => setFreshOnly(e.target.checked)}
            />
            ⏱️ Harvested This Week
          </label>
        </aside>

        {/* Product Cards Grid or Map View */}
        <div>
          {loading ? (
            <div className="fc-product-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : viewMode === "map" ? (
            <div style={{ marginBottom: "24px" }}>
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand)" }}>
                  🗺️ Interactive Marketplace Map ({filtered.length} listings shown)
                </span>
                <span className="fc-muted" style={{ fontSize: "12px" }}>
                  Click markers to inspect harvest details
                </span>
              </div>
              <MapBoxView
                markers={filtered.map((p) => {
                  const farmer = getFarmer(p.farmerId);
                  return {
                    id: p.id,
                    title: p.name,
                    farmerName: farmer.name,
                    location: `${p.city || farmer.city || "Kovilpatti"}, ${p.region || farmer.region || "Tamil Nadu"}`,
                    city: p.city || farmer.city || "Kovilpatti",
                    district: p.district || farmer.district || "Thoothukudi",
                    region: p.region || farmer.region || "Tamil Nadu",
                    countryCode: p.countryCode || farmer.countryCode || "IN",
                    price: p.price,
                    currency: p.currency || farmer.currency || "INR",
                    unit: p.unit,
                    lat: p.lat || farmer.lat || 9.1724,
                    lng: p.lng || farmer.lng || 77.8687
                  };
                })}
                height="520px"
                onSelectMarker={(m) => {
                  const found = products.find((p) => p.id === m.id);
                  if (found) setViewProduct(found);
                }}
              />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<SearchIcon size={28} />}
              title={t("noResults")}
              description="No crop listings match your active category or specification filters."
              action={
                <Button variant="outline" onClick={clearFilters}>
                  {t("clearFilters")}
                </Button>
              }
            />
          ) : (
            <div className="fc-product-grid">
              {filtered.map((p) => {
                const farmer = getFarmer(p.farmerId);
                const isCompared = !!selectedCompare.find((c) => c.id === p.id);
                return (
                  <div key={p.id} style={{ display: "flex", flexDirection: "column" }}>
                    <ProductCard
                      product={p}
                      farmerName={farmer.name}
                      region={farmer.region}
                      mode="vendor"
                      inWishlist={wishlist.includes(p.id)}
                      justAdded={addedFlash === p.id}
                      onAdd={handleAdd}
                      onToggleWishlist={handleWishlist}
                      onView={(prod) => navigate(`/vendor/products/${prod.id}`)}
                    />
                    <Button
                      variant={isCompared ? "primary" : "outline"}
                      size="sm"
                      style={{ marginTop: 8, width: "100%", fontSize: 11 }}
                      onClick={() => toggleCompare(p)}
                    >
                      {isCompared ? "✓ Added to Compare" : "⚖ Compare Spec"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison Drawer Footer */}
      {selectedCompare.length > 0 && (
        <div
          className="fc-slide-up"
          style={{
            position: "fixed",
            bottom: 0,
            left: "220px",
            right: 0,
            background: "var(--surface)",
            borderTop: "2px solid var(--brand)",
            boxShadow: "var(--shadow-lg)",
            padding: "16px 24px",
            zIndex: 100,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 14, fontFamily: "var(--font-heading)" }}>
              ⚖ Side-by-Side Spec Comparison ({selectedCompare.length}/3)
            </strong>
            <button className="fc-link-btn" onClick={() => setSelectedCompare([])} style={{ fontSize: 12 }}>
              Clear All
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${selectedCompare.length + 1}, 1fr)`,
              gap: 12,
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontWeight: 700,
                color: "var(--text-muted)",
                justifyContent: "center",
              }}
            >
              <div>Product Price</div>
              <div>Grade Scale</div>
              <div>Min Order MOQ</div>
              <div>Organic Status</div>
              <div>Farmer Rating</div>
            </div>

            {selectedCompare.map((p) => {
              const farmer = getFarmer(p.farmerId);
              const isCheapest = p.id === cheapestCompareId;
              return (
                <div
                  key={p.id}
                  style={{
                    background: isCheapest ? "var(--brand-light)" : "var(--bg-soft)",
                    padding: 12,
                    borderRadius: "var(--radius-sm)",
                    border: isCheapest ? "1.5px solid var(--brand)" : "1px solid var(--border)",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 8 }}>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 120 }}>
                      {p.name}
                    </span>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontWeight: 700 }}
                      onClick={() => toggleCompare(p)}
                    >
                      𐄂
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <strong>{formatCurrency(p.price)}</strong>/{p.unit}
                      {isCheapest && (
                        <Badge variant="success" style={{ marginLeft: 6, fontSize: 9 }}>
                          CHEAPEST
                        </Badge>
                      )}
                    </div>
                    <div>Grade {p.grade}</div>
                    <div>{p.moq} {p.unit}</div>
                    <div>{p.organic === 1 ? "🌿 Yes" : "—"}</div>
                    <div>★ {farmer.rating?.toFixed(1) || "4.6"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Details modal with Wholesale Tiers and Reviews */}
      <Modal open={!!viewProduct} onClose={handleCloseModal} title={viewProduct?.name} width={620}>
        {viewProduct && (
          <div style={{ maxHeight: "80vh", overflowY: "auto", paddingRight: 6 }}>
            {/* Image Banner Header */}
            <div
              style={{
                height: 200,
                backgroundImage: `url(${viewProduct.imageUrl || CATEGORY_FALLBACKS[viewProduct.category] || CATEGORY_FALLBACKS.Vegetables})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "var(--radius-md)",
                marginBottom: 16,
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", gap: 6 }}>
                {viewProduct.organic === 1 && (
                  <Badge variant="organic" />
                )}
                <Badge variant="neutral" style={{ background: "var(--surface)", color: "var(--text)", fontWeight: 700 }}>
                  Grade {viewProduct.grade}
                </Badge>
              </div>
            </div>

            {/* Description */}
            <p className="fc-muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              {viewProduct.description}
            </p>

            {/* Metadata Rows */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div>
                <span className="fc-soft" style={{ fontSize: 11, display: "block", fontWeight: 700 }}>
                  GROWER / FARM NAME
                </span>
                <strong>{getFarmer(viewProduct.farmerId).name}</strong> ({getFarmer(viewProduct.farmerId).farmName || "Nashik Estates"})
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                  ★ {getFarmer(viewProduct.farmerId).rating?.toFixed(1) || "4.8"} Farmer Rating
                  {getFarmer(viewProduct.farmerId).verificationStatus === "Verified" && (
                    <span style={{ marginLeft: 6, color: "var(--brand)", fontWeight: 700 }}>✓ Verified</span>
                  )}
                </div>
              </div>
              <div>
                <span className="fc-soft" style={{ fontSize: 11, display: "block", fontWeight: 700 }}>
                  HARVEST DATE
                </span>
                <strong>{viewProduct.harvestDate ? formatDate(viewProduct.harvestDate) : "Recently"}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <span className="fc-soft" style={{ fontSize: 11, display: "block", fontWeight: 700 }}>
                  BASE B2B PRICE
                </span>
                <strong style={{ fontSize: 18, fontFamily: "var(--font-heading)" }}>
                  {formatCurrency(viewProduct.price)}
                </strong>{" "}
                <span className="fc-soft">/{viewProduct.unit}</span>
              </div>
              <div>
                <span className="fc-soft" style={{ fontSize: 11, display: "block", fontWeight: 700 }}>
                  MINIMUM ORDER QUANTITY (MOQ)
                </span>
                <strong>
                  {viewProduct.moq || 10} {viewProduct.unit}
                </strong>
              </div>
            </div>

            {/* Wholesale discount pricing tiers */}
            {(() => {
              let tiers = {};
              try {
                tiers = JSON.parse(viewProduct.tierPrices || "{}");
              } catch {
                tiers = {};
              }
              const tierEntries = Object.entries(tiers);
              if (tierEntries.length > 0) {
                return (
                  <Card style={{ marginTop: 20, border: "1.5px solid var(--accent-border)", background: "var(--accent-light)" }}>
                    <strong style={{ fontSize: 12.5, color: "var(--accent)" }}>📈 Bulk B2B Discount Tiers</strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 4, fontSize: 11, color: "var(--text-muted)" }}>
                        <span>Order Quantity</span>
                        <span>Unit Price</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>
                          {viewProduct.moq} - {tierEntries[0][0]} {viewProduct.unit}
                        </span>
                        <strong>{formatCurrency(viewProduct.price)}</strong>
                      </div>
                      {tierEntries.map(([qty, pr], idx) => {
                        const nextQty = tierEntries[idx + 1] ? `${tierEntries[idx + 1][0]} ${viewProduct.unit}` : "+";
                        return (
                          <div key={qty} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                            <span>
                              {qty} {nextQty === "+" ? `${qty}+` : `${qty} - ${nextQty}`} {viewProduct.unit}
                            </span>
                            <strong style={{ color: "var(--brand)" }}>{formatCurrency(Number(pr))}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              }
              return null;
            })()}

            {/* Purchase CTA */}
            <div className="fc-flex-gap-12" style={{ marginTop: 24 }}>
              <Button variant="primary" full onClick={() => { handleAdd(viewProduct.id); handleCloseModal(); }}>
                <CartIcon size={15} /> Add MOQ to Cart
              </Button>
              <Button variant="outline" onClick={() => handleWishlist(viewProduct.id)}>
                <Heart size={15} filled={wishlist.includes(viewProduct.id)} />
              </Button>
            </div>

            {/* Ratings & Reviews Panel */}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 24, paddingTop: 20 }}>
              <h4 style={{ fontSize: 14, fontWeight: "bold", marginBottom: 12 }}>
                Verified Purchaser Reviews ({reviews.length})
              </h4>

              {/* Form to submit review */}
              <form onSubmit={handleSubmitReview} style={{ background: "var(--bg-soft)", padding: 14, borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Write a Review</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNewRating(i + 1)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        <Star size={14} color={i < newRating ? "#f59e0b" : "var(--border-strong)"} />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  className="fc-textarea"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share details of produce uniformity, shelf-life, and delivery..."
                  style={{ fontSize: 12.5, padding: "10px", minHeight: 65 }}
                  required
                />

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <Button type="submit" variant="accent" size="sm" disabled={submittingReview}>
                    Submit Review
                  </Button>
                </div>
              </form>

              {/* Reviews List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {reviews.length === 0 ? (
                  <p className="fc-soft" style={{ fontSize: 12, fontStyle: "italic" }}>
                    No reviews posted for this product yet.
                  </p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <strong>{r.vendorName}</strong>
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={11} color={i < r.rating ? "#f59e0b" : "var(--border-strong)"} />
                          ))}
                        </div>
                      </div>
                      <div className="fc-soft" style={{ fontSize: 10.5, display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{formatDate(r.createdAt)}</span>
                        {r.verifiedPurchase === 1 && (
                          <span style={{ color: "var(--brand)", fontWeight: 700 }}>✓ Verified Purchase</span>
                        )}
                      </div>
                      <p style={{ margin: "6px 0 0 0", lineHeight: 1.45, color: "var(--text)" }}>{r.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ContactFarmerModal
        open={contactModal.open}
        onClose={() => setContactModal({ open: false, farmer: null, product: null, mode: "message" })}
        farmer={contactModal.farmer}
        product={contactModal.product}
        mode={contactModal.mode}
      />
    </div>
  );
}

export const Marketplace = memo(MarketplaceBase);
export default Marketplace;
