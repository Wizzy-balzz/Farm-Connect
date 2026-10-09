import { memo, useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../services/api.js";
import { Sprout, Tractor, Store, ShoppingBag, Check, ShieldCheck, Star } from "../../components/icons/Icons.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Avatar } from "../../components/common/Avatar.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import PublicHeader from "../../components/layout/PublicHeader.jsx";
import Footer from "../../components/layout/Footer.jsx";
import { formatCurrency } from "../../utils/formatters.js";
import { CATEGORY_IMAGES } from "../../utils/constants.js";

const CATEGORIES_LIST = [
  { name: "Vegetables", icon: "🥬", desc: "Tomatoes, onions, spinach, potatoes" },
  { name: "Grains & Pulses", icon: "🌾", desc: "Basmati rice, wheat, lentils" },
  { name: "Fresh Fruits", icon: "🍎", desc: "Apples, mangoes, bananas, citrus" },
  { name: "Spices & Herbs", icon: "🌶️", desc: "Turmeric, pepper, cardamom" },
  { name: "Organic Produce", icon: "🌿", desc: "Certified chemical-free harvests" },
  { name: "Dairy", icon: "🥛", desc: "Farm milk, butter, organic ghee" },
];

const TESTIMONIALS = [
  {
    name: "Ananya Deshmukh",
    role: "Founder, Ananya's Gourmet Kitchens",
    text: "FarmConnect gives our restaurant complete supply confidence. Harvests arrive fresh, and the wholesale tiers help our margins.",
    rating: 5,
    avatar: "AD"
  },
  {
    name: "Suresh Gowda",
    role: "Producer, Gowda Organic Farms",
    text: "Listing our harvest lots on FarmConnect gives us direct access to commercial buyers. We set fair prices and receive orders promptly.",
    rating: 5,
    avatar: "SG"
  },
  {
    name: "Vikram Ahluwalia",
    role: "Head of Procurement, Le Mer Hotels",
    text: "We source Grade A produce directly from verified farms at better costs. The platform transparency is exactly what procurement teams need.",
    rating: 5,
    avatar: "VA"
  }
];

const VERIFIED_FARMERS = [
  {
    name: "Rajesh Kumar",
    farmName: "Green Valley Farms",
    region: "Nashik, Maharashtra",
    crops: "Tomatoes, Red Onions, Spinach",
    experience: "14 Years",
    rating: 4.8,
  },
  {
    name: "Satish Patil",
    farmName: "Patil Agri Estates",
    region: "Ludhiana, Punjab",
    crops: "Basmati Rice, Durum Wheat",
    experience: "20 Years",
    rating: 4.7,
  },
  {
    name: "Kiran Dev",
    farmName: "Malabar Spices Orchard",
    region: "Wayanad, Kerala",
    crops: "Black Pepper, Cardamom",
    experience: "12 Years",
    rating: 4.5,
  }
];

function LandingPageBase() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [platformStats, setPlatformStats] = useState({ farmers: 0, products: 0, orders: 0 });

  useEffect(() => {
    // Fetch real platform data for stats
    const fetchData = async () => {
      try {
        const [products, orders] = await Promise.all([
          apiFetch("/api/products").catch(() => []),
          apiFetch("/api/orders").catch(() => [])
        ]);
        if (Array.isArray(products)) {
          setFeaturedProducts(products.slice(0, 4));
          const farmerIds = new Set(products.map(p => p.farmerId));
          setPlatformStats(prev => ({ ...prev, products: products.length, farmers: farmerIds.size }));
        }
        if (Array.isArray(orders)) {
          const uniqueOrders = new Set(orders.map(o => o.id));
          setPlatformStats(prev => ({ ...prev, orders: uniqueOrders.size }));
        }
      } catch {
        // Use fallback zeros
      }
    };
    fetchData();
  }, []);

  const goLogin = useCallback(() => navigate("/login"), [navigate]);
  const goRegister = useCallback(() => navigate("/register"), [navigate]);

  return (
    <div className="fc-app">
      <PublicHeader />
      <main style={{ flex: 1 }}>
        {/* ===== HERO ===== */}
        <section className="fc-hero-landing">
          <div className="fc-hero-inner">
            <div className="fc-hero-eyebrow">
              <Sprout size={14} />
              <span>DIRECT FARM-TO-MARKET COMMERCE</span>
            </div>
            <h1 className="fc-hero-title">
              From the Farm to the Market,<br />
              Without the Middle Layers.
            </h1>
            <p className="fc-hero-subtitle">
              FarmConnect connects verified farmers with businesses and buyers through transparent produce listings, fair pricing, and reliable order fulfillment.
            </p>
            <div className="fc-hero-actions">
              <Button size="lg" className="fc-hero-btn-primary" onClick={goLogin}>
                Explore Marketplace
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="fc-hero-btn-secondary"
                onClick={goRegister}
              >
                List Your Harvest
              </Button>
            </div>
          </div>
        </section>

        <div className="fc-container">
          {/* ===== TRUST STRIP ===== */}
          <div className="fc-trust-strip">
            <div className="fc-trust-item">
              <div className="fc-trust-icon-box">
                <ShieldCheck size={20} />
              </div>
              <div className="fc-trust-text">
                <div className="fc-trust-title">Verified Farmers</div>
                <div className="fc-trust-desc">Trusted producers on FarmConnect</div>
              </div>
            </div>

            <div className="fc-trust-item">
              <div className="fc-trust-icon-box">
                <Check size={20} />
              </div>
              <div className="fc-trust-text">
                <div className="fc-trust-title">Transparent Pricing</div>
                <div className="fc-trust-desc">Clear pricing at every listing</div>
              </div>
            </div>

            <div className="fc-trust-item">
              <div className="fc-trust-icon-box">
                <Sprout size={20} />
              </div>
              <div className="fc-trust-text">
                <div className="fc-trust-title">Fresh Harvest Listings</div>
                <div className="fc-trust-desc">Source directly from active harvests</div>
              </div>
            </div>

            <div className="fc-trust-item">
              <div className="fc-trust-icon-box">
                <Store size={20} />
              </div>
              <div className="fc-trust-text">
                <div className="fc-trust-title">Reliable Order Tracking</div>
                <div className="fc-trust-desc">Track every order from placement to delivery</div>
              </div>
            </div>
          </div>

          {/* ===== HOW IT WORKS ===== */}
          <section className="fc-section fc-text-center">
            <h2 className="fc-section-title" style={{ textAlign: "center" }}>How FarmConnect Works</h2>
            <p className="fc-section-subtitle" style={{ textAlign: "center", margin: "0 auto var(--space-8)" }}>
              A simple, transparent process from farm to market.
            </p>
            <div className="fc-steps-grid">
              {[
                { num: "1", title: "Farmers List Harvest", desc: "Upload produce details, set fair prices, and manage availability." },
                { num: "2", title: "Buyers Discover Produce", desc: "Browse verified listings, compare grades, and check wholesale tiers." },
                { num: "3", title: "Buyer Places Order", desc: "Select quantities, review pricing, and confirm procurement orders." },
                { num: "4", title: "Farmer Fulfills Order", desc: "Process, pack, and deliver fresh produce directly to buyers." },
              ].map((step) => (
                <div key={step.num} className="fc-step-card">
                  <div className="fc-step-number">{step.num}</div>
                  <div className="fc-step-title">{step.title}</div>
                  <div className="fc-step-desc">{step.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== FEATURED PRODUCE ===== */}
          {featuredProducts.length > 0 && (
            <section className="fc-section">
              <h2 className="fc-section-title">Featured Produce</h2>
              <p className="fc-section-subtitle">Fresh listings from verified farms.</p>
              <div className="fc-product-grid">
                {featuredProducts.map((p) => {
                  const imgSrc = CATEGORY_IMAGES[p.category] || "/images/farmconnect-produce.jpg";
                  return (
                    <div key={p.id} className="fc-product-card fc-card-hoverable">
                      <div className="fc-product-thumb">
                        <img
                          src={imgSrc}
                          alt={p.name}
                          className="fc-product-thumb-img"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                      <div className="fc-product-body">
                        <div className="fc-product-tags">
                          <span className="fc-tag-category">{p.category}</span>
                          <span className="fc-tag-grade" style={{ background: p.grade === "A" ? "var(--brand)" : "var(--accent)" }}>
                            Grade {p.grade}
                          </span>
                        </div>
                        <div className="fc-product-name">{p.name}</div>
                        <div className="fc-product-footer">
                          <div className="fc-product-price">
                            <strong>{formatCurrency(p.price)}</strong>
                            <span className="fc-product-price-unit"> /{p.unit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ===== BROWSE BY CATEGORY ===== */}
          <section className="fc-section">
            <h2 className="fc-section-title">Browse by Category</h2>
            <p className="fc-section-subtitle">Find the produce your business needs.</p>
            <div className="fc-category-grid">
              {CATEGORIES_LIST.map((cat) => (
                <div key={cat.name} className="fc-category-card" onClick={goLogin} role="button" tabIndex={0}>
                  <span className="fc-category-icon">{cat.icon}</span>
                  <div>
                    <div className="fc-category-name">{cat.name}</div>
                    <div className="fc-category-count">{cat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== VERIFIED FARMERS ===== */}
          <section className="fc-section">
            <h2 className="fc-section-title">Verified Farmers</h2>
            <p className="fc-section-subtitle">Trusted producers on the FarmConnect platform.</p>
            <div className="fc-grid-3">
              {VERIFIED_FARMERS.map((farmer) => (
                <div key={farmer.name} className="fc-card fc-card-pad">
                  <div className="fc-flex-gap-12" style={{ marginBottom: 12 }}>
                    <Avatar name={farmer.name} size={44} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{farmer.name}</div>
                      <div className="fc-muted">{farmer.farmName}</div>
                    </div>
                  </div>
                  <div className="fc-verified-badge" style={{ marginBottom: 12 }}>
                    <Check size={12} /> FarmConnect Verified
                  </div>
                  <div className="fc-muted" style={{ marginBottom: 4 }}>📍 {farmer.region}</div>
                  <div className="fc-muted" style={{ marginBottom: 4 }}>🌱 {farmer.crops}</div>
                  <div className="fc-muted" style={{ marginBottom: 4 }}>📅 {farmer.experience} experience</div>
                  <div className="fc-flex-gap-8" style={{ marginTop: 8 }}>
                    <Star size={14} style={{ color: "var(--accent)" }} />
                    <span style={{ fontWeight: 700, fontSize: "var(--text-sm)" }}>{farmer.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== WHY FARMCONNECT ===== */}
          <section className="fc-section">
            <h2 className="fc-section-title">Why FarmConnect</h2>
            <p className="fc-section-subtitle">Built for farmers, buyers, and agricultural businesses.</p>
            <div className="fc-feature-grid">
              {[
                { icon: <ShieldCheck size={22} />, title: "Verified Farmers", desc: "Every farmer undergoes identity and farm verification before listing." },
                { icon: <Tractor size={22} />, title: "Direct Trade", desc: "No middlemen. Fair prices for farmers, better costs for buyers." },
                { icon: <ShoppingBag size={22} />, title: "Transparent Pricing", desc: "See actual prices with wholesale tier discounts upfront." },
                { icon: <Check size={22} />, title: "Quality Graded", desc: "All produce is graded for transparent quality standards." },
                { icon: <Store size={22} />, title: "Fresh Harvest Listings", desc: "Produce listed with harvest dates and availability info." },
                { icon: <Sprout size={22} />, title: "Reliable Fulfillment", desc: "Track orders from confirmation through delivery." },
              ].map((f, i) => (
                <div key={i} className="fc-feature-card">
                  <div className="fc-feature-icon">{f.icon}</div>
                  <h3 className="fc-h3" style={{ marginBottom: 8 }}>{f.title}</h3>
                  <p className="fc-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ===== ROLE SELECTION ===== */}
          <section className="fc-section fc-text-center">
            <h2 className="fc-section-title" style={{ textAlign: "center" }}>Get Started with FarmConnect</h2>
            <p className="fc-section-subtitle" style={{ textAlign: "center", margin: "0 auto var(--space-6)" }}>
              Choose how you'd like to use the platform.
            </p>
            <div className="fc-role-select-grid">
              <div className="fc-role-card" onClick={goRegister} role="button" tabIndex={0}>
                <div className="fc-role-card-icon" style={{ background: "var(--gradient-hero)" }}>
                  <Tractor size={26} />
                </div>
                <h3 className="fc-h2" style={{ marginBottom: 8 }}>I'm a Farmer</h3>
                <p className="fc-muted" style={{ marginBottom: 16 }}>
                  List your harvest, reach verified buyers, and manage direct sales.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {["List harvest lots with pricing", "Reach verified commercial buyers", "Track orders and earnings"].map((b, i) => (
                    <li key={i} className="fc-flex-gap-8" style={{ marginBottom: 6, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      <Check size={14} style={{ color: "var(--brand)", flexShrink: 0 }} /> {b}
                    </li>
                  ))}
                </ul>
                <Button variant="primary" className="fc-mt-4" style={{ width: "100%" }}>
                  Register as Farmer
                </Button>
              </div>
              <div className="fc-role-card" onClick={goRegister} role="button" tabIndex={0}>
                <div className="fc-role-card-icon" style={{ background: "var(--gradient-accent)" }}>
                  <Store size={26} />
                </div>
                <h3 className="fc-h2" style={{ marginBottom: 8 }}>I'm a Buyer</h3>
                <p className="fc-muted" style={{ marginBottom: 16 }}>
                  Discover fresh produce, compare listings, and manage procurement.
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {["Browse verified produce listings", "Wholesale pricing tiers", "Order tracking and history"].map((b, i) => (
                    <li key={i} className="fc-flex-gap-8" style={{ marginBottom: 6, fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                      <Check size={14} style={{ color: "var(--accent)", flexShrink: 0 }} /> {b}
                    </li>
                  ))}
                </ul>
                <Button variant="accent" className="fc-mt-4" style={{ width: "100%" }}>
                  Register as Buyer
                </Button>
              </div>
            </div>
          </section>

          {/* ===== TESTIMONIALS ===== */}
          <section className="fc-section">
            <h2 className="fc-section-title">What Our Users Say</h2>
            <p className="fc-section-subtitle">Trusted by farmers and buyers across India.</p>
            <div className="fc-testimonial-grid">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="fc-testimonial-card">
                  <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                    {Array.from({ length: t.rating }).map((_, j) => (
                      <Star key={j} size={14} style={{ color: "var(--accent)" }} />
                    ))}
                  </div>
                  <p className="fc-testimonial-text">"{t.text}"</p>
                  <div className="fc-testimonial-author">
                    <Avatar name={t.name} size={36} />
                    <div>
                      <div className="fc-testimonial-name">{t.name}</div>
                      <div className="fc-testimonial-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ===== FINAL CTA ===== */}
          <section className="fc-section fc-text-center" style={{ padding: "48px 24px", background: "var(--bg-soft)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-10)" }}>
            <h2 className="fc-h1" style={{ marginBottom: 12 }}>Ready to Transform Your Supply Chain?</h2>
            <p className="fc-body-lg" style={{ marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
              Join FarmConnect today and experience direct farm-to-market commerce.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Button variant="primary" size="lg" onClick={goRegister}>
                Create Free Account
              </Button>
              <Button variant="outline" size="lg" onClick={goLogin}>
                Sign In
              </Button>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

const LandingPage = memo(LandingPageBase);
export default LandingPage;
