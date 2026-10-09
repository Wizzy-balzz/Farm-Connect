import { useState, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Sprout, Tractor, Store, AlertTriangle, CheckCircle, ShieldCheck } from "../../components/icons/Icons.jsx";
import PublicHeader from "../../components/layout/PublicHeader.jsx";
import { SECURITY_QUESTIONS } from "../../utils/constants.js";
import { GlobalLocationSelector } from "../../components/common/GlobalLocationSelector.jsx";
import { apiFetch } from "../../services/api.js";

function RegisterBase() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  // Unified Account Role State: "farmer" | "vendor" (Defaults to "farmer")
  const [role, setRole] = useState("farmer");

  // Form State
  const [form, setForm] = useState({
    // Common Details
    name: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",

    // Farmer Details
    farmName: "",
    farmSize: "",
    farmingExperience: "",
    cropsGrown: "",
    primaryCrop: "",
    expectedQuantity: "",

    // Vendor Details
    businessName: "",
    businessType: "Wholesaler",
    gstin: "",
    procurementCategories: "",
    procurementQuantity: "",

    // General Profile & Security
    about: "",
    securityQuestion: SECURITY_QUESTIONS[0],
    securityAnswer: ""
  });

  const [locationObj, setLocationObj] = useState({
    countryCode: "IN",
    countryName: "India",
    region: "",
    district: "",
    city: "",
    address: "",
    postalCode: "",
    currency: "INR"
  });

  // Email OTP Verification State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Terms & Conditions Acceptance State
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setApiError("");
    if (field === "email") {
      setOtpSent(false);
      setOtpCode("");
      setEmailVerified(false);
    }
  }, []);

  // Role Switch Handler: switches role and clears non-applicable fields
  const handleRoleChange = useCallback((newRole) => {
    setRole(newRole);
    setApiError("");
    setErrors({});
    if (newRole === "farmer") {
      setForm((prev) => ({
        ...prev,
        businessName: "",
        businessType: "Wholesaler",
        gstin: "",
        procurementCategories: "",
        procurementQuantity: ""
      }));
    } else if (newRole === "vendor") {
      setForm((prev) => ({
        ...prev,
        farmName: "",
        farmSize: "",
        farmingExperience: "",
        cropsGrown: "",
        primaryCrop: "",
        expectedQuantity: ""
      }));
    }
  }, []);

  // Request Email OTP Verification Code
  const handleSendEmailOtp = useCallback(async () => {
    const enteredEmail = form.email.trim();
    if (!enteredEmail || !/\S+@\S+\.\S+/.test(enteredEmail)) {
      setErrors((prev) => ({ ...prev, email: "Please enter a valid email address first." }));
      return;
    }
    setOtpSending(true);
    setApiError("");
    setErrors((prev) => ({ ...prev, email: "", otpCode: "" }));
    try {
      const res = await apiFetch("/api/otp/request", {
        method: "POST",
        body: JSON.stringify({ contact: enteredEmail, purpose: "registration_verification" })
      });
      if (res && res.success) {
        setOtpSent(true);
        setOtpCode("");
        notifySuccess("OTP email sent. Please check your inbox or spam folder.");
      } else {
        throw new Error(res?.message || "Failed to send verification code. Please try again.");
      }
    } catch (err) {
      setOtpSent(false);
      const msg = err.message || "Unable to send verification code. Please try again.";
      setApiError(msg);
      setErrors((prev) => ({ ...prev, email: msg }));
      notifyError(msg);
    } finally {
      setOtpSending(false);
    }
  }, [form.email, notifySuccess, notifyError]);

  // Verify Email OTP Verification Code
  const handleVerifyEmailOtp = useCallback(async () => {
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setErrors((prev) => ({ ...prev, otpCode: "Please enter the complete 6-digit OTP code." }));
      return;
    }
    setOtpVerifying(true);
    setApiError("");
    setErrors((prev) => ({ ...prev, otpCode: "" }));
    try {
      await apiFetch("/api/otp/verify", {
        method: "POST",
        body: JSON.stringify({ contact: form.email.trim(), purpose: "registration_verification", otp: cleanOtp })
      });
      setEmailVerified(true);
      setOtpSent(false);
      notifySuccess("Email address verified successfully!");
    } catch (err) {
      setErrors((prev) => ({ ...prev, otpCode: err.message || "Invalid OTP code." }));
      notifyError(err.message || "OTP verification failed.");
    } finally {
      setOtpVerifying(false);
    }
  }, [form.email, otpCode, notifySuccess, notifyError]);

  const validateForm = useCallback(() => {
    const errs = {};

    // Common Details Validation
    if (!form.name.trim()) errs.name = "Full Name is required.";
    if (!form.email.trim()) errs.email = "Email Address is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Please enter a valid email address.";
    else if (!emailVerified) errs.email = "Email OTP verification is required before registration.";

    if (!form.password) errs.password = "Password is required.";
    else if (form.password.length < 6) errs.password = "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match.";

    if (!form.securityAnswer.trim()) errs.securityAnswer = "Security answer is required.";

    // Dynamic Role-Specific Validation
    if (role === "farmer") {
      if (!form.farmName.trim()) errs.farmName = "Farm Name is required.";
      if (!form.cropsGrown.trim()) errs.cropsGrown = "Please specify crops/products grown.";
    } else if (role === "vendor") {
      if (!form.businessName.trim()) errs.businessName = "Business/Company Name is required.";
      if (!form.procurementCategories.trim()) errs.procurementCategories = "Please specify produce categories required.";
    }

    // Location Validation
    const cCode = locationObj.countryCode || "IN";
    if (!cCode) {
      errs.location = "Please select your country.";
    } else if (!locationObj.region || !locationObj.region.trim()) {
      errs.location = "Please select your state or region.";
    } else if (!locationObj.city || !locationObj.city.trim()) {
      errs.location = "Please enter your city/town/village.";
    } else if (!locationObj.address || !locationObj.address.trim()) {
      errs.location = "Please enter your street address.";
    } else if (!locationObj.postalCode || !locationObj.postalCode.trim()) {
      errs.location = "Please enter your postal/pincode.";
    }

    // Terms Acceptance Validation
    if (!termsAccepted) {
      errs.terms = "You must agree to the Terms & Conditions and Privacy Policy.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, role, locationObj, termsAccepted, emailVerified]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setApiError("");

      if (!validateForm()) {
        return;
      }

      setLoading(true);

      try {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          mobile: form.mobile.trim(),
          password: form.password,
          role: role === "farmer" ? "farmer" : "vendor",

          // Verification & Terms Status
          termsAccepted: true,
          emailVerified: emailVerified,
          mobileVerified: false,

          // Role-Specific Payload
          farmName: role === "farmer" ? form.farmName.trim() || null : null,
          farmSize: role === "farmer" ? form.farmSize.trim() || null : null,
          farmingExperience: role === "farmer" ? form.farmingExperience.trim() || null : null,
          cropsGrown: role === "farmer" ? form.cropsGrown.trim() || null : null,
          primaryCrop: role === "farmer" ? form.primaryCrop.trim() || null : null,
          expectedQuantity: role === "farmer" ? form.expectedQuantity.trim() || null : null,

          businessName: role === "vendor" ? form.businessName.trim() || null : null,
          businessType: role === "vendor" ? form.businessType || null : null,
          gstin: role === "vendor" ? form.gstin.trim() || null : null,
          procurementCategories: role === "vendor" ? form.procurementCategories.trim() || null : null,
          procurementQuantity: role === "vendor" ? form.procurementQuantity.trim() || null : null,

          // Location Payload
          countryCode: locationObj.countryCode || "IN",
          countryName: locationObj.countryName || "India",
          region: locationObj.region || null,
          district: locationObj.district || null,
          city: locationObj.city || null,
          postalCode: locationObj.postalCode || null,
          address: locationObj.address || null,
          lat: locationObj.lat || null,
          lng: locationObj.lng || null,
          currency: locationObj.currency || "INR",

          about: form.about || null,
          securityQuestion: form.securityQuestion,
          securityAnswer: form.securityAnswer.trim()
        });

        notifySuccess("Account created successfully!");
        navigate(role === "farmer" ? "/farmer/dashboard" : "/vendor/dashboard", { replace: true });
      } catch (err) {
        setApiError(err.message || "Registration failed. Please try again.");
        notifyError(err.message || "Registration failed.");
      } finally {
        setLoading(false);
      }
    },
    [form, role, locationObj, emailVerified, validateForm, register, navigate, notifySuccess, notifyError]
  );

  return (
    <>
      <PublicHeader />
      <div
        className="fc-page-transition"
        style={{
          minHeight: "calc(100vh - 70px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 20px",
          background: "linear-gradient(rgba(5, 45, 24, 0.55), rgba(5, 25, 14, 0.70)), url('/images/farmconnect-farm.jpg') center/cover no-repeat fixed"
        }}
      >
        <div style={{ maxWidth: "680px", width: "100%" }}>
          <div className="fc-card fc-card-pad-lg fc-slide-up" style={{ padding: "36px 32px", borderRadius: "var(--radius-lg)" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="fc-flex-center" style={{ gap: 8, marginBottom: 10 }}>
                <Sprout size={24} style={{ color: "var(--brand)" }} />
                <span style={{ fontWeight: 800, fontSize: "20px", fontFamily: "var(--font-heading)" }}>FarmConnect</span>
              </div>
              <h1 className="fc-h2" style={{ margin: "0 0 6px 0", fontSize: "26px", fontWeight: 800 }}>
                Create Your Account
              </h1>
              <p className="fc-muted" style={{ margin: 0, fontSize: "14px" }}>
                Join FarmConnect and get started with direct agricultural trade.
              </p>
            </div>

            {/* Error Banner */}
            {apiError && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--danger-light)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", marginBottom: 24, fontSize: "13.5px", color: "var(--danger)", fontWeight: 600 }}>
                <AlertTriangle size={18} /> <span>{apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ACCOUNT TYPE SELECTOR */}
              <div className="fc-field" style={{ marginBottom: 28 }}>
                <label className="fc-label fc-label-required" style={{ fontWeight: 700, marginBottom: 10, display: "block" }}>
                  Account Type
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <button
                    type="button"
                    onClick={() => handleRoleChange("farmer")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      border: role === "farmer" ? "2px solid var(--brand)" : "1px solid var(--border)",
                      background: role === "farmer" ? "var(--brand-light)" : "var(--surface)",
                      color: role === "farmer" ? "var(--brand)" : "var(--text)",
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  >
                    <Tractor size={20} /> 🌾 Farmer
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange("vendor")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: "14px 18px",
                      borderRadius: "var(--radius-md)",
                      border: role === "vendor" ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: role === "vendor" ? "rgba(224, 138, 36, 0.12)" : "var(--surface)",
                      color: role === "vendor" ? "var(--accent)" : "var(--text)",
                      fontWeight: 700,
                      fontSize: "15px",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                  >
                    <Store size={20} /> 🏪 Vendor
                  </button>
                </div>
              </div>

              <hr style={{ border: "0.5px solid var(--border)", margin: "0 0 24px 0" }} />

              {/* COMMON ACCOUNT DETAILS */}
              <h3 className="fc-h3" style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
                Common Account Details
              </h3>

              {/* FULL NAME */}
              <FormField label={role === "farmer" ? "Full Name" : "Contact Person Name"} error={errors.name}>
                <input
                  className={`fc-input ${errors.name ? "fc-input-error" : ""}`}
                  type="text"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  required
                />
              </FormField>

              {/* EMAIL ADDRESS WITH OTP VERIFICATION */}
              <FormField label="Email Address" error={errors.email}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className={`fc-input ${errors.email ? "fc-input-error" : ""}`}
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    disabled={emailVerified}
                    required
                  />
                  {!emailVerified && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendEmailOtp}
                      disabled={otpSending || !form.email.trim() || !/\S+@\S+\.\S+/.test(form.email.trim())}
                      style={{ whiteSpace: "nowrap", padding: "0 14px", fontSize: "13px" }}
                    >
                      {otpSending ? "Sending..." : (otpSent ? "Resend OTP" : "Send OTP")}
                    </Button>
                  )}
                </div>
              </FormField>

              {/* EMAIL OTP INPUT ROW */}
              {otpSent && !emailVerified && (
                <div style={{ background: "var(--bg-soft)", padding: 14, borderRadius: "var(--radius-md)", marginBottom: 16, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label className="fc-label" style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>
                      Enter 6-Digit Verification Code
                    </label>
                    <span style={{ fontSize: 11.5, color: "var(--text-soft)" }}>Expires in 5 min</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 10px 0" }}>
                    OTP email sent. Please check your inbox or spam folder.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className={`fc-input ${errors.otpCode ? "fc-input-error" : ""}`}
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={{ letterSpacing: "0.25em", fontWeight: 700, fontSize: "16px", textAlign: "center" }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleVerifyEmailOtp}
                      disabled={otpVerifying || otpCode.trim().length !== 6}
                      style={{ whiteSpace: "nowrap", padding: "0 18px", fontSize: 13 }}
                    >
                      {otpVerifying ? "Verifying..." : "Verify OTP"}
                    </Button>
                  </div>
                  {errors.otpCode && <span className="fc-error-text" style={{ color: "var(--danger)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.otpCode}</span>}
                </div>
              )}

              {/* VERIFIED BADGE */}
              {emailVerified && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success, #16a34a)", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
                  <CheckCircle size={16} /> ✓ Email address verified
                </div>
              )}

              {/* MOBILE NUMBER (OPTIONAL PROFILE FIELD) */}
              <FormField label="Mobile Number (Optional)" error={errors.mobile}>
                <input
                  className={`fc-input ${errors.mobile ? "fc-input-error" : ""}`}
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.mobile}
                  onChange={(e) => updateField("mobile", e.target.value)}
                />
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <FormField label="Password" error={errors.password}>
                  <input
                    className={`fc-input ${errors.password ? "fc-input-error" : ""}`}
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Confirm Password" error={errors.confirmPassword}>
                  <input
                    className={`fc-input ${errors.confirmPassword ? "fc-input-error" : ""}`}
                    type="password"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    required
                  />
                </FormField>
              </div>

              <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

              {/* DYNAMIC ROLE-SPECIFIC DETAILS */}
              {role === "farmer" ? (
                /* FARMER DETAILS */
                <div className="fc-fade-in">
                  <h3 className="fc-h3" style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16, color: "var(--brand)" }}>
                    🌾 Farmer Details
                  </h3>

                  <FormField label="Farm Name" error={errors.farmName}>
                    <input
                      className={`fc-input ${errors.farmName ? "fc-input-error" : ""}`}
                      type="text"
                      placeholder="e.g., Green Valley Organic Farm"
                      value={form.farmName}
                      onChange={(e) => updateField("farmName", e.target.value)}
                      required
                    />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <FormField label="Farm Size">
                      <input
                        className="fc-input"
                        type="text"
                        placeholder="e.g., 5 Acres / Hectares"
                        value={form.farmSize}
                        onChange={(e) => updateField("farmSize", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Farming Experience">
                      <input
                        className="fc-input"
                        type="text"
                        placeholder="e.g., 10 Years"
                        value={form.farmingExperience}
                        onChange={(e) => updateField("farmingExperience", e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label="Crops / Products Grown" error={errors.cropsGrown}>
                    <input
                      className={`fc-input ${errors.cropsGrown ? "fc-input-error" : ""}`}
                      type="text"
                      placeholder="e.g., Heirloom Tomatoes, Organic Spinach, Onions"
                      value={form.cropsGrown}
                      onChange={(e) => updateField("cropsGrown", e.target.value)}
                      required
                    />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <FormField label="Primary Crop">
                      <input
                        className="fc-input"
                        type="text"
                        placeholder="e.g., Tomatoes"
                        value={form.primaryCrop}
                        onChange={(e) => updateField("primaryCrop", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Expected Production Quantity">
                      <input
                        className="fc-input"
                        type="text"
                        placeholder="e.g., 5000 kg / season"
                        value={form.expectedQuantity}
                        onChange={(e) => updateField("expectedQuantity", e.target.value)}
                      />
                    </FormField>
                  </div>
                </div>
              ) : (
                /* VENDOR DETAILS */
                <div className="fc-fade-in">
                  <h3 className="fc-h3" style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16, color: "var(--accent)" }}>
                    🏪 Vendor / Business Details
                  </h3>

                  <FormField label="Business / Company Name" error={errors.businessName}>
                    <input
                      className={`fc-input ${errors.businessName ? "fc-input-error" : ""}`}
                      type="text"
                      placeholder="e.g., Ananya's Gourmet Kitchens & Wholesale"
                      value={form.businessName}
                      onChange={(e) => updateField("businessName", e.target.value)}
                      required
                    />
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <FormField label="Business Type">
                      <select
                        className="fc-select"
                        value={form.businessType}
                        onChange={(e) => updateField("businessType", e.target.value)}
                      >
                        <option value="Wholesaler">Wholesaler / Distributor</option>
                        <option value="Restaurant / Cloud Kitchen">Restaurant / Cloud Kitchen</option>
                        <option value="Hotel / Hospitality">Hotel / Hospitality Chain</option>
                        <option value="Retailer / Supermarket">Retailer / Supermarket</option>
                        <option value="Food Processor">Food Processor</option>
                      </select>
                    </FormField>

                    <FormField label="GSTIN (Optional)">
                      <input
                        className="fc-input"
                        type="text"
                        placeholder="27AAAAA0000A1Z5"
                        value={form.gstin}
                        onChange={(e) => updateField("gstin", e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label="Products Interested In / Procurement Requirements" error={errors.procurementCategories}>
                    <input
                      className={`fc-input ${errors.procurementCategories ? "fc-input-error" : ""}`}
                      type="text"
                      placeholder="e.g., Organic Vegetables, Basmati Rice, Spices"
                      value={form.procurementCategories}
                      onChange={(e) => updateField("procurementCategories", e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Approximate Procurement Quantity">
                    <input
                      className="fc-input"
                      type="text"
                      placeholder="e.g., 500 kg / week"
                      value={form.procurementQuantity}
                      onChange={(e) => updateField("procurementQuantity", e.target.value)}
                    />
                  </FormField>
                </div>
              )}

              {/* LOCATION SELECTOR FOR BOTH */}
              <div className="fc-field" style={{ margin: "20px 0" }}>
                <label className="fc-label fc-label-required" style={{ fontWeight: 700 }}>
                  {role === "farmer" ? "Farm Location & Address" : "Business Location & Address"}
                </label>
                <GlobalLocationSelector
                  value={locationObj}
                  onChange={(newLoc) => {
                    setLocationObj(newLoc);
                    setErrors((prev) => ({ ...prev, location: "" }));
                  }}
                  showAddressFields={true}
                />
                {errors.location && <span className="fc-error-text" style={{ color: "var(--danger)", fontSize: "12px" }}>{errors.location}</span>}
              </div>

              <FormField label={role === "farmer" ? "About Your Farm (Optional)" : "About Your Business (Optional)"}>
                <textarea
                  className="fc-textarea"
                  rows={2}
                  value={form.about}
                  onChange={(e) => updateField("about", e.target.value)}
                  placeholder="Tell us about your operations or procurement standards..."
                />
              </FormField>

              <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

              {/* SECURITY QUESTION */}
              <h3 className="fc-h3" style={{ fontSize: "16px", fontWeight: 700, marginBottom: 16 }}>
                Security Question
              </h3>

              <FormField label="Security Question">
                <select
                  className="fc-select"
                  value={form.securityQuestion}
                  onChange={(e) => updateField("securityQuestion", e.target.value)}
                >
                  {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
                <span className="fc-soft" style={{ fontSize: "11.5px" }}>Used for password recovery.</span>
              </FormField>

              <FormField label="Security Answer" error={errors.securityAnswer}>
                <input
                  className={`fc-input ${errors.securityAnswer ? "fc-input-error" : ""}`}
                  type="text"
                  placeholder="Your answer"
                  value={form.securityAnswer}
                  onChange={(e) => updateField("securityAnswer", e.target.value)}
                  required
                />
              </FormField>

              <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

              {/* TERMS & CONDITIONS ACCEPTANCE */}
              <div className="fc-field" style={{ marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 13.5, color: "var(--text)" }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      setErrors((prev) => ({ ...prev, terms: "" }));
                    }}
                    style={{ accentColor: "var(--brand)", width: 18, height: 18, marginTop: 2 }}
                    required
                  />
                  <span>
                    I agree to the <strong>FarmConnect Terms & Conditions</strong> and <strong>Privacy Policy</strong>.
                  </span>
                </label>
                {errors.terms && <span className="fc-error-text" style={{ color: "var(--danger)", fontSize: 12, marginTop: 4, display: "block" }}>{errors.terms}</span>}
              </div>

              {/* SUBMIT BUTTON */}
              <div style={{ marginTop: 24 }}>
                <Button
                  type="submit"
                  variant={role === "vendor" ? "accent" : "primary"}
                  full
                  disabled={loading}
                  style={{ padding: "14px", fontWeight: 800, fontSize: "15px" }}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </div>
            </form>

            {/* Sign In Redirect Link */}
            <div style={{ marginTop: 24, textAlign: "center", fontSize: "13.5px", color: "var(--text-soft)" }}>
              Already have an account?{" "}
              <Link to="/login" style={{ fontWeight: 700, color: "var(--brand)", textDecoration: "underline" }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const Register = memo(RegisterBase);
export default Register;
