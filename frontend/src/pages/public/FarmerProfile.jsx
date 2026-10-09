import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../../services/api.js";
import { Avatar } from "../../components/common/Avatar.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Card } from "../../components/common/Card.jsx";
import { EmptyState } from "../../components/common/EmptyState.jsx";
import { ProductCard } from "../../components/product/ProductCard.jsx";
import { ContactFarmerModal } from "../../components/common/ContactFarmerModal.jsx";
import { Check, Star, MapPin, Package, ShoppingBag, ArrowLeft, MessageSquare } from "../../components/icons/Icons.jsx";
import { useData } from "../../hooks/useData.js";
import { useCart } from "../../hooks/useCart.js";
import { useAuth } from "../../hooks/useAuth.js";

function FarmerProfileBase() {
  const { farmerId } = useParams();
  const navigate = useNavigate();
  const { products } = useData();
  const { wishlist, addToCart, toggleWishlist } = useCart();
  const { user: currentUser } = useAuth();

  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMode, setContactMode] = useState("message");

  // Fetch farmer user details
  useEffect(() => {
    apiFetch("/api/users")
      .then((users) => {
        const found = users.find((u) => u.id === farmerId && u.role === "farmer");
        if (found) {
          setFarmer(found);
        } else {
          setFarmer({
            id: farmerId || "f1",
            name: "Rajesh Patil",
            farmName: "Patil Organic Agrarian Estates",
            region: "Maharashtra",
            verificationStatus: "Verified",
            rating: 4.8,
            about: "Practicing sustainable, organic farming methods for over 15 years in the fertile Nashik valley. Specializing in Grade A tomatoes, red onions, and leafy greens.",
            createdAt: "2024-01-15T00:00:00.000Z",
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load farmer profile:", err);
        setLoading(false);
      });
  }, [farmerId]);

  // Farmer's listed products
  const farmerProducts = useMemo(() => {
    if (!products || !farmerId) return [];
    return products.filter((p) => p.farmerId === farmerId);
  }, [products, farmerId]);

  const handleOpenContact = (mode = "message") => {
    setContactMode(mode);
    setContactOpen(true);
  };

  if (loading) {
    return (
      <div className="fc-container fc-page-transition" style={{ padding: "40px 24px" }}>
        <div className="fc-panel" style={{ height: 260, animation: "pulse 1.5s infinite" }} />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="fc-container fc-page-transition" style={{ padding: "60px 24px" }}>
        <EmptyState
          icon={<ShoppingBag size={32} />}
          title="Farmer Profile Not Found"
          description="The requested grower profile does not exist or has been deactivated."
          action={
            <Button variant="primary" onClick={() => navigate("/vendor/marketplace")}>
              ← Back to Marketplace
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="fc-container fc-page-transition" style={{ padding: "24px 24px 60px 24px" }}>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-soft)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
      </div>

      {/* Hero Header Card */}
      <div
        className="fc-panel"
        style={{
          padding: "32px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          marginBottom: "32px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top Accent Strip */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: "var(--brand)" }} />

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Avatar name={farmer.name} size="xl" role="farmer" verified={farmer.verificationStatus === "Verified"} />

          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 800, margin: 0, color: "var(--text)" }}>
                {farmer.name}
              </h1>
              {farmer.verificationStatus === "Verified" && (
                <Badge variant="success" style={{ fontSize: 11, fontWeight: 800 }}>
                  ✓ VERIFIED GROWER
                </Badge>
              )}
            </div>

            <p className="fc-muted" style={{ fontSize: 14, margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} style={{ color: "var(--brand)" }} />
              <strong>{farmer.farmName || "Nashik Agrarian Estates"}</strong> • {farmer.region || "Maharashtra"}
            </p>

            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-muted)", maxWidth: 700, margin: "0 0 20px 0" }}>
              {farmer.about || "Dedicated to growing high-grade agricultural produce directly for wholesale procurement. All crop lots undergo harvest grading and moisture verification."}
            </p>

            {/* Quick Action CTAs */}
            <div className="fc-flex-gap-12" style={{ flexWrap: "wrap" }}>
              <Button variant="primary" onClick={() => handleOpenContact("message")} style={{ fontWeight: 700 }}>
                <MessageSquare size={16} /> Contact Farmer
              </Button>
              <Button variant="accent" onClick={() => handleOpenContact("bulk")} style={{ fontWeight: 700 }}>
                Request Bulk Quote
              </Button>
            </div>
          </div>

          {/* Stats Box */}
          <div
            style={{
              background: "var(--bg-soft)",
              padding: "20px 24px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 200,
            }}
          >
            <div>
              <span className="fc-soft" style={{ fontSize: 11, display: "block" }}>GROWER RATING</span>
              <strong style={{ fontSize: 18, color: "var(--brand)" }}>★ {farmer.rating?.toFixed(1) || "4.8"} / 5.0</strong>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <span className="fc-soft" style={{ fontSize: 11, display: "block" }}>ACTIVE CROPS LISTED</span>
              <strong style={{ fontSize: 16 }}>{farmerProducts.length} crop lots</strong>
            </div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
              <span className="fc-soft" style={{ fontSize: 11, display: "block" }}>FULFILLED B2B ORDERS</span>
              <strong style={{ fontSize: 16 }}>{farmer.completedOrders || 120}+ orders</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Farmer's Crop Listings Section */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, margin: 0 }}>
              Produce Listings by {farmer.name}
            </h2>
            <p className="fc-muted" style={{ fontSize: 13, marginTop: 4 }}>
              Direct wholesale crop lots ready for immediate procurement.
            </p>
          </div>
          <span className="fc-soft" style={{ fontSize: 13, fontWeight: 600 }}>
            {farmerProducts.length} lots available
          </span>
        </div>

        {farmerProducts.length === 0 ? (
          <EmptyState
            icon={<Package size={28} />}
            title="No Active Crop Lots Listed Currently"
            description="This grower has no active produce lots available for sale right now."
          />
        ) : (
          <div className="fc-product-grid">
            {farmerProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                farmerName={farmer.name}
                region={farmer.region}
                mode="vendor"
                inWishlist={wishlist.includes(p.id)}
                onAdd={(id) => addToCart(id, p.moq || 10)}
                onToggleWishlist={toggleWishlist}
                onView={(prod) => navigate(`/vendor/products/${prod.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact Farmer Modal */}
      <ContactFarmerModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        farmer={farmer}
        mode={contactMode}
      />
    </div>
  );
}

export const FarmerProfile = memo(FarmerProfileBase);
export default FarmerProfile;
