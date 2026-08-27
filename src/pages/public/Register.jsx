import { useState, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { Button } from "../../components/common/Button.jsx";
import { Sprout, Check, Tractor, Store, AlertTriangle } from "../../components/icons/Icons.jsx";
import PublicHeader from "../../components/layout/PublicHeader.jsx";
import { SECURITY_QUESTIONS, REGIONS } from "../../utils/constants.js";

import { GlobalLocationSelector } from "../../components/common/GlobalLocationSelector.jsx";

function RegisterBase() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const { notifySuccess, notifyError } = useNotifications();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0 = role select, 1 = basic, 2 = details, 3 = security, 4 = review
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    farmName: "", about: "",
    securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "",
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
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));
    setApiError("");
  }, []);

  const validateStep = useCallback((stepNum) => {
    const errs = {};
    if (stepNum === 1) {
      if (!form.name.trim()) errs.name = "Full name is required.";
      if (!form.email.trim()) errs.email = "Email is required.";
      else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Enter a valid email address.";
    }
    if (stepNum === 2) {
      if (role === "farmer" && !form.farmName.trim()) {
        errs.farmName = "Farm name is required.";
      }
      const cCode = locationObj.countryCode || "IN";
      if (!cCode) {
        errs.location = "Please select your country.";
      } else if (!locationObj.region || !locationObj.region.trim()) {
        errs.location = "Please select your state or region.";
      } else if (!locationObj.city || !locationObj.city.trim()) {
        errs.location = "Please select or enter your city.";
      } else if (!locationObj.address || !locationObj.address.trim()) {
        errs.location = "Please enter your street address.";
      } else if (!locationObj.postalCode || !locationObj.postalCode.trim()) {
        errs.location = "Please enter your postal/ZIP code.";
      }
    }
    if (stepNum === 3) {
      if (!form.password) errs.password = "Password is required.";
      else if (form.password.length < 6) errs.password = "Password must be at least 6 characters.";
      if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match.";
      if (!form.securityAnswer.trim()) errs.securityAnswer = "Security answer is required.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [form, role, locationObj]);

  const handleNext = useCallback(() => {
    if (validateStep(step)) {
      setStep(s => s + 1);
    }
  }, [step, validateStep]);

  const handleBack = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
    setApiError("");
  }, []);

  const handleSelectRole = useCallback((r) => {
    setRole(r);
    setStep(1);
    setApiError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setApiError("");
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: role === "farmer" ? "farmer" : "vendor",
        farmName: form.farmName.trim() || null,
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
        securityAnswer: form.securityAnswer.trim(),
      });
      notifySuccess("Account created successfully!");
      navigate(role === "farmer" ? "/farmer/dashboard" : "/vendor/dashboard", { replace: true });
    } catch (err) {
      setApiError(err.message || "Registration failed. Please try again.");
      notifyError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }, [form, role, locationObj, register, navigate, notifySuccess, notifyError]);

  const totalSteps = 4;
  const stepLabels = ["Basic Info", role === "farmer" ? "Farm Info" : "Business Info", "Security", "Review"];

  const renderField = (label, field, type = "text", placeholder = "", required = false) => (
    <div className="fc-field">
      <label className={`fc-label ${required ? "fc-label-required" : ""}`}>{label}</label>
      {type === "textarea" ? (
        <textarea
          className={`fc-textarea ${errors[field] ? "fc-textarea-error" : ""}`}
          value={form[field]}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          className={`fc-input ${errors[field] ? "fc-input-error" : ""}`}
          type={type}
          value={form[field]}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder={placeholder}
        />
      )}
      {errors[field] && <span className="fc-error-text">{errors[field]}</span>}
    </div>
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
          background: "linear-gradient(rgba(5, 45, 24, 0.55), rgba(5, 25, 14, 0.70)), url('/images/farmconnect-farm.jpg') center/cover no-repeat fixed",
        }}
      >
        <div style={{ maxWidth: step === 0 ? "860px" : "520px", width: "100%" }}>

          {/* STEP 0: ROLE SELECTION */}
          {step === 0 && (
            <div className="fc-fade-in">
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff", padding: "6px 16px", borderRadius: "999px", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                  <Sprout size={14} /> Create Your Account
                </div>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
                  Join FarmConnect
                </h1>
                <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", maxWidth: 500, margin: "0 auto" }}>
                  Select how you'd like to use the platform.
                </p>
              </div>

              <div className="fc-role-select-grid" style={{ margin: "0 0 24px" }}>
                <div className="fc-role-card" onClick={() => handleSelectRole("farmer")} style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)" }}>
                  <div className="fc-role-card-icon" style={{ background: "var(--gradient-hero)" }}>
                    <Tractor size={26} />
                  </div>
                  <h3 className="fc-h2" style={{ marginBottom: 8 }}>I'm a Farmer</h3>
                  <p className="fc-muted" style={{ marginBottom: 16 }}>List your harvest, reach verified buyers, and manage direct sales.</p>
                  <Button variant="primary" style={{ width: "100%" }}>Register as Farmer</Button>
                </div>
                <div className="fc-role-card" onClick={() => handleSelectRole("buyer")} style={{ background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)" }}>
                  <div className="fc-role-card-icon" style={{ background: "var(--gradient-accent)" }}>
                    <Store size={26} />
                  </div>
                  <h3 className="fc-h2" style={{ marginBottom: 8 }}>I'm a Buyer</h3>
                  <p className="fc-muted" style={{ marginBottom: 16 }}>Discover fresh produce, compare listings, and manage procurement.</p>
                  <Button variant="accent" style={{ width: "100%" }}>Register as Buyer</Button>
                </div>
              </div>

              <div style={{ textAlign: "center" }}>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                  Already have an account?{" "}
                  <Link to="/login" style={{ color: "#fff", fontWeight: 700, textDecoration: "underline" }}>Sign In</Link>
                </p>
              </div>
            </div>
          )}

          {/* STEPS 1-4: REGISTRATION FORM */}
          {step > 0 && (
            <div className="fc-card fc-card-pad-lg fc-slide-up" style={{ padding: 32, borderRadius: "var(--radius-lg)" }}>
              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div className="fc-flex-center" style={{ gap: 8, marginBottom: 12 }}>
                  <Sprout size={20} style={{ color: "var(--brand)" }} />
                  <span style={{ fontWeight: 800, fontSize: "var(--text-lg)" }}>FarmConnect</span>
                </div>
                <h2 className="fc-h2" style={{ marginBottom: 4 }}>
                  {role === "farmer" ? "Farmer Registration" : "Buyer Registration"}
                </h2>
                <p className="fc-muted">Step {step} of {totalSteps}</p>
              </div>

              {/* Progress Steps */}
              <div className="fc-progress-steps" style={{ marginBottom: 28 }}>
                {stepLabels.map((label, i) => (
                  <div key={i} className={`fc-progress-step ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "completed" : ""}`}>
                    <div className="fc-progress-step-num">{i + 1 < step ? <Check size={12} /> : i + 1}</div>
                    <div className="fc-progress-step-label">{label}</div>
                  </div>
                ))}
              </div>

              {apiError && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--danger-light)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: "var(--text-sm)", color: "var(--danger)" }}>
                  <AlertTriangle size={16} /> {apiError}
                </div>
              )}

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <div className="fc-fade-in">
                  {renderField("Full Name", "name", "text", "Enter your full name", true)}
                  {renderField("Email Address", "email", "email", "you@example.com", true)}
                </div>
              )}

              {/* Step 2: Global Location & Details */}
              {step === 2 && (
                <div className="fc-fade-in">
                  {role === "farmer" && renderField("Farm Name", "farmName", "text", "e.g., Green Valley Farms", true)}
                  {role === "buyer" && renderField("Business Name", "farmName", "text", "e.g., Ananya's Gourmet Kitchens")}
                  
                  <div className="fc-field" style={{ marginBottom: 16 }}>
                    <label className="fc-label fc-label-required">Global Location & Address</label>
                    <GlobalLocationSelector
                      value={locationObj}
                      onChange={(newLoc) => {
                        setLocationObj(newLoc);
                        setErrors(prev => ({ ...prev, location: "" }));
                      }}
                      showAddressFields={true}
                    />
                    {errors.location && <span className="fc-error-text" style={{ color: "var(--danger)", fontSize: "12px" }}>{errors.location}</span>}
                  </div>

                  {renderField(role === "farmer" ? "About Your Farm" : "About Your Business", "about", "textarea", "Tell us about your operations or procurement needs...")}
                </div>
              )}

              {/* Step 3: Security */}
              {step === 3 && (
                <div className="fc-fade-in">
                  {renderField("Password", "password", "password", "Minimum 6 characters", true)}
                  {renderField("Confirm Password", "confirmPassword", "password", "Re-enter your password", true)}
                  <div className="fc-field">
                    <label className="fc-label fc-label-required">Security Question</label>
                    <select
                      className="fc-select"
                      value={form.securityQuestion}
                      onChange={(e) => updateField("securityQuestion", e.target.value)}
                    >
                      {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <span className="fc-soft">Used to recover your password if you forget it.</span>
                  </div>
                  {renderField("Security Answer", "securityAnswer", "text", "Your answer", true)}
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="fc-fade-in">
                  <div className="fc-panel" style={{ marginBottom: 16 }}>
                    <div className="fc-label-upper" style={{ marginBottom: 12 }}>Account Summary</div>
                    <div style={{ display: "grid", gap: 8, fontSize: "var(--text-base)" }}>
                      <div className="fc-flex-between"><span className="fc-muted">Role</span><strong>{role === "farmer" ? "Farmer" : "Buyer"}</strong></div>
                      <div className="fc-flex-between"><span className="fc-muted">Name</span><strong>{form.name}</strong></div>
                      <div className="fc-flex-between"><span className="fc-muted">Email</span><strong>{form.email}</strong></div>
                      {form.farmName && <div className="fc-flex-between"><span className="fc-muted">{role === "farmer" ? "Farm" : "Business"}</span><strong>{form.farmName}</strong></div>}
                      {form.region && <div className="fc-flex-between"><span className="fc-muted">Region</span><strong>{form.region}</strong></div>}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="fc-flex-between" style={{ marginTop: 24 }}>
                <Button variant="ghost" onClick={step === 1 ? () => setStep(0) : handleBack}>
                  Back
                </Button>
                {step < 4 ? (
                  <Button variant="primary" onClick={handleNext}>
                    Continue
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                    {loading ? "Creating Account..." : "Create Account"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const Register = memo(RegisterBase);
export default Register;
