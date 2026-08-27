import { useState, useCallback, memo } from "react";
import { Sprout, Check, ArrowLeft, User, MapPin, Store, Tractor, ShieldCheck } from "../icons/Icons.jsx";
import { Button } from "./Button.jsx";
import { FormField } from "./FormField.jsx";
import { REGIONS, CATEGORIES } from "../../utils/constants.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { useLanguage } from "../../hooks/useLanguage.js";

function OnboardingModalBase({ open, onClose }) {
  const { user, role, updateProfile } = useAuth();
  const { notifySuccess } = useNotifications();
  const { t } = useLanguage();


  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Farmer-specific form fields
  const [farmName, setFarmName] = useState(user?.farmName || "");
  const [region, setRegion] = useState(user?.region || REGIONS[0]);
  const [farmType, setFarmType] = useState("Organic Crop Farm");
  const [primaryCrops, setPrimaryCrops] = useState(["Vegetables"]);
  const [farmBio, setFarmBio] = useState(user?.about || "");

  // Vendor-specific form fields
  const [businessName, setBusinessName] = useState(user?.name || "");
  const [businessType, setBusinessType] = useState("Restaurant / Kitchen");
  const [preferredCategories, setPreferredCategories] = useState(["Vegetables", "Grains"]);
  const [procurementVolume, setProcurementVolume] = useState("50-200 kg / week");

  if (!open) return null;

  const totalSteps = 4;

  const toggleCrop = (crop) => {
    setPrimaryCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop]
    );
  };

  const toggleCategory = (cat) => {
    setPreferredCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const payload = role === "farmer" 
          ? { farmName, region, about: farmBio }
          : { name: businessName, region };
        await updateProfile(user.id, payload);
      }
      notifySuccess("Onboarding complete! Your workspace has been configured.");
      onClose();
    } catch (err) {
      console.error(err);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fc-modal-overlay fc-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 25, 16, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "20px",
      }}
    >
      <div
        className="fc-slide-up"
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          maxWidth: "600px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Header with Progress Steps */}
        <div
          style={{
            background: "var(--gradient-hero)",
            padding: "28px 24px 20px 24px",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justify: "center" }}>
                <Sprout size={18} />
              </div>
              <strong style={{ fontSize: 16, fontFamily: "var(--font-heading)" }}>
                {role === "farmer" ? "Grower Onboarding" : "Procurement Onboarding"}
              </strong>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "none",
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              Skip Onboarding
            </button>
          </div>

          {/* Step Progress Indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            {["Profile", "Location", "Preferences", "Complete"].map((label, idx) => {
              const currentStepNum = idx + 1;
              const isActive = step === currentStepNum;
              const isCompleted = step > currentStepNum;

              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: isCompleted
                        ? "#4ade80"
                        : isActive
                        ? "#ffffff"
                        : "rgba(255,255,255,0.25)",
                      transition: "background 0.3s ease",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: isActive || isCompleted ? 700 : 500,
                      color: isActive ? "#ffffff" : isCompleted ? "#86efac" : "rgba(255,255,255,0.6)",
                      textAlign: "center",
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "28px 24px", minHeight: "300px" }}>
          {/* STEP 1: PROFILE DETAILS */}
          {step === 1 && (
            <div className="fc-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                {role === "farmer" ? "Tell us about your farm" : "Tell us about your business"}
              </h3>
              <p className="fc-muted" style={{ fontSize: 13, margin: "0 0 20px 0" }}>
                This information helps buyers and growers verify your trade profile on FarmConnect.
              </p>

              {role === "farmer" ? (
                <>
                  <FormField label="Farm Name">
                    <input
                      className="fc-input"
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      placeholder="e.g. Patil Organic Farms"
                    />
                  </FormField>
                  <FormField label="Farm Operational Type">
                    <select
                      className="fc-select"
                      value={farmType}
                      onChange={(e) => setFarmType(e.target.value)}
                    >
                      <option value="Organic Crop Farm">🌿 Organic Crop Farm</option>
                      <option value="Hydroponic Agritech">💧 Hydroponic Agritech</option>
                      <option value="Conventional Produce Estate">🌾 Conventional Produce Estate</option>
                      <option value="Cooperative Agrarian Collective">🚜 Cooperative Collective</option>
                    </select>
                  </FormField>
                </>
              ) : (
                <>
                  <FormField label="Business / Kitchen Name">
                    <input
                      className="fc-input"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Spice Route Kitchens"
                    />
                  </FormField>
                  <FormField label="Business Sourcing Type">
                    <select
                      className="fc-select"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      <option value="Restaurant / Kitchen">🍽️ Restaurant / Commercial Kitchen</option>
                      <option value="Hotel & Catering Service">🏨 Hotel & Catering Service</option>
                      <option value="Retail Grocery Store">🏪 Retail Grocery Store</option>
                      <option value="Corporate Canteen">🏢 Corporate Canteen</option>
                    </select>
                  </FormField>
                </>
              )}
            </div>
          )}

          {/* STEP 2: LOCATION & REGION */}
          {step === 2 && (
            <div className="fc-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                Select Your Regional Base
              </h3>
              <p className="fc-muted" style={{ fontSize: 13, margin: "0 0 20px 0" }}>
                FarmConnect uses regional hubs to optimize logistics delivery routes and calculate approximate distance.
              </p>

              <FormField label="Primary Operating Region">
                <select
                  className="fc-select"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      📍 {r}
                    </option>
                  ))}
                </select>
              </FormField>

              <div
                style={{
                  background: "var(--bg-soft)",
                  padding: "14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed var(--border)",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "var(--text-muted)",
                  marginTop: 16,
                }}
              >
                💡 <strong>Logistics Routing Tip:</strong> Orders within a 25 km radius receive consolidated cold-chain delivery discounts.
              </div>
            </div>
          )}

          {/* STEP 3: PREFERENCES & CATEGORIES */}
          {step === 3 && (
            <div className="fc-fade-in">
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                {role === "farmer" ? "Primary Produce Categories" : "Preferred Sourcing Categories"}
              </h3>
              <p className="fc-muted" style={{ fontSize: 13, margin: "0 0 20px 0" }}>
                Select the main categories you produce or buy regularly.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = role === "farmer"
                    ? primaryCrops.includes(cat)
                    : preferredCategories.includes(cat);

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => (role === "farmer" ? toggleCrop(cat) : toggleCategory(cat))}
                      style={{
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        border: isSelected ? "2px solid var(--brand)" : "1px solid var(--border)",
                        background: isSelected ? "var(--brand-light)" : "var(--surface)",
                        color: isSelected ? "var(--brand)" : "var(--text)",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{cat}</span>
                      {isSelected && <Check size={16} />}
                    </button>
                  );
                })}
              </div>

              {role === "farmer" ? (
                <FormField label="About Your Farm (Optional Description)">
                  <textarea
                    className="fc-textarea"
                    rows={2}
                    value={farmBio}
                    onChange={(e) => setFarmBio(e.target.value)}
                    placeholder="e.g. Family-owned organic farm practicing sustainable agriculture since 2012."
                  />
                </FormField>
              ) : (
                <FormField label="Estimated Weekly Sourcing Volume">
                  <select
                    className="fc-select"
                    value={procurementVolume}
                    onChange={(e) => setProcurementVolume(e.target.value)}
                  >
                    <option value="10-50 kg / week">10 - 50 kg / week</option>
                    <option value="50-200 kg / week">50 - 200 kg / week</option>
                    <option value="200-1000 kg / week">200 - 1,000 kg / week</option>
                    <option value="1000+ kg / week">1,000+ kg / week (Wholesale Bulk)</option>
                  </select>
                </FormField>
              )}
            </div>
          )}

          {/* STEP 4: COMPLETE & SUMMARY */}
          {step === 4 && (
            <div className="fc-fade-in" style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "var(--brand-light)",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px auto",
                  border: "2px solid var(--brand)",
                }}
              >
                <ShieldCheck size={36} />
              </div>

              <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text)" }}>
                You're Ready for FarmConnect!
              </h3>
              <p className="fc-muted" style={{ fontSize: 14, maxWidth: 420, margin: "0 auto 24px auto", lineHeight: 1.5 }}>
                Your {role === "farmer" ? "grower" : "procurement"} profile has been configured. Enjoy direct B2B trading with verified regional partners.
              </p>

              <div
                style={{
                  background: "var(--bg-soft)",
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  textAlign: "left",
                  fontSize: 13,
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="fc-soft">Profile Name:</span>
                  <strong>{role === "farmer" ? farmName || "Patil Organic Farm" : businessName || "Spice Route Kitchens"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="fc-soft">Region Hub:</span>
                  <strong>{region}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="fc-soft">Primary Focus:</span>
                  <strong>{(role === "farmer" ? primaryCrops : preferredCategories).join(", ") || "Vegetables"}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: "16px 24px",
            background: "var(--bg-soft)",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justify: "space-between",
            alignItems: "center",
          }}
        >
          {step > 1 ? (
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft size={14} /> {t("common.back") || "Back"}
            </Button>
          ) : (
            <div />
          )}

          {step < totalSteps ? (
            <Button variant="primary" size="md" onClick={handleNext} style={{ fontWeight: 700 }}>
              {t("common.next") || "Continue"} →
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleComplete} disabled={loading} style={{ fontWeight: 700 }}>
              {loading ? (t("common.loading") || "Saving...") : (t("navigation.dashboard") || "Go to Workspace →")}
            </Button>
          )}

        </div>
      </div>
    </div>
  );
}

export const OnboardingModal = memo(OnboardingModalBase);
export default OnboardingModal;
