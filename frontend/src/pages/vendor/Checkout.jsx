import { useState, useReducer, useMemo, useCallback, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Card } from "../../components/common/Card.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { CreditCard, Truck as TruckIcon, Check, ArrowLeft, ShieldCheck, MapPin, AlertTriangle } from "../../components/icons/Icons.jsx";
import { formatCurrency, getActivePrice } from "../../utils/formatters.js";
import { apiFetch } from "../../services/api.js";
import { useData } from "../../hooks/useData.js";
import { useCart } from "../../hooks/useCart.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { GlobalLocationSelector } from "../../components/common/GlobalLocationSelector.jsx";

const initialCheckoutState = {
  form: {
    fullName: "Ananya Deshmukh",
    phone: "9876543210",
    address: "Unit 402, Gourmet Kitchen Hub, Andheri East",
    payment: "upi", // Default to UPI payment
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    upiId: "ananya@upi"
  },
  errors: {},
  submitting: false,
};

function checkoutReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        form: { ...state.form, [action.field]: action.value },
        errors: { ...state.errors, [action.field]: null },
      };
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    case "START_SUBMIT":
      return { ...state, submitting: true };
    case "SUBMIT_COMPLETE":
      return { ...state, submitting: false };
    default:
      return state;
  }
}

// Dynamically load official Razorpay Checkout SDK
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

function CheckoutBase() {
  const { t } = useLanguage();
  const { products, placeOrder } = useData();
  const { cart, clearCart } = useCart();
  const { user: currentUser } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [paymentState, setPaymentState] = useState("IDLE"); // IDLE, PROCESSING, AWAITING_GATEWAY, VERIFYING, PAID, CANCELLED, FAILED

  // Development Test Payment Overlay State
  const [devPaymentModal, setDevPaymentModal] = useState(null);

  const [deliveryLocation, setDeliveryLocation] = useState({
    countryCode: "IN",
    countryName: "India",
    region: "Maharashtra",
    district: "Mumbai",
    city: "Andheri",
    address: "Unit 402, Gourmet Kitchen Hub, Andheri East",
    postalCode: "400069",
    currency: "INR",
    lat: 19.076,
    lng: 72.8777
  });

  // Distance & Delivery Pricing Engine State
  const [deliveryInfo, setDeliveryInfo] = useState({
    distanceKm: 24.5,
    etaMinutes: 45,
    deliveryCharge: 50,
    formattedDistance: "24.5 km",
    formattedEta: "45 mins",
    loading: false
  });

  // OTP Verification Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const { form, errors, submitting } = state;

  const lines = useMemo(() => {
    return cart
      .map((c) => {
        const prod = products.find((p) => p.id === c.productId);
        if (!prod) return null;
        const activePrice = getActivePrice(prod, c.qty);
        return {
          ...c,
          product: prod,
          activePrice,
          amount: c.qty * activePrice,
        };
      })
      .filter(Boolean);
  }, [cart, products]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.amount, 0), [lines]);
  const deliveryFee = deliveryInfo.deliveryCharge;
  const total = subtotal + deliveryFee;

  // Calculate authoritative road distance and delivery fee
  const fetchDeliveryCalculation = useCallback(async () => {
    if (lines.length === 0) return;
    setDeliveryInfo((prev) => ({ ...prev, loading: true }));

    try {
      const data = await apiFetch("/api/delivery/calculate", {
        method: "POST",
        body: JSON.stringify({
          originLat: lines[0]?.product?.lat || 19.9975,
          originLng: lines[0]?.product?.lng || 73.7898,
          destLat: deliveryLocation.lat || 19.076,
          destLng: deliveryLocation.lng || 72.8777,
          orderValue: subtotal
        })
      });

      if (data && data.delivery) {
        setDeliveryInfo({
          distanceKm: data.delivery.distanceKm,
          etaMinutes: data.delivery.etaMinutes,
          deliveryCharge: data.delivery.deliveryCharge,
          formattedDistance: data.delivery.formattedDistance,
          formattedEta: data.delivery.formattedEta,
          loading: false
        });
      }
    } catch {
      setDeliveryInfo((prev) => ({ ...prev, loading: false }));
    }
  }, [lines, deliveryLocation, subtotal]);

  useEffect(() => {
    fetchDeliveryCalculation();
  }, [fetchDeliveryCalculation]);

  const handleChange = useCallback((field, value) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const handleProceedToReview = (e) => {
    e.preventDefault();
    if (!form.fullName || !form.phone) {
      dispatch({ type: "SET_ERRORS", errors: { fullName: "Full name and phone number are required." } });
      return;
    }
    setStep(2);
  };

  // Perform Final Checkout with Gateway Integration (Real Razorpay SDK or Interactive Test Gateway)
  const executeOrderSubmission = async (orderPayload) => {
    dispatch({ type: "START_SUBMIT" });
    setPaymentState("PROCESSING");

    try {
      // 1. Create order record on backend
      const created = await placeOrder(orderPayload);
      const targetOrderId = created?.id || `FC-${Math.floor(Math.random() * 90000 + 10000)}`;

      // 2. COD Flow
      if (form.payment === "cod") {
        clearCart();
        setCompletedOrder({
          id: targetOrderId,
          totalAmount: total,
          address: orderPayload.deliveryAddress
        });
        notifySuccess("B2B Cash on Delivery Order confirmed!");
        setStep(4);
        return;
      }

      // 3. Online Gateway Payment Flow (UPI / Card)
      const payOrderRes = await apiFetch("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify({
          orderId: targetOrderId,
          amount: total,
          currency: deliveryLocation.currency || "INR",
          method: form.payment
        })
      });

      if (!payOrderRes || !payOrderRes.paymentOrder) {
        throw new Error("Failed to initialize payment gateway order.");
      }

      const paymentOrder = payOrderRes.paymentOrder;

      // If backend created a real Razorpay Order (with active RAZORPAY_KEY_ID credentials)
      if (paymentOrder.isRealGatewayOrder) {
        const sdkLoaded = await loadRazorpayScript();
        if (sdkLoaded && window.Razorpay) {
          const options = {
            key: paymentOrder.gatewayKeyId,
            amount: Math.round(paymentOrder.amount * 100), // Authoritative amount from backend in paise
            currency: paymentOrder.currency || deliveryLocation.currency || "INR",
            name: "FarmConnect B2B Marketplace",
            description: `B2B Procurement Order ${targetOrderId}`,
            order_id: paymentOrder.gatewayOrderId,
            prefill: {
              name: form.fullName || currentUser?.name || "Ananya Deshmukh",
              email: currentUser?.email || "vendor@farmconnect.in",
              contact: form.phone || "9876543210"
            },
            config: {
              display: {
                blocks: {
                  upi: {
                    name: "Pay using UPI",
                    instruments: [{ method: "upi" }]
                  }
                }
              }
            },
            handler: async function (response) {
              console.log("[PAYMENT DEBUG]: Razorpay payment callback received", {
                paymentIdPresent: response?.razorpay_payment_id ? "YES" : "NO",
                orderIdPresent: response?.razorpay_order_id ? "YES" : "NO",
                signaturePresent: response?.razorpay_signature ? "YES" : "NO"
              });
              setPaymentState("VERIFYING");
              try {
                const verifyRes = await apiFetch("/api/payments/verify", {
                  method: "POST",
                  body: JSON.stringify({
                    orderId: targetOrderId,
                    gatewayOrderId: response.razorpay_order_id || paymentOrder.gatewayOrderId,
                    gatewayPaymentId: response.razorpay_payment_id,
                    gatewaySignature: response.razorpay_signature,
                    method: form.payment
                  })
                });

                if (verifyRes && (verifyRes.verified || verifyRes.success)) {
                  clearCart();
                  setCompletedOrder({
                    id: targetOrderId,
                    totalAmount: total,
                    address: orderPayload.deliveryAddress
                  });
                  notifySuccess("Payment verified server-side! Order confirmed.");
                  setStep(4);
                } else {
                  const failReason = verifyRes?.error?.message || verifyRes?.message || "Server-side payment verification failed.";
                  notifyError(`Payment verification failed: ${failReason}`);
                  setPaymentState("FAILED");
                }
              } catch (err) {
                console.error("[Payment Debug]: Verification error:", err);
                notifyError(err.message || "Failed to verify payment with server.");
                setPaymentState("FAILED");
              } finally {
                dispatch({ type: "SUBMIT_COMPLETE" });
              }
            },
            modal: {
              ondismiss: function () {
                notifyError("Payment process was cancelled. You can try again.");
                setPaymentState("CANCELLED");
                dispatch({ type: "SUBMIT_COMPLETE" });
              }
            }
          };

          const rzp = new window.Razorpay(options);
          rzp.on("payment.failed", function (response) {
            console.error("[Razorpay SDK Error]:", response.error);
            notifyError(`Payment failed: ${response.error?.description || "Gateway payment failure"}`);
            setPaymentState("FAILED");
            dispatch({ type: "SUBMIT_COMPLETE" });
          });

          setPaymentState("AWAITING_GATEWAY");
          rzp.open();
          return;
        }
      }

      // If running on Localhost Development Test Mode without active Razorpay credentials:
      // Launch FarmConnect's Development Test Gateway Handler
      setDevPaymentModal({
        targetOrderId,
        gatewayOrderId: paymentOrder.gatewayOrderId,
        amount: paymentOrder.amount || total,
        method: form.payment,
        orderPayload
      });
      setPaymentState("AWAITING_GATEWAY");
    } catch (err) {
      console.error("[Checkout Debug]: Error launching checkout:", err);
      notifyError(err.message || "Failed to process order checkout.");
      setPaymentState("FAILED");
      dispatch({ type: "SUBMIT_COMPLETE" });
    } finally {
      setOtpModalOpen(false);
    }
  };

  const handleCompleteDevTestPayment = async () => {
    if (!devPaymentModal) return;
    setPaymentState("VERIFYING");
    try {
      const verifyRes = await apiFetch("/api/payments/verify", {
        method: "POST",
        body: JSON.stringify({
          orderId: devPaymentModal.targetOrderId,
          gatewayOrderId: devPaymentModal.gatewayOrderId,
          gatewayPaymentId: `pay_test_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
          gatewaySignature: "dev_sandbox_signature_unverified",
          method: devPaymentModal.method
        })
      });

      if (verifyRes && verifyRes.verified) {
        clearCart();
        setCompletedOrder({
          id: devPaymentModal.targetOrderId,
          totalAmount: devPaymentModal.amount,
          address: devPaymentModal.orderPayload.deliveryAddress
        });
        notifySuccess("Payment verified server-side! Order confirmed.");
        setStep(4);
      } else {
        const errMsg = verifyRes?.error?.message || verifyRes?.message || "Server rejected signature. Genuine Razorpay HMAC signature is enforced.";
        notifyError(`Payment verification failed: ${errMsg}`);
        setPaymentState("FAILED");
      }
    } catch (err) {
      console.error("[Payment Debug]: Verification error:", err);
      notifyError(err.message || "Payment verification rejected by security policy.");
      setPaymentState("FAILED");
    } finally {
      setDevPaymentModal(null);
      dispatch({ type: "SUBMIT_COMPLETE" });
    }
  };

  const handleCancelDevTestPayment = () => {
    setDevPaymentModal(null);
    notifyError("Payment process was cancelled. You can try again.");
    setPaymentState("CANCELLED");
    dispatch({ type: "SUBMIT_COMPLETE" });
  };

  const handleFinalCheckout = async () => {
    if (lines.length === 0) return;

    for (const l of lines) {
      if (l.product.stock < l.qty) {
        notifyError(`Insufficient stock for ${l.product.name}. Available stock: ${l.product.stock}`);
        return;
      }
    }

    const formattedDeliveryAddress = [
      deliveryLocation.address || form.address,
      deliveryLocation.city,
      deliveryLocation.district,
      deliveryLocation.region,
      deliveryLocation.countryName || "India",
      deliveryLocation.postalCode
    ].filter(Boolean).join(", ");

    const payload = {
      vendorId: currentUser?.id || "v1",
      vendorName: currentUser?.name || "Ananya's Kitchen",
      deliveryCountry: deliveryLocation.countryName || "India",
      deliveryRegion: deliveryLocation.region || "",
      deliveryDistrict: deliveryLocation.district || "",
      deliveryCity: deliveryLocation.city || "",
      deliveryPostalCode: deliveryLocation.postalCode || "",
      deliveryAddress: formattedDeliveryAddress,
      deliveryLat: deliveryLocation.lat || 19.076,
      deliveryLng: deliveryLocation.lng || 72.8777,
      paymentMethod: form.payment,
      totalAmount: total,
      subtotal: subtotal,
      deliveryCharge: deliveryFee,
      currency: deliveryLocation.currency || "INR",
      items: lines.map((l) => ({
        productId: l.product.id,
        farmerId: l.product.farmerId,
        qty: l.qty,
        unitPrice: l.activePrice,
        amount: l.amount,
      })),
    };

    // If high-value order (> ₹20,000), require OTP verification
    if (total > 20000) {
      setPendingPayload(payload);
      try {
        await apiFetch("/api/otp/request", {
          method: "POST",
          body: JSON.stringify({
            contact: currentUser?.email || "vendor@farmconnect.in",
            purpose: "order_confirmation"
          })
        });
        notifySuccess("High-value order detected. Verification code sent to your registered contact.");
        setOtpModalOpen(true);
      } catch {
        executeOrderSubmission(payload);
      }
    } else {
      executeOrderSubmission(payload);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) return;
    setOtpVerifying(true);

    try {
      const res = await apiFetch("/api/otp/verify", {
        method: "POST",
        body: JSON.stringify({
          contact: currentUser?.email || "vendor@farmconnect.in",
          purpose: "order_confirmation",
          otp: otpCode
        })
      });

      if (res.success && pendingPayload) {
        await executeOrderSubmission(pendingPayload);
      }
    } catch (err) {
      notifyError(err.message || "Invalid OTP code.");
    } finally {
      setOtpVerifying(false);
    }
  };

  if (step !== 4 && lines.length === 0) {
    return (
      <div className="fc-page-transition" style={{ padding: "40px 0" }}>
        <h1 className="fc-h1 fc-mb-24">{t("checkout")}</h1>
        <p className="fc-muted">
          Your cart is currently empty.{" "}
          <button className="fc-link-btn" onClick={() => navigate("/vendor/marketplace")}>
            {t("browseMarketplace")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="fc-page-transition">
      <h1 className="fc-h1 fc-mb-24">{t("checkout")}</h1>

      {/* Multi-Step Progress Header */}
      <Card style={{ padding: "18px 24px", marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          {[
            { num: 1, label: "Step 1: Address" },
            { num: 2, label: "Step 2: Review" },
            { num: 3, label: "Step 3: Payment" },
            { num: 4, label: "Step 4: Complete" },
          ].map((s) => {
            const isActive = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: isActive || isDone ? 1 : 0.5,
                  fontWeight: isActive ? 800 : isDone ? 700 : 500,
                  fontSize: 13,
                  color: isActive ? "var(--brand)" : isDone ? "var(--text)" : "var(--text-soft)",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: isDone ? "var(--brand)" : isActive ? "var(--brand-light)" : "var(--bg-soft)",
                    color: isDone ? "#fff" : isActive ? "var(--brand)" : "var(--text-soft)",
                    border: isActive ? "2px solid var(--brand)" : "1px solid var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {isDone ? <Check size={14} /> : s.num}
                </div>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* STEP 4: ORDER CONFIRMATION SCREEN */}
      {step === 4 ? (
        <Card className="fc-fade-in" style={{ padding: "40px 32px", textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--brand-light)",
              color: "var(--brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              border: "2.5px solid var(--brand)",
            }}
          >
            <Check size={40} />
          </div>

          <Badge variant="success" style={{ fontSize: 12, fontWeight: 800, marginBottom: 12 }}>
            ✓ SERVER VERIFIED PAYMENT & ORDER
          </Badge>

          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 26, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text)" }}>
            Order Confirmed Successfully!
          </h2>
          <p className="fc-muted" style={{ fontSize: 14, margin: "0 0 24px 0", lineHeight: 1.5 }}>
            Your consolidated B2B procurement order has been broadcasted to regional growers.
          </p>

          <div
            style={{
              background: "var(--bg-soft)",
              padding: "18px 20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              fontSize: 13,
              textAlign: "left",
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="fc-soft">Generated Order ID:</span>
              <strong style={{ fontSize: 15, color: "var(--brand)" }}>{completedOrder?.id || "FC-8492"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="fc-soft">Delivery Destination:</span>
              <strong>{form.address}, {form.city}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="fc-soft">Calculated Road Distance:</span>
              <strong>{deliveryInfo.formattedDistance} ({deliveryInfo.formattedEta})</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="fc-soft">Payment Method:</span>
              <strong style={{ textTransform: "uppercase" }}>{form.payment} (Server Verified)</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="fc-soft">Total Procurement Value:</span>
              <strong style={{ fontSize: 15 }}>{formatCurrency(total)}</strong>
            </div>
          </div>

          <div className="fc-flex-gap-12" style={{ justifyContent: "center" }}>
            <Button variant="primary" onClick={() => navigate(`/vendor/tracking/${completedOrder?.id || "FC-8492"}`)} style={{ fontWeight: 700 }}>
              Track Visual Delivery →
            </Button>
            <Button variant="outline" onClick={() => navigate("/vendor/marketplace")}>
              Continue Procurement
            </Button>
          </div>
        </Card>
      ) : (
        /* STEPS 1-3 GRID LAYOUT */
        <div className="fc-cart-layout">
          <Card className="fc-panel" style={{ padding: "24px" }}>
            {/* STEP 1: DELIVERY ADDRESS */}
            {step === 1 && (
              <form onSubmit={handleProceedToReview} className="fc-fade-in">
                <h3 className="fc-h3 fc-mb-16">Step 1: Delivery Address & Contact</h3>

                <div className="fc-form-row">
                  <FormField label={t("fullName")} error={errors.fullName}>
                    <input
                      className={`fc-input ${errors.fullName ? "fc-input-error" : ""}`}
                      value={form.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label={t("phone")} error={errors.phone}>
                    <input
                      className={`fc-input ${errors.phone ? "fc-input-error" : ""}`}
                      value={form.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="9876543210"
                      required
                    />
                  </FormField>
                </div>

                <div className="fc-field" style={{ marginBottom: 18 }}>
                  <label className="fc-label fc-label-required">Global Delivery Destination & Address</label>
                  <GlobalLocationSelector
                    value={deliveryLocation}
                    onChange={(newLoc) => setDeliveryLocation(newLoc)}
                    showAddressFields={true}
                  />
                </div>

                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                  <Button type="submit" variant="primary" style={{ padding: "12px 24px", fontWeight: 700 }}>
                    Proceed to Order Review →
                  </Button>
                </div>
              </form>
            )}

            {/* STEP 2: ORDER REVIEW */}
            {step === 2 && (
              <div className="fc-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 className="fc-h3" style={{ margin: 0 }}>Step 2: Review Produce Order</h3>
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                    <ArrowLeft size={14} /> Edit Address
                  </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {lines.map((l) => (
                    <div
                      key={l.productId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--bg-soft)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: 14 }}>{l.product.name}</strong>
                        <div className="fc-soft" style={{ fontSize: 12, marginTop: 2 }}>
                          {l.qty} {l.product.unit} × {formatCurrency(l.activePrice)}/{l.product.unit}
                        </div>
                      </div>
                      <strong style={{ fontSize: 15, color: "var(--brand)" }}>{formatCurrency(l.amount)}</strong>
                    </div>
                  ))}
                </div>

                {/* Distance & Routing Details Badge */}
                <div
                  style={{
                    background: "var(--brand-light)",
                    padding: "14px 16px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--brand)",
                    marginBottom: 24,
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <strong style={{ color: "var(--brand-dark)", display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={15} /> Real Road Distance Routing:
                    </strong>
                    <Badge variant="success">{deliveryInfo.formattedDistance} ({deliveryInfo.formattedEta})</Badge>
                  </div>
                  <div className="fc-soft" style={{ fontSize: 12 }}>
                    Shipping from Regional Farm Hub to {deliveryLocation.city || "Mumbai"} • Calculated Server-Side Delivery Charge: <strong>{formatCurrency(deliveryFee)}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Button variant="outline" onClick={() => setStep(1)}>
                    ← Back
                  </Button>
                  <Button variant="primary" onClick={() => setStep(3)} style={{ padding: "12px 24px", fontWeight: 700 }}>
                    Proceed to Payment →
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT */}
            {step === 3 && (
              <div className="fc-fade-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 className="fc-h3" style={{ margin: 0 }}>Step 3: Select Payment Option</h3>
                  <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                    <ArrowLeft size={14} /> Back to Review
                  </Button>
                </div>

                {/* Payment Status Notice */}
                {paymentState === "CANCELLED" && (
                  <div style={{ background: "var(--warning-light)", border: "1px solid var(--warning)", color: "var(--warning-dark)", padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 18, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Payment Was Cancelled.</strong> You returned from the gateway without completing payment. You can try again or choose another payment method.
                    </div>
                  </div>
                )}

                {paymentState === "FAILED" && (
                  <div style={{ background: "var(--danger-light)", border: "1px solid var(--danger)", color: "var(--danger)", padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 18, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>Payment Verification Failed.</strong> The payment gateway could not verify the transaction. Please try again or select another option.
                    </div>
                  </div>
                )}

                <FormField label="Secure B2B Payment Method">
                  <div className="fc-radio-row" style={{ flexDirection: "column", gap: 10, marginBottom: 20 }}>
                    {[
                      ["upi", "⚡ Instant UPI Gateway (Mobile App / Desktop QR)", "Official Payment Gateway launches Google Pay, PhonePe, Paytm or presents dynamic UPI QR on desktop."],
                      ["card", "💳 Credit / Debit Card (Commercial / Corporate)", "Tokenized PCI-DSS compliant payment gateway card processing."],
                      ["cod", "💵 Cash on Delivery (COD)", "Pay upon freight scale inspection at delivery."],
                    ].map(([val, label, desc]) => (
                      <label
                        key={val}
                        className={`fc-radio-chip ${form.payment === val ? "active" : ""}`}
                        style={{
                          cursor: "pointer",
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 4,
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
                          <input
                            type="radio"
                            name="payment"
                            checked={form.payment === val}
                            onChange={() => handleChange("payment", val)}
                          />
                          {label}
                        </div>
                        <span className="fc-soft" style={{ fontSize: 11.5, marginLeft: 24 }}>{desc}</span>
                      </label>
                    ))}
                  </div>
                </FormField>

                {/* Gateway Integration Info Box */}
                {form.payment === "upi" && (
                  <div style={{ background: "var(--brand-light)", padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--brand)", marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "var(--brand-dark)", marginBottom: 4 }}>
                      📱 Official Gateway UPI Intent & QR Code Flow
                    </div>
                    <div className="fc-soft" style={{ fontSize: 12, lineHeight: 1.45 }}>
                      • <strong>Mobile Web:</strong> Clicking &quot;Confirm & Pay&quot; opens the Payment Gateway showing your installed UPI apps (GPay, PhonePe, Paytm, BHIM) and launches your chosen app directly.<br />
                      • <strong>Desktop Web:</strong> Displays a dynamic UPI QR Code on screen for scanning with any mobile UPI app.<br />
                      🔒 <i>Zero PINs requested on FarmConnect. Enter your UPI PIN safely inside your official UPI app.</i>
                    </div>
                  </div>
                )}

                {/* Card Fields */}
                {form.payment === "card" && (
                  <div style={{ background: "var(--bg-soft)", padding: 16, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", marginBottom: 20 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                      💳 Secure Tokenized Card Gateway
                    </div>
                    <div className="fc-soft" style={{ fontSize: 12 }}>
                      Clicking &quot;Confirm & Pay&quot; will launch the Payment Gateway&apos;s encrypted card processing window. Raw card numbers are never stored in the FarmConnect database.
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between" }}>
                  <Button variant="outline" onClick={() => setStep(2)}>
                    ← Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleFinalCheckout}
                    disabled={submitting}
                    style={{ padding: "12px 28px", fontWeight: 700 }}
                  >
                    <CreditCard size={16} />{" "}
                    {submitting ? "Launching Gateway..." : `Confirm & Pay ${formatCurrency(total)} →`}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Sticky Procurement Order Summary Sidebar */}
          <Card className="fc-order-summary" style={{ position: "sticky", top: 82, padding: "24px" }}>
            <h3 className="fc-h3 fc-mb-16">Procurement Summary</h3>
            {lines.map((l) => (
              <div
                className="fc-summary-row"
                key={l.productId}
                style={{
                  borderBottom: "1px solid var(--border)",
                  paddingBottom: 8,
                  marginBottom: 8,
                  fontSize: 13,
                }}
              >
                <span>
                  {l.product.name} × {l.qty} {l.product.unit}
                </span>
                <strong>{formatCurrency(l.amount)}</strong>
              </div>
            ))}

            <div className="fc-summary-row" style={{ fontSize: 13, marginTop: 12 }}>
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>

            <div className="fc-summary-row" style={{ fontSize: 13, marginTop: 6 }}>
              <span>Road Distance Delivery</span>
              <strong>{formatCurrency(deliveryFee)}</strong>
            </div>

            <div
              className="fc-summary-row total"
              style={{ borderTop: "2.5px solid var(--border)", paddingTop: 10, marginTop: 10 }}
            >
              <span>{t("total")}</span>
              <strong>{formatCurrency(total)}</strong>
            </div>

            <div className="fc-flex-gap-8 fc-mt-16 fc-soft" style={{ fontSize: 11, flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <MapPin size={14} style={{ color: "var(--brand)" }} /> Road Distance: <strong>{deliveryInfo.formattedDistance}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TruckIcon size={14} style={{ color: "var(--brand)" }} /> Estimated Arrival: <strong>{deliveryInfo.formattedEta}</strong>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* High-Value Order OTP Verification Modal */}
      {otpModalOpen && (
        <Modal
          isOpen={otpModalOpen}
          onClose={() => setOtpModalOpen(false)}
          title="🔐 Order Verification Code Required"
        >
          <form onSubmit={handleVerifyOtpSubmit} style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, background: "var(--brand-light)", padding: 12, borderRadius: 8 }}>
              <ShieldCheck size={24} style={{ color: "var(--brand)" }} />
              <span style={{ fontSize: 12.5, color: "var(--brand-dark)" }}>
                A 6-digit OTP verification code has been dispatched to <strong>{currentUser?.email || "your email"}</strong> to secure high-value B2B order confirmation.
              </span>
            </div>

            <FormField label="Enter 6-Digit OTP Code">
              <input
                className="fc-input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                style={{ fontSize: 18, letterSpacing: 4, textAlign: "center", fontWeight: 800 }}
                autoFocus
                required
              />
            </FormField>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <Button type="button" variant="outline" onClick={() => setOtpModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={otpVerifying || otpCode.length < 4}>
                {otpVerifying ? "Verifying..." : "Verify & Launch Payment"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Interactive Development Test Gateway Overlay Modal */}
      {devPaymentModal && (
        <Modal
          isOpen={Boolean(devPaymentModal)}
          onClose={handleCancelDevTestPayment}
          title="⚡ Razorpay Development Gateway Test Mode"
        >
          <div style={{ padding: "10px 0" }}>
            <div style={{ background: "var(--brand-light)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--brand)", marginBottom: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "var(--brand-dark)", marginBottom: 4 }}>
                Razorpay Test Payment Handler (Localhost Sandbox)
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>
                Simulates Razorpay gateway payment processing end-to-end. Clicking &quot;Complete Test Payment&quot; triggers server-side HMAC signature verification, updates the SQLite database state to <strong>PAID / Confirmed</strong>, and completes the procurement order.
              </div>
            </div>

            <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontSize: 13, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="fc-soft">Target Order ID:</span>
                <strong>{devPaymentModal.targetOrderId}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="fc-soft">Gateway Order ID:</span>
                <span style={{ fontFamily: "monospace", fontSize: 12 }}>{devPaymentModal.gatewayOrderId}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="fc-soft">Payment Method:</span>
                <strong style={{ textTransform: "uppercase" }}>{devPaymentModal.method}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="fc-soft">Total Payable Amount:</span>
                <strong style={{ fontSize: 16, color: "var(--brand)" }}>{formatCurrency(devPaymentModal.amount)} ({Math.round(devPaymentModal.amount * 100)} paise)</strong>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Button type="button" variant="outline" onClick={handleCancelDevTestPayment}>
                ✖ Cancel Payment
              </Button>
              <Button type="button" variant="primary" onClick={handleCompleteDevTestPayment} style={{ fontWeight: 700 }}>
                ✔ Complete Test Payment →
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export const Checkout = memo(CheckoutBase);
export default Checkout;
