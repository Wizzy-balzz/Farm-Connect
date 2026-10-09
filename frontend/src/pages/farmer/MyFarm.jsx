import { useState, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  StatCard,
  Avatar,
} from "../../components/common/index.js";
import {
  Check,
  Plus,
  Package,
  TrendingUp,
  ClipboardList,
  MapPin,
} from "../../components/icons/Icons.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useData } from "../../hooks/useData.js";
import { formatDate } from "../../utils/formatters.js";
import { MapBoxView } from "../../components/common/MapBoxView.jsx";
import { FarmBoundaryMap } from "../../components/farmer/FarmBoundaryMap.jsx";

const DEFAULT_PLOTS = [
  {
    id: "plot-a",
    name: "Plot A — North Field",
    area: "3.5 Acres",
    crop: "Tomato (Grade A)",
    category: "Vegetables",
    status: "Growing",
    sownDate: "2026-05-12",
    harvestDate: "2026-08-28",
    health: "Excellent (96%)",
    soilType: "Black Alluvial Soil",
  },
  {
    id: "plot-b",
    name: "Plot B — South Basin",
    area: "4.0 Acres",
    crop: "Durum Wheat",
    category: "Grains",
    status: "Harvesting",
    sownDate: "2026-04-01",
    harvestDate: "2026-08-20",
    health: "Ready for Harvest",
    soilType: "Loamy Clay Soil",
  },
  {
    id: "plot-c",
    name: "Plot C — East Terrace",
    area: "2.5 Acres",
    crop: "Red Potato",
    category: "Vegetables",
    status: "Growing",
    sownDate: "2026-06-20",
    harvestDate: "2026-09-15",
    health: "Good (91%)",
    soilType: "Red Sandy Soil",
  },
  {
    id: "plot-d",
    name: "Plot D — West Pasture",
    area: "2.5 Acres",
    crop: "Fallow / Soil Regeneration",
    category: "Other",
    status: "Resting Period",
    sownDate: "—",
    harvestDate: "—",
    health: "Soil Nutrients Recharging",
    soilType: "Enriched Organic Soil",
  },
];

const FARM_ACTIVITIES = [
  {
    id: "act-1",
    date: "2026-08-14",
    title: "Organic Compost Application",
    details: "Applied 500 kg neem-coated organic manure on Plot A (North Field).",
    tag: "Soil Care",
  },
  {
    id: "act-2",
    date: "2026-08-10",
    title: "Drip Irrigation Inspection",
    details: "Automated drip valves inspected and flow rate calibrated to 4.2 L/hr.",
    tag: "Irrigation",
  },
  {
    id: "act-3",
    date: "2026-08-04",
    title: "Soil NPK & pH Testing",
    details: "pH recorded at 6.8 (Optimal). Nitrogen level 185 kg/ha.",
    tag: "Soil Test",
  },
  {
    id: "act-4",
    date: "2026-07-28",
    title: "Produce Quality Grading",
    details: "First batch of Tomato harvested and certified as Grade A lot.",
    tag: "Harvest",
  },
];

function MyFarmBase() {
  const { farmerProfile, user } = useAuth();
  const { products } = useData();
  const navigate = useNavigate();

  const currentFarmerId = farmerProfile?.id || user?.id;

  const myProducts = useMemo(
    () => products.filter((p) => p.farmerId && currentFarmerId && String(p.farmerId) === String(currentFarmerId)),
    [products, currentFarmerId]
  );

  const totalAreaAcres = 12.5;
  const activePlots = DEFAULT_PLOTS.length;
  const activeCropsCount = 3;

  return (
    <div className="fc-page-transition">
      {/* 1. Farm Identity Hero Header */}
      <div
        className="fc-hero"
        style={{
          background: "linear-gradient(rgba(10, 32, 18, 0.78), rgba(5, 19, 11, 0.88)), url('/images/farmconnect-farm.jpg') center/cover no-repeat",
          padding: "36px 32px",
          borderRadius: "var(--radius-lg)",
          color: "#ffffff",
          marginBottom: "24px",
          boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <Avatar name={farmerProfile.name} size="lg" role="farmer" verified />
              <div>
                <span style={{ fontSize: "11.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.9 }}>
                  FARM MANAGEMENT PORTAL
                </span>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 800, margin: 0, lineHeight: 1.2 }}>
                  {farmerProfile.farmName || "Nashik Agrarian Estates"}
                </h1>
              </div>
            </div>
            <p style={{ margin: "6px 0 0 0", opacity: 0.9, fontSize: "14px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <span>📍 {farmerProfile.region || "Nashik District, Maharashtra"}</span>
              <span>•</span>
              <span>📐 Total Land: {totalAreaAcres} Acres</span>
              <span>•</span>
              <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700 }}>
                <Check size={12} style={{ display: "inline", marginRight: 3 }} /> Verified Agrarian Listing
              </span>
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <Button
              variant="outline"
              size="md"
              onClick={() => navigate("/farmer/crop-health")}
              style={{ background: "rgba(255,255,255,0.15)", color: "#ffffff", borderColor: "rgba(255,255,255,0.35)", fontWeight: 600 }}
            >
              🌱 Scan Crop Health
            </Button>
            <Button
              variant="accent"
              size="md"
              onClick={() => navigate("/farmer/products/add")}
              style={{ fontWeight: 700, boxShadow: "var(--shadow-sm)" }}
            >
              <Plus size={15} /> Add Crop Listing
            </Button>
          </div>
        </div>

        {/* State Farmer Registry Integration Readiness Banner */}
        <div
          style={{
            marginTop: "20px",
            background: "rgba(0, 0, 0, 0.25)",
            border: "1.5px dashed rgba(255, 255, 255, 0.4)",
            padding: "12px 16px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12.5px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <strong>🏛️ State Farmer Registry Integration:</strong>{" "}
            <span style={{ opacity: 0.95 }}>
              Registry Status: <em>Not linked</em> (Architecture ready for authorized Tamil Nadu / State Land Record API connection).
            </span>
          </div>
          <Badge variant="neutral" style={{ background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: "10.5px" }}>
            API READY
          </Badge>
        </div>
      </div>

      {/* 2. Farm Overview Stat Cards */}
      <div className="fc-stat-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          label="Total Land Area"
          value={`${totalAreaAcres} Acres`}
          icon={<TrendingUp size={20} />}
          color="var(--brand)"
          bg="var(--brand-light)"
        />
        <StatCard
          label="Cultivated Land Plots"
          value={`${activePlots} Plots`}
          icon={<Package size={20} />}
          color="var(--accent)"
          bg="var(--accent-light)"
        />
        <StatCard
          label="Active Harvest Varieties"
          value={`${activeCropsCount} Crops`}
          icon={<ClipboardList size={20} />}
          color="var(--info)"
          bg="var(--info-light)"
        />
        <StatCard
          label="Market Listings"
          value={`${myProducts.length} Lots`}
          icon={<Check size={20} />}
          color="var(--success)"
          bg="var(--success-light)"
        />
      </div>

      {/* 3. Farm Location & Map Card */}
      <Card style={{ padding: "22px", marginBottom: "24px" }}>
        <CardHeader style={{ marginBottom: "16px", padding: 0 }}>
          <div>
            <h2 className="fc-h2" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={20} style={{ color: "var(--brand)" }} /> Global Farm Location Map
            </h2>
            <p className="fc-muted" style={{ marginTop: "2px", fontSize: "13px" }}>
              {[farmerProfile.city, farmerProfile.district, farmerProfile.region, farmerProfile.countryName || "India"].filter(Boolean).join(", ")}
            </p>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <MapBoxView
            markers={[
              {
                id: "farm-1",
                title: farmerProfile.farmName || "My Farm",
                farmerName: farmerProfile.name,
                city: farmerProfile.city,
                district: farmerProfile.district,
                region: farmerProfile.region,
                countryCode: farmerProfile.countryCode || "IN",
                lat: farmerProfile.lat,
                lng: farmerProfile.lng
              }
            ]}
            center={{ lat: farmerProfile.lat, lng: farmerProfile.lng }}
            height="320px"
          />
        </CardBody>
      </Card>

      {/* 4. Land Plot Cards Grid */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "20px", fontWeight: 800, margin: 0 }}>
              Cultivated Land Plots
            </h2>
            <p className="fc-muted" style={{ fontSize: "13px", margin: "4px 0 0 0" }}>
              Active crop field demarcations, soil status, and harvest schedules.
            </p>
          </div>
          <Badge variant="success" style={{ fontSize: "11px", fontWeight: 700 }}>
            {DEFAULT_PLOTS.length} Active Land Parcels
          </Badge>
        </div>

        <div className="fc-product-grid">
          {DEFAULT_PLOTS.map((plot) => {
            const isResting = plot.status === "Resting Period";
            const isHarvesting = plot.status === "Harvesting";
            return (
              <Card key={plot.id} className="fc-card-hoverable" style={{ padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <Badge variant={isResting ? "neutral" : isHarvesting ? "warning" : "success"}>
                    {plot.status}
                  </Badge>
                  <span className="fc-soft" style={{ fontSize: "11px", fontWeight: 700 }}>
                    {plot.area}
                  </span>
                </div>

                <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--text)" }}>
                  {plot.name}
                </h3>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand)", marginBottom: 12 }}>
                  🌾 Crop: {plot.crop}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "11.5px", color: "var(--text-muted)", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Sown Date:</span>
                    <strong>{plot.sownDate !== "—" ? formatDate(plot.sownDate) : "—"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Est. Harvest:</span>
                    <strong>{plot.harvestDate !== "—" ? formatDate(plot.harvestDate) : "—"}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Soil Type:</span>
                    <strong style={{ color: "var(--text)" }}>{plot.soilType}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Crop Health:</span>
                    <strong style={{ color: isHarvesting ? "var(--accent)" : "var(--brand)" }}>{plot.health}</strong>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Phase 3D-1: AI Crop Health Diagnostics Spotlight */}
      <Card style={{ padding: "18px 22px", marginBottom: "24px", background: "var(--brand-light)", borderColor: "var(--brand)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: "28px" }}>🌿</span>
            <div>
              <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 700, color: "var(--brand-dark)" }}>
                AI Crop Health Diagnostics & Leaf Scanner
              </h4>
              <p className="fc-muted" style={{ margin: 0, fontSize: "12.5px" }}>
                Suspect fungal blights, rust, leaf spots, or nutrient deficiencies in your plots? Snap or upload a leaf photo for instant AI diagnosis.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate("/farmer/crop-health")} style={{ fontWeight: 700 }}>
            Scan Plot Produce →
          </Button>
        </div>
      </Card>

      {/* 4. Crop Timeline & Milestone Growth Tracker */}
      <Card style={{ padding: "22px", marginBottom: "28px" }}>
        <h3 className="fc-h3" style={{ marginBottom: "6px" }}>
          🌱 Crop Growth & B2B Milestone Timeline
        </h3>
        <p className="fc-muted" style={{ fontSize: "13px", marginBottom: "20px" }}>
          Standard Agrarian Lifecycle from soil preparation to verified marketplace lot listing.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "14px",
            position: "relative",
          }}
        >
          {[
            { step: "01", title: "Soil Preparation", desc: "NPK testing & organic compost conditioning", status: "Done" },
            { step: "02", title: "Sowing & Germination", desc: "High-yield seed plantation", status: "Done" },
            { step: "03", title: "Drip Irrigation", desc: "Automated fertigation & pest care", status: "Active" },
            { step: "04", title: "Harvest & Grading", desc: "Quality inspection for Grade A sorting", status: "Upcoming" },
            { step: "05", title: "Marketplace Listing", desc: "B2B lot published with transparent tiers", status: "Upcoming" },
          ].map((item, idx) => {
            const isDone = item.status === "Done";
            const isActive = item.status === "Active";
            return (
              <div
                key={idx}
                style={{
                  background: isActive ? "var(--brand-light)" : "var(--bg-soft)",
                  border: isActive ? "1.5px solid var(--brand)" : "1px solid var(--border)",
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: isActive ? "var(--brand)" : "var(--text-soft)" }}>
                    STAGE {item.step}
                  </span>
                  <Badge variant={isDone ? "success" : isActive ? "info" : "neutral"} style={{ fontSize: "9.5px" }}>
                    {item.status}
                  </Badge>
                </div>
                <strong style={{ fontSize: "13.5px", display: "block", color: "var(--text)", marginBottom: 4 }}>
                  {item.title}
                </strong>
                <p className="fc-soft" style={{ fontSize: "11.5px", margin: 0, lineHeight: 1.4 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 5. Farm Activity Log & 6. Farm Statistics Grid */}
      <div className="fc-grid-2" style={{ marginBottom: "28px" }}>
        {/* Farm Activity Log */}
        <Card style={{ padding: "22px" }}>
          <h3 className="fc-h3" style={{ marginBottom: "16px" }}>
            🚜 Recent Farm Activity & Care Log
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {FARM_ACTIVITIES.map((act) => (
              <div
                key={act.id}
                style={{
                  display: "flex",
                  gap: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    background: "var(--brand-light)",
                    color: "var(--brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <strong style={{ fontSize: "13px", color: "var(--text)" }}>{act.title}</strong>
                    <Badge variant="info" style={{ fontSize: "9.5px" }}>{act.tag}</Badge>
                  </div>
                  <p className="fc-muted" style={{ fontSize: "12px", margin: "2px 0 4px 0", lineHeight: 1.4 }}>
                    {act.details}
                  </p>
                  <span className="fc-soft" style={{ fontSize: "10.5px" }}>
                    Logged on {formatDate(act.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Farm Statistics */}
        <Card style={{ padding: "22px" }}>
          <h3 className="fc-h3" style={{ marginBottom: "16px" }}>
            📊 Farm Performance & Yield Metrics
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "6px" }}>
                <span>Crop Health Index</span>
                <strong style={{ color: "var(--brand)" }}>94.2% Optimal</strong>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: "94.2%", height: "100%", background: "var(--brand)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "6px" }}>
                <span>Land Utilization Rate</span>
                <strong style={{ color: "var(--accent)" }}>80.0% Cultivated (10 Acres)</strong>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: "80%", height: "100%", background: "var(--accent)", borderRadius: "4px" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "6px" }}>
                <span>Organic Soil Nutrient Balance (NPK)</span>
                <strong style={{ color: "var(--info)" }}>6.8 pH (Balanced)</strong>
              </div>
              <div style={{ width: "100%", height: "8px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: "88%", height: "100%", background: "var(--info)", borderRadius: "4px" }} />
              </div>
            </div>

            <div
              style={{
                marginTop: "10px",
                background: "var(--bg-soft)",
                padding: "14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
                🎯 Projected Harvest Output (Q3 2026)
              </div>
              <p className="fc-muted" style={{ fontSize: "11.5px", margin: 0 }}>
                Estimated total lot harvest of <strong>4,200 kg</strong> Tomatoes & Wheat expected across Plot A & Plot B before September.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* 7. Interactive Farm Boundary & GIS Demarcation */}
      <FarmBoundaryMap
        farmerCoordinates={{ lat: farmerProfile?.lat, lng: farmerProfile?.lng }}
        farmName={farmerProfile?.farmName || "My Farm"}
      />
    </div>
  );
}

export const MyFarm = memo(MyFarmBase);
export default MyFarm;
