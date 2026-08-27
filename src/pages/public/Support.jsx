import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "../../components/layout/PublicHeader.jsx";
import { Button } from "../../components/common/Button.jsx";
import { FormField } from "../../components/common/FormField.jsx";
import { SearchBox } from "../../components/common/index.js";
import { Sprout, Check, HelpCircle, FileText, Truck, CreditCard, User, ShieldCheck } from "../../components/icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";

const FAQ_CATEGORIES = [
  {
    id: "general",
    label: "General Platform",
    icon: HelpCircle,
    faqs: [
      {
        q: "What is FarmConnect?",
        a: "FarmConnect is a B2B agricultural marketplace connecting verified farmers directly with commercial buyers (restaurants, hotels, canteens, retailers) for fair prices and faster delivery."
      },
      {
        q: "Is registration free for farmers and buyers?",
        a: "Yes! Registration is completely free for both farmers and buyers. No subscription fees or hidden registration charges."
      },
      {
        q: "How does FarmConnect verify farmers?",
        a: "Every grower profile undergoes identity verification, farm location validation, and produce quality screening by platform administrators before receiving the Verified Farmer badge."
      }
    ]
  },
  {
    id: "orders",
    label: "Orders & Logistics",
    icon: Truck,
    faqs: [
      {
        q: "What is MOQ (Minimum Order Quantity)?",
        a: "MOQ is the minimum quantity of a crop lot a grower agrees to sell per order (e.g. 10 kg, 50 kg). It ensures viable freight routing for wholesale trade."
      },
      {
        q: "How does consolidated cold-chain delivery work?",
        a: "Our routing engine groups regional orders within the same delivery corridor into shared freight transport, lowering shipping costs for buyers by up to 30%."
      },
      {
        q: "Can I request bulk custom orders (e.g. 500+ kg)?",
        a: "Yes! Every produce details page features a 'Request Bulk Order' button. Submit your quantity, delivery date, and requirements to receive a customized grower quotation."
      }
    ]
  },
  {
    id: "payments",
    label: "Payments & Pricing",
    icon: CreditCard,
    faqs: [
      {
        q: "What payment methods are accepted?",
        a: "FarmConnect supports UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Cash on Delivery (COD) for verified commercial accounts."
      },
      {
        q: "How do volume tier discounts work?",
        a: "Farmers configure wholesale tier pricing (e.g. 100kg+ gets 10% off). As you increase your order quantity in the cart, price drops are applied automatically."
      }
    ]
  },
  {
    id: "returns",
    label: "Quality & Returns",
    icon: ShieldCheck,
    faqs: [
      {
        q: "What if delivered produce does not match the grade specifications?",
        a: "If produce quality differs from the listed grade upon delivery inspection, submit a quality dispute within 24 hours via Order Tracking to claim a replacement or refund."
      }
    ]
  }
];

function SupportBase() {
  const navigate = useNavigate();
  const { notifySuccess } = useNotifications();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("general");
  const [openFaq, setOpenFaq] = useState(null);

  // Contact Support Form
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      notifySuccess("Support ticket submitted successfully! Our team will respond within 4 hours.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
      setSubmitting(false);
    }, 500);
  };

  const currentCategoryObj = FAQ_CATEGORIES.find((c) => c.id === activeCategory) || FAQ_CATEGORIES[0];

  return (
    <>
      <PublicHeader />
      <div className="fc-container fc-page-transition" style={{ padding: "32px 24px 60px 24px" }}>
        {/* Support Hero Header */}
        <div
          className="fc-hero"
          style={{
            background: "var(--gradient-hero)",
            padding: "48px 36px",
            borderRadius: "var(--radius-lg)",
            color: "#ffffff",
            marginBottom: "36px",
            textAlign: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.2)",
              padding: "4px 14px",
              borderRadius: "999px",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            <HelpCircle size={14} /> FarmConnect Help Center
          </span>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "32px", fontWeight: 800, margin: "0 0 12px 0" }}>
            How can we help you today?
          </h1>
          <p style={{ fontSize: "15px", opacity: 0.9, maxWidth: 540, margin: "0 auto 24px auto", lineHeight: 1.5 }}>
            Find answers to frequently asked questions about orders, payments, grower verifications, and B2B freight logistics.
          </p>

          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <SearchBox
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder="Search help topics (e.g. MOQ, payments, returns)..."
            />
          </div>
        </div>

        {/* Category Tabs Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 36 }}>
          {FAQ_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  border: isActive ? "2px solid var(--brand)" : "1px solid var(--border)",
                  background: isActive ? "var(--brand-light)" : "var(--surface)",
                  color: isActive ? "var(--brand)" : "var(--text)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: isActive ? "var(--brand)" : "var(--bg-soft)", color: isActive ? "#fff" : "var(--brand)", display: "flex", alignItems: "center", justify: "center" }}>
                  <Icon size={18} />
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: 14 }}>{cat.label}</strong>
                  <span className="fc-soft" style={{ fontSize: 11 }}>{cat.faqs.length} articles</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* FAQs Accordion List */}
        <div style={{ maxWidth: 800, margin: "0 auto 60px auto" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
            {currentCategoryObj.label} FAQs
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {currentCategoryObj.faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    style={{
                      width: "100%",
                      padding: "16px 20px",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ fontSize: 18, color: "var(--brand)" }}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && (
                    <div
                      style={{
                        padding: "0 20px 16px 20px",
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        color: "var(--text-muted)",
                        borderTop: "1px solid var(--border)",
                        paddingTop: 12,
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Support Form Section */}
        <div
          className="fc-panel"
          style={{
            maxWidth: 700,
            margin: "0 auto",
            padding: "36px",
            background: "var(--surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 800, margin: "0 0 6px 0" }}>
              Still have questions? Contact Support
            </h2>
            <p className="fc-muted" style={{ fontSize: 13.5, margin: 0 }}>
              Our agricultural support team is available Monday through Saturday, 8 AM - 8 PM IST.
            </p>
          </div>

          <form onSubmit={handleContactSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FormField label="Your Name">
                <input
                  className="fc-input"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  required
                />
              </FormField>

              <FormField label="Email Address">
                <input
                  className="fc-input"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </FormField>
            </div>

            <FormField label="Describe your issue or question">
              <textarea
                className="fc-textarea"
                rows={4}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Details about your order, produce specifications, or grower verification..."
                required
              />
            </FormField>

            <Button type="submit" variant="primary" full disabled={submitting} style={{ padding: "12px", fontWeight: 700 }}>
              {submitting ? "Sending Ticket..." : "Submit Support Ticket →"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

export const Support = memo(SupportBase);
export default Support;
