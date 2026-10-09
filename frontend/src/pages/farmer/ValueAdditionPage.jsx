import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import Button from "../../components/common/Button.jsx";
import Badge from "../../components/common/Badge.jsx";
import LoadingState from "../../components/common/LoadingState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import { getValueAdditionFilters, getValueAdditionProducts } from "../../services/valueAdditionService.js";
import ValueAdditionDetailModal from "../../components/farmer/ValueAdditionDetailModal.jsx";
import { Search, RefreshCw, Sprout, ArrowRight, Wrench, Eye } from "../../components/icons/Icons.jsx";

export default function ValueAdditionPage() {
  const navigate = useNavigate();
  const [filtersOptions, setFiltersOptions] = useState({ crops: [], categories: [], methods: [] });
  const [selectedCrop, setSelectedCrop] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [whatCanIMakeCrop, setWhatCanIMakeCrop] = useState("");
  const [whatCanIMakeQty, setWhatCanIMakeQty] = useState("");
  const [selectedProductModalId, setSelectedProductModalId] = useState(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load Filter Options
  useEffect(() => {
    let isMounted = true;
    getValueAdditionFilters()
      .then((data) => {
        if (isMounted && data) {
          setFiltersOptions({
            crops: data.crops || [],
            categories: data.categories || [],
            methods: data.methods || []
          });
        }
      })
      .catch((err) => {
        console.warn("Could not fetch filter dropdowns:", err.message);
      });
    return () => { isMounted = false; };
  }, []);

  // Fetch Products based on current filters & search
  const loadProducts = useCallback(() => {
    setLoading(true);
    setError(null);

    getValueAdditionProducts({
      search: searchTerm,
      crop: selectedCrop,
      category: selectedCategory,
      method: selectedMethod
    })
      .then((data) => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        let msg = "Unable to load value-added products. Please try again.";
        if (err.status === 401) {
          msg = "Your session has expired. Please log in again.";
        } else if (err.status === 403) {
          msg = "You do not have permission to access this feature.";
        } else if (err.status === 500) {
          msg = "Unable to load value-added products. Please try again.";
        } else if (err.message && (err.message.toLowerCase().includes("failed to fetch") || err.message.toLowerCase().includes("networkerror"))) {
          msg = "Unable to connect to the server.";
        } else if (err.message) {
          msg = err.message;
        }
        setError(msg);
        setLoading(false);
      });
  }, [searchTerm, selectedCrop, selectedCategory, selectedMethod]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchTerm.trim() !== "" ||
      selectedCrop !== "All" ||
      selectedCategory !== "All" ||
      selectedMethod !== "All"
    );
  }, [searchTerm, selectedCrop, selectedCategory, selectedMethod]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedCrop("All");
    setSelectedCategory("All");
    setSelectedMethod("All");
    setWhatCanIMakeCrop("");
    setWhatCanIMakeQty("");
  };

  return (
    <div className="fc-page animate-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Detail Preview Modal */}
      {selectedProductModalId && (
        <ValueAdditionDetailModal
          productId={selectedProductModalId}
          onClose={() => setSelectedProductModalId(null)}
        />
      )}

      {/* Page Header */}
      <div className="fc-page-header" style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--primary)", fontWeight: 600, fontSize: "0.875rem", marginBottom: "4px" }}>
            <Sprout size={16} /> Agricultural Value Addition
          </div>
          <h1 className="fc-h1" style={{ margin: 0 }}>Value Addition Knowledge Base</h1>
          <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "0.875rem" }}>
            Explore post-harvest processing methods, equipment guidelines, and market opportunities for your crops.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Button variant="subtle" onClick={() => navigate("/farmer/value-addition/projects")}>
            Saved Projects
          </Button>
          <Button variant="outline" onClick={() => navigate("/farmer/value-addition/equipment")}>
            <Wrench size={16} /> Equipment Directory
          </Button>
          <Button variant="primary" onClick={() => navigate("/farmer/value-addition/calculator")}>
            Profit & ROI Calculator <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {/* "What Can I Make?" Interactive Feature Banner */}
      <Card padded style={{ marginBottom: "24px", background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)", border: "1px solid #a7f3d0" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 className="fc-h2" style={{ margin: 0, color: "#065f46" }}>💡 What Can I Make from My Harvest?</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#047857" }}>
                Select a crop you harvest to instantly discover database-supported value-added products, processing methods, equipment, and government subsidies.
              </p>
            </div>
            <Badge variant="success">Crop Value Finder</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#065f46", marginBottom: "4px" }}>
                Select Harvest Crop
              </label>
              <select
                className="fc-input"
                value={whatCanIMakeCrop}
                onChange={(e) => {
                  setWhatCanIMakeCrop(e.target.value);
                  if (e.target.value) {
                    setSelectedCrop(e.target.value);
                  }
                }}
                style={{ background: "#ffffff", borderColor: "#6ee7b7", width: "100%", maxWidth: "100%", boxSizing: "border-box", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                <option value="">-- Choose Harvest Crop --</option>
                {filtersOptions.crops.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#065f46", marginBottom: "4px" }}>
                Harvest Quantity (Optional kg)
              </label>
              <input
                type="number"
                min="0"
                className="fc-input"
                placeholder="e.g. 500"
                value={whatCanIMakeQty}
                onChange={(e) => setWhatCanIMakeQty(e.target.value)}
                style={{ background: "#ffffff", borderColor: "#6ee7b7" }}
              />
            </div>

            <div>
              <Button
                variant="primary"
                onClick={() => {
                  if (whatCanIMakeCrop) {
                    setSelectedCrop(whatCanIMakeCrop);
                  }
                }}
                style={{ width: "100%", background: "#059669", borderColor: "#047857" }}
              >
                Find Value-Added Products <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Controls Panel */}
      <Card padded style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Search Bar */}
          <div style={{ position: "relative", width: "100%" }}>
            <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}>
              <Search size={16} />
            </div>
            <input
              type="text"
              className="fc-input"
              placeholder="Search value-added products, crops, processing methods..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", width: "100%" }}
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "center" }}>
            {/* Crop Filter */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Crop
              </label>
              <select
                className="fc-input"
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                <option value="All">All Crops</option>
                {filtersOptions.crops.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Category
              </label>
              <select
                className="fc-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                <option value="All">All Categories</option>
                {filtersOptions.categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Processing Method Filter */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Processing Method
              </label>
              <select
                className="fc-input"
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box", textOverflow: "ellipsis", overflow: "hidden" }}
              >
                <option value="All">All Methods</option>
                {filtersOptions.methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <div style={{ alignSelf: "end" }}>
                <Button
                  variant="subtle"
                  size="small"
                  onClick={handleClearFilters}
                  style={{ width: "100%", height: "38px" }}
                >
                  <RefreshCw size={14} /> Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Results Header & Counter (Rendered ONLY when clean success) */}
      {!loading && !error && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
            Showing {products.length} {products.length === 1 ? "Product" : "Products"}
          </div>
          {hasActiveFilters && (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              Filtered Results
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && <LoadingState text="Fetching value-added products catalog..." />}

      {/* Error State */}
      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={loadProducts}
        />
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          title="No Value-Added Products Found"
          description={hasActiveFilters ? "Try resetting your search query or filter dropdowns." : "No value-added products available."}
          actionText={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
        />
      )}

      {/* Products Grid */}
      {!loading && !error && products.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {products.map((item) => (
            <Card key={item.id} hoverable style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "8px" }}>
                <Badge variant="success">Derived from: {item.crop_name}</Badge>
                {item.value_addition_multiplier && (
                  <Badge variant="primary">{item.value_addition_multiplier}x Value</Badge>
                )}
              </div>

              <h3 style={{ margin: "4px 0 6px 0", fontSize: "1.1rem", color: "var(--text-main)" }}>
                {item.product_name}
              </h3>

              <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "8px" }}>
                <strong>Method:</strong> {item.processing_method || "N/A"}
              </div>

              <p style={{
                margin: "0 0 16px 0",
                fontSize: "0.85rem",
                color: "var(--muted)",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden"
              }}>
                {item.description}
              </p>

              <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  <Button
                    variant="subtle"
                    size="small"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedProductModalId(item.id)}
                  >
                    <Eye size={14} /> Quick View
                  </Button>
                  <Button
                    variant="primary"
                    size="small"
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/farmer/value-addition/${item.id}`)}
                  >
                    Full Guide <ArrowRight size={14} />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="small"
                  style={{ width: "100%", fontSize: "0.8rem" }}
                  onClick={() => navigate(`/farmer/value-addition/calculator?productId=${item.id}${whatCanIMakeQty ? `&raw_quantity=${whatCanIMakeQty}` : ""}`)}
                >
                  🧮 Calculate {whatCanIMakeQty ? `Profit (${whatCanIMakeQty} kg)` : "Economics"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
