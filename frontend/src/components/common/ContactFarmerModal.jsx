import { useState, useCallback, memo } from "react";
import { Modal } from "./Modal.jsx";
import { Button } from "./Button.jsx";
import { FormField } from "./FormField.jsx";
import { Badge } from "./Badge.jsx";
import { Check, Truck } from "../icons/Icons.jsx";
import { useNotifications } from "../../hooks/useNotifications.js";
import { useAuth } from "../../hooks/useAuth.js";
import { formatCurrency } from "../../utils/formatters.js";

function ContactFarmerModalBase({ open, onClose, farmer, product, mode = "message" }) {
  const { notifySuccess } = useNotifications();
  const { user: currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState(mode); // "message" | "bulk"

  // Message Form State
  const [subject, setSubject] = useState("Product Availability Inquiry");
  const [message, setMessage] = useState("");

  // Bulk Order Form State
  const [bulkQty, setBulkQty] = useState(product ? (product.moq || 10) * 5 : 500);
  const [requiredDate, setRequiredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [deliveryLocation, setDeliveryLocation] = useState(currentUser?.region || "Mumbai / Thane");
  const [bulkNotes, setBulkNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!farmer) return null;

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      notifySuccess(`Message sent directly to ${farmer.name}! They will reply in your workspace inbox.`);
      setMessage("");
      setSubmitting(false);
      onClose();
    }, 450);
  };

  const handleSendBulkRequest = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      notifySuccess(
        `Bulk Order Request for ${bulkQty} ${product ? product.unit : "kg"} submitted to ${farmer.name}! Status: Pending Approval.`
      );
      setBulkNotes("");
      setSubmitting(false);
      onClose();
    }, 500);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Contact Farmer — ${farmer.name}`}
      width={560}
    >
      <div style={{ paddingRight: 4 }}>
        {/* Header Farmer Info Card */}
        <div
          style={{
            background: "var(--bg-soft)",
            padding: "14px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong style={{ fontSize: 14, color: "var(--text)" }}>{farmer.name}</strong>
              {farmer.verificationStatus === "Verified" && (
                <Badge variant="success" style={{ fontSize: 10 }}>
                  ✓ Verified Grower
                </Badge>
              )}
            </div>
            <div className="fc-soft" style={{ fontSize: 12, marginTop: 2 }}>
              {farmer.farmName || "Agrarian Produce Farm"} • {farmer.region || "Maharashtra"}
            </div>
          </div>
          {product && (
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <span className="fc-soft" style={{ display: "block", fontSize: 10 }}>INQUIRING FOR</span>
              <strong>{product.name}</strong>
            </div>
          )}
        </div>

        {/* Mode Switcher Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            className={`fc-radio-chip ${activeTab === "message" ? "active" : ""}`}
            onClick={() => setActiveTab("message")}
            style={{ padding: "10px", textAlign: "center", fontWeight: 700, fontSize: 13 }}
          >
            💬 General Message
          </button>
          <button
            type="button"
            className={`fc-radio-chip ${activeTab === "bulk" ? "active" : ""}`}
            onClick={() => setActiveTab("bulk")}
            style={{ padding: "10px", textAlign: "center", fontWeight: 700, fontSize: 13 }}
          >
            📦 Bulk Order Request
          </button>
        </div>

        {/* TAB 1: GENERAL MESSAGE FORM */}
        {activeTab === "message" && (
          <form onSubmit={handleSendMessage} className="fc-fade-in">
            <FormField label="Inquiry Topic">
              <select
                className="fc-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value="Product Availability Inquiry">Product Availability Inquiry</option>
                <option value="Harvest & Freshness Details">Harvest & Freshness Schedule</option>
                <option value="Delivery & Logistics Coordination">Delivery & Logistics Coordination</option>
                <option value="Custom Wholesale Agreement">Custom Wholesale Price Agreement</option>
              </select>
            </FormField>

            <FormField label="Your Message / Question">
              <textarea
                className="fc-textarea"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi! We operate a canteen in Mumbai and would like to ask about weekly supply availability and packaging specifications..."
                required
              />
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting} style={{ fontWeight: 700 }}>
                {submitting ? "Sending Message..." : "Send Message to Farmer →"}
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: BULK ORDER REQUEST FORM */}
        {activeTab === "bulk" && (
          <form onSubmit={handleSendBulkRequest} className="fc-fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label={`Quantity Needed (${product ? product.unit : "kg"})`}>
                <input
                  className="fc-input"
                  type="number"
                  min={product ? product.moq : 50}
                  value={bulkQty}
                  onChange={(e) => setBulkQty(Number(e.target.value))}
                  required
                />
              </FormField>

              <FormField label="Required Delivery Date">
                <input
                  className="fc-input"
                  type="date"
                  value={requiredDate}
                  onChange={(e) => setRequiredDate(e.target.value)}
                  required
                />
              </FormField>
            </div>

            <FormField label="Delivery Hub / Canteen Location">
              <input
                className="fc-input"
                type="text"
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                placeholder="e.g. Andheri East Commercial Kitchen, Mumbai"
                required
              />
            </FormField>

            <FormField label="Specific Grade or Packaging Notes (Optional)">
              <textarea
                className="fc-textarea"
                rows={3}
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                placeholder="Require Grade A uniform size produce packed in 25kg reusable crates..."
              />
            </FormField>

            {product && (
              <div
                style={{
                  background: "var(--brand-light)",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--brand-border)",
                  fontSize: 12.5,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <span>Estimated Bulk Quotation ({bulkQty} {product.unit}):</span>
                <strong style={{ fontSize: 15, color: "var(--brand)" }}>
                  {formatCurrency(product.price * bulkQty * 0.9)} <span style={{ fontSize: 10, opacity: 0.8 }}>(10% Wholesale Savings)</span>
                </strong>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={submitting} style={{ fontWeight: 700 }}>
                {submitting ? "Submitting Request..." : "Submit Bulk Order Request →"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export const ContactFarmerModal = memo(ContactFarmerModalBase);
export default ContactFarmerModal;
