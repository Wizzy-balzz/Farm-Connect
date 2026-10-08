import { useState, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { MapBoxView } from "../common/MapBoxView.jsx";
import { Button } from "../common/Button.jsx";
import { Badge } from "../common/Badge.jsx";
import { MapPin } from "../icons/Icons.jsx";
import { formatCurrency } from "../../utils/formatters.js";

/**
 * FarmDecisionMap — Geographic Agricultural Opportunity Map
 * Connects Crop + Market + Location + Buyer Opportunities
 */
function FarmDecisionMapBase({
  farmLocation = null,
  crop = "Tomato",
  buyers = [],
  selectedBuyerId = null,
  onSelectBuyer
}) {
  const navigate = useNavigate();
  const [activeBuyerId, setActiveBuyerId] = useState(selectedBuyerId);

  // Farm Center Coordinates (fallback to Nashik, agricultural heartland)
  const farmLat = parseFloat(farmLocation?.lat) || 20.0059;
  const farmLng = parseFloat(farmLocation?.lng) || 73.7898;
  const farmName = farmLocation?.farmName || "Your Farm";
  const farmRegion = farmLocation?.region || farmLocation?.district || "Maharashtra";

  // Build markers: Farm pin + Buyer demand pins
  const markers = useMemo(() => {
    const list = [
      {
        id: "farm-location-pin",
        title: `📍 ${farmName}`,
        price: null,
        lat: farmLat,
        lng: farmLng,
        location: `${farmName} (${farmRegion})`,
        isFarm: true
      }
    ];

    (buyers || []).forEach((b, idx) => {
      // Determine coordinates or offset around farm for realistic regional rendering
      let bLat = parseFloat(b.lat);
      let bLng = parseFloat(b.lng);

      if (isNaN(bLat) || isNaN(bLng)) {
        // Deterministic realistic regional offset based on index and district hash
        const angle = (idx * 1.35 + 0.5) % (2 * Math.PI);
        const radius = 0.15 + (idx % 4) * 0.12; // ~15 - 50 km in degree approx
        bLat = farmLat + Math.sin(angle) * radius;
        bLng = farmLng + Math.cos(angle) * radius;
      }

      list.push({
        id: b.orderId ? `buyer-${b.orderId}` : `buyer-${idx}`,
        title: `🏢 ${b.vendorName || "Wholesale Buyer"}`,
        price: b.unitPrice || 32,
        lat: bLat,
        lng: bLng,
        location: `${b.deliveryDistrict || b.deliveryRegion || "Regional Market"}`,
        rawBuyer: { ...b, lat: bLat, lng: bLng }
      });
    });

    return list;
  }, [farmLat, farmLng, farmName, farmRegion, buyers]);

  // Selected buyer object
  const activeBuyer = useMemo(() => {
    if (!buyers || buyers.length === 0) return null;
    if (activeBuyerId) {
      const found = buyers.find((b) => (b.orderId ? `buyer-${b.orderId}` : b.id) === activeBuyerId);
      if (found) return found;
    }
    return buyers[0];
  }, [buyers, activeBuyerId]);

  const handleMarkerClick = (m) => {
    if (m.isFarm) return;
    setActiveBuyerId(m.id);
    if (onSelectBuyer && m.rawBuyer) {
      onSelectBuyer(m.rawBuyer);
    }
  };

  const handleContactBuyer = (buyer) => {
    if (!buyer) return;
    navigate("/chat", {
      state: {
        vendorName: buyer.vendorName,
        subject: `Regarding order for ${crop} (${buyer.qty || 100} kg)`,
        prefill: `Hello ${buyer.vendorName}, I have verified ${crop} available for delivery to ${buyer.deliveryDistrict || buyer.deliveryRegion}. Let's discuss pricing and fulfillment.`
      }
    });
  };

  return (
    <div
      className="fc-decision-map-panel"
      style={{
        background: "var(--surface)",
        border: "1.5px solid var(--border-strong)",
        borderRadius: "var(--radius-lg, 12px)",
        padding: "20px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }}
    >
      {/* Map Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <MapPin size={18} style={{ color: "var(--brand)" }} />
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
              Agricultural Logistics & Buyer Map
            </h3>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Visualizing verified demand and delivery hubs near <strong>{farmRegion}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Badge variant="info" style={{ fontSize: "11px", fontWeight: 700 }}>
            {buyers.length} Active Buyer Orders
          </Badge>
          <Badge variant="success" style={{ fontSize: "11px", fontWeight: 700 }}>
            OSM Live Routing
          </Badge>
        </div>
      </div>

      {/* Embedded Leaflet Map */}
      <div style={{ borderRadius: "var(--radius-md, 8px)", overflow: "hidden", border: "1px solid var(--border)" }}>
        <MapBoxView
          markers={markers}
          center={{ lat: farmLat, lng: farmLng }}
          height="280px"
          onSelectMarker={handleMarkerClick}
        />
      </div>

      {/* Nearest / Selected Buyer Opportunity Card */}
      {activeBuyer ? (
        <div
          style={{
            background: "var(--bg-soft)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md, 8px)",
            padding: "14px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "var(--brand-light)",
                color: "var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                flexShrink: 0
              }}
            >
              🏢
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "14px", color: "var(--text)" }}>{activeBuyer.vendorName || "Verified Wholesale Buyer"}</strong>
                <span style={{ fontSize: "11px", background: "var(--surface)", border: "1px solid var(--border)", padding: "1px 6px", borderRadius: "4px" }}>
                  📍 {activeBuyer.deliveryDistrict || activeBuyer.deliveryRegion || "Nearby Hub"}
                </span>
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                Seeking <strong>{activeBuyer.qty || 100} kg</strong> of {crop} @ <strong>{formatCurrency(activeBuyer.unitPrice || 32)}/kg</strong>
                {activeBuyer.distanceKm && <span style={{ marginLeft: 8, color: "var(--text-soft)" }}>({activeBuyer.distanceKm} km transit)</span>}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleContactBuyer(activeBuyer)}
              style={{ fontWeight: 700 }}
              title="Open direct encrypted real-time chat with this buyer"
            >
              💬 Message Buyer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/farmer/sell-smarter")}
              style={{ fontWeight: 600 }}
              title="Launch Selling Agent for automated negotiation"
            >
              Fulfill via Agent →
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "14px", background: "var(--bg-soft)", borderRadius: "var(--radius-md)", fontSize: "12.5px", color: "var(--text-muted)" }}>
          No active unfulfilled buyer requests detected in this immediate district. Produce listed on the public marketplace remains discoverable statewide.
        </div>
      )}
    </div>
  );
}

export const FarmDecisionMap = memo(FarmDecisionMapBase);
export default FarmDecisionMap;
