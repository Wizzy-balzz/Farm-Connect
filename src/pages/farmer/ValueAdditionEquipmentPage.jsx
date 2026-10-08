import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/common/Card.jsx";
import Button from "../../components/common/Button.jsx";
import Badge from "../../components/common/Badge.jsx";
import LoadingState from "../../components/common/LoadingState.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import ErrorState from "../../components/common/ErrorState.jsx";
import {
  getValueAdditionFilters,
  getValueAdditionEquipment,
  getValueAdditionEquipmentDetail
} from "../../services/valueAdditionService.js";
import {
  Search,
  RefreshCw,
  Sprout,
  ArrowLeft,
  Wrench,
  X,
  Info,
  CheckCircle,
  FileText,
  ArrowRight
} from "../../components/icons/Icons.jsx";

export default function ValueAdditionEquipmentPage() {
  const navigate = useNavigate();

  // Filters State
  const [filtersOptions, setFiltersOptions] = useState({ crops: [], categories: [], methods: [] });
  const [selectedCrop, setSelectedCrop] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedMethod, setSelectedMethod] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  // Data State
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load Dropdown Options
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

  // Load Equipment Listing
  const fetchEquipment = useCallback(() => {
    setLoading(true);
    setError(null);

    getValueAdditionEquipment({
      search: searchTerm,
      crop: selectedCrop,
      category: selectedCategory,
      method: selectedMethod
    })
      .then((data) => {
        setEquipmentList(data || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load equipment catalog.");
        setLoading(false);
      });
  }, [searchTerm, selectedCrop, selectedCategory, selectedMethod]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEquipment();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchEquipment]);

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
  };

  // Open Equipment Detail Modal
  const handleOpenDetail = (id) => {
    setDetailLoading(true);
    setIsModalOpen(true);
    getValueAdditionEquipmentDetail(id)
      .then((data) => {
        setSelectedItem(data);
        setDetailLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load equipment details:", err);
        setDetailLoading(false);
      });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="fc-page animate-fade-in" style={{ paddingBottom: "40px" }}>
      {/* Header Bar */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/farmer/value-addition")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ArrowLeft size={14} /> Value Addition Catalog
          </Button>
          <span style={{ color: "var(--muted)", fontSize: "0.875rem" }}>/</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--primary)" }}>
            Processing Equipment
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="fc-h1" style={{ margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
              <Wrench size={26} style={{ color: "var(--primary)" }} /> Processing Equipment Directory
            </h1>
            <p className="fc-muted" style={{ margin: "4px 0 0 0", fontSize: "0.875rem", maxWidth: "720px" }}>
              Technical specifications, processing capacities, operational guidelines, and maintenance protocols for agricultural value-addition machinery.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <Button variant="outline" onClick={() => navigate("/farmer/value-addition/calculator")}>
              ROI Calculator
            </Button>
            <Button variant="primary" onClick={() => navigate("/farmer/value-addition")}>
              <Sprout size={16} /> Products Catalog
            </Button>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      <div
        style={{
          backgroundColor: "#F0F9FF",
          border: "1px solid #BAE6FD",
          borderRadius: "8px",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px"
        }}
      >
        <Info size={20} style={{ color: "#0284C7", flexShrink: 0, marginTop: "2px" }} />
        <div style={{ fontSize: "0.84rem", color: "#0369A1", lineHeight: "1.45" }}>
          <strong>Agricultural Knowledge Module:</strong> Specifications and operational protocols are compiled from authoritative agricultural engineering literature. FarmConnect does not sell machinery directly or contain commercial vendor purchase links.
        </div>
      </div>

      {/* Filters Control Panel */}
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
              placeholder="Search equipment name, purpose, crop, or processing method..."
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
                style={{ width: "100%" }}
              >
                <option value="All">All Crops</option>
                {filtersOptions.crops.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
                style={{ width: "100%" }}
              >
                <option value="All">All Methods</option>
                {filtersOptions.methods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Product Category Filter */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                Product Category
              </label>
              <select
                className="fc-input"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="All">All Categories</option>
                {filtersOptions.categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} style={{ width: "100%" }}>
                  <RefreshCw size={14} /> Clear Filters
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Equipment Results & Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
          Equipment Directory ({equipmentList.length})
        </h2>
        {hasActiveFilters && (
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            Filtered results matching criteria
          </span>
        )}
      </div>

      {/* Main Content States */}
      {loading ? (
        <LoadingState message="Fetching processing equipment specifications..." />
      ) : error ? (
        <ErrorState title="Error Loading Equipment" message={error} onRetry={fetchEquipment} />
      ) : equipmentList.length === 0 ? (
        <EmptyState
          title="No Equipment Found"
          message="No equipment items matched your search and filter options."
          actionLabel="Clear Filters"
          onAction={handleClearFilters}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "20px"
          }}
        >
          {equipmentList.map((item) => (
            <Card
              key={item.id}
              hoverable
              style={{
                display: "flex",
                flexDirection: "column",
                justify: "space-between",
                height: "100%",
                borderRadius: "10px",
                overflow: "hidden"
              }}
            >
              <div style={{ padding: "18px" }}>
                {/* Method & Category Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                  <Badge variant="success">
                    {item.processing_method || "Processing Equipment"}
                  </Badge>
                  {item.capacity_info && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569", backgroundColor: "#F1F5F9", padding: "2px 8px", borderRadius: "12px" }}>
                      Cap: {item.capacity_info}
                    </span>
                  )}
                </div>

                {/* Equipment Title */}
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0 0 8px 0", color: "#0F172A", lineHeight: "1.3" }}>
                  {item.equipment_name}
                </h3>

                {/* Applicable Crops & Products */}
                <div style={{ marginBottom: "10px", fontSize: "0.82rem", color: "var(--muted)" }}>
                  <div>
                    <strong>Crops:</strong> {item.applicable_crops || "General Agricultural Crops"}
                  </div>
                  {item.applicable_products && (
                    <div>
                      <strong>Products:</strong> {item.applicable_products}
                    </div>
                  )}
                </div>

                {/* Purpose Snippet */}
                <p style={{ fontSize: "0.86rem", color: "#334155", margin: 0, lineHeight: "1.45", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.purpose || "Essential equipment used in processing and value addition."}
                </p>
              </div>

              {/* Card Footer Button */}
              <div
                style={{
                  padding: "12px 18px",
                  borderTop: "1px solid var(--border)",
                  backgroundColor: "#FAFAFA",
                  display: "flex",
                  justify: "space-between",
                  alignItems: "center"
                }}
              >
                <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <FileText size={14} /> Spec Sheet
                </span>
                <Button variant="primary" size="sm" onClick={() => handleOpenDetail(item.id)}>
                  View Details <ArrowRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Equipment Details View Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            zIndex: 1000,
            display: "flex",
            justify: "center",
            alignItems: "center",
            padding: "16px",
            backdropFilter: "blur(4px)"
          }}
          onClick={handleCloseModal}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "12px",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justify: "space-between",
                alignItems: "flex-start",
                backgroundColor: "#F8FAFC",
                borderTopLeftRadius: "12px",
                borderTopRightRadius: "12px"
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <Badge variant="success">
                    {selectedItem?.processing_method || "Equipment Spec"}
                  </Badge>
                  {selectedItem?.capacity_info && (
                    <Badge variant="outline">
                      Capacity: {selectedItem.capacity_info}
                    </Badge>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#0F172A" }}>
                  {selectedItem?.equipment_name || "Equipment Specification"}
                </h2>
              </div>
              <button
                onClick={handleCloseModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748B",
                  padding: "4px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {detailLoading ? (
              <div style={{ padding: "40px" }}>
                <LoadingState message="Loading detailed equipment specifications..." />
              </div>
            ) : selectedItem ? (
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Purpose */}
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.88rem", textTransform: "uppercase", tracking: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
                    Purpose & Functions
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.94rem", color: "#334155", lineHeight: "1.5" }}>
                    {selectedItem.purpose || "N/A"}
                  </p>
                </div>

                {/* Applicable Crops & Products */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ backgroundColor: "#F1F5F9", padding: "12px 14px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                      Applicable Crops
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#0F172A", fontWeight: 600 }}>
                      {selectedItem.applicable_crops || "General Crops"}
                    </div>
                  </div>
                  <div style={{ backgroundColor: "#F1F5F9", padding: "12px 14px", borderRadius: "8px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "4px" }}>
                      Applicable Products
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#0F172A", fontWeight: 600 }}>
                      {selectedItem.applicable_products || "Various Products"}
                    </div>
                  </div>
                </div>

                {/* Capacity Information */}
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.88rem", textTransform: "uppercase", tracking: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
                    Capacity Information
                  </h4>
                  <div style={{ padding: "12px 16px", backgroundColor: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", color: "#065F46", fontWeight: 600, fontSize: "0.92rem" }}>
                    {selectedItem.capacity_info || "Capacity varies based on model size and raw material throughput."}
                  </div>
                </div>

                {/* Operational Description */}
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.88rem", textTransform: "uppercase", tracking: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
                    Basic Operational Description
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.92rem", color: "#334155", lineHeight: "1.6", whiteSpace: "pre-line" }}>
                    {selectedItem.operational_description || "Standard operation protocols apply. Ensure proper safety clearance and clean loading of raw materials."}
                  </p>
                </div>

                {/* Maintenance Considerations */}
                <div>
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "0.88rem", textTransform: "uppercase", tracking: "0.05em", color: "var(--muted)", fontWeight: 700 }}>
                    Maintenance Considerations
                  </h4>
                  <div style={{ padding: "14px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", color: "#92400E", fontSize: "0.9rem", lineHeight: "1.5" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <CheckCircle size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#B45309" }} />
                      <div>{selectedItem.maintenance_considerations || "Regular cleaning and sanitation after every processing batch."}</div>
                    </div>
                  </div>
                </div>

                {/* Source & Reference */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    <strong>Reference:</strong> {selectedItem.source_reference || "Authoritative Post-Harvest Machinery Knowledge Dataset"}
                  </div>
                  {selectedItem.product_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleCloseModal();
                        navigate(`/farmer/value-addition/${selectedItem.product_id}`);
                      }}
                    >
                      View Product Processing Guide <ArrowRight size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
