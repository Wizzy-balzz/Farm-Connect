import { useState, useCallback, memo } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { apiFetch } from "../../services/api.js";
import { REGIONS } from "../../utils/constants.js";
import { ShieldCheck } from "../../components/icons/Icons.jsx";
import { AiMemoryManager } from "../../components/ai/AiMemoryManager.jsx";

const SECURITY_QUESTIONS = [
  "What is the name of your first pet?",
  "What is your mother's maiden name?",
  "In what city were you born?",
  "What was the name of your high school?",
  "What is your favorite food?"
];

function ProfileSettingsBase() {
  const { user, updateProfile } = useAuth();
  const { t } = useLanguage();
  const { notifySuccess, notifyError } = useNotifications();

  // Basic Info
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [region, setRegion] = useState(user?.region || "");
  const [about, setAbout] = useState(user?.about || "");

  // Farmer Role Fields
  const [farmName, setFarmName] = useState(user?.farmName || "");
  const [farmSize, setFarmSize] = useState(user?.farmSize || "");
  const [farmingExperience, setFarmingExperience] = useState(user?.farmingExperience || "");
  const [cropsGrown, setCropsGrown] = useState(user?.cropsGrown || "");
  const [primaryCrop, setPrimaryCrop] = useState(user?.primaryCrop || "");
  const [expectedQuantity, setExpectedQuantity] = useState(user?.expectedQuantity || "");

  // Vendor Role Fields
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [businessType, setBusinessType] = useState(user?.businessType || "Wholesaler");
  const [gstin, setGstin] = useState(user?.gstin || "");
  const [procurementCategories, setProcurementCategories] = useState(user?.procurementCategories || "");
  const [procurementQuantity, setProcurementQuantity] = useState(user?.procurementQuantity || "");

  // Security & Passwords
  const [securityQuestion, setSecurityQuestion] = useState(user?.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState(user?.securityAnswer || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);

  const handleRequestPasswordOtp = async () => {
    try {
      await apiFetch("/api/otp/request", {
        method: "POST",
        body: JSON.stringify({ contact: user?.email, purpose: "password_change" })
      });
      notifySuccess("Verification code sent to your email.");
      setOtpModalOpen(true);
    } catch (err) {
      notifyError(err.message || "Failed to send OTP verification code.");
    }
  };

  const buildProfilePayload = useCallback(() => {
    return {
      name,
      mobile,
      region,
      about,
      securityQuestion,
      securityAnswer,
      ...(user?.role === "farmer"
        ? {
            farmName,
            farmSize,
            farmingExperience,
            cropsGrown,
            primaryCrop,
            expectedQuantity
          }
        : {}),
      ...(user?.role === "vendor"
        ? {
            businessName,
            businessType,
            gstin,
            procurementCategories,
            procurementQuantity
          }
        : {})
    };
  }, [
    name,
    mobile,
    region,
    about,
    securityQuestion,
    securityAnswer,
    farmName,
    farmSize,
    farmingExperience,
    cropsGrown,
    primaryCrop,
    expectedQuantity,
    businessName,
    businessType,
    gstin,
    procurementCategories,
    procurementQuantity,
    user?.role
  ]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const validationErrors = {};

      if (!name.trim()) {
        validationErrors.name = t("messages.fieldRequired") || "Full Name is required.";
      }

      if (user?.role === "farmer" && !farmName.trim()) {
        validationErrors.farmName = t("messages.fieldRequired") || "Farm Name is required.";
      }

      if (user?.role === "vendor" && !businessName.trim()) {
        validationErrors.businessName = t("messages.fieldRequired") || "Business Name is required.";
      }

      if (password) {
        if (password.length < 6) {
          validationErrors.password = "Password must be at least 6 characters.";
        }
        if (password !== confirmPassword) {
          validationErrors.confirmPassword = "Passwords do not match.";
        }
        if (!currentPassword) {
          validationErrors.currentPassword = "Current password is required to set new password.";
        }
      }

      if (!securityAnswer.trim()) {
        validationErrors.securityAnswer = "Security answer is required.";
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});

      if (password) {
        await handleRequestPasswordOtp();
        return;
      }

      setSubmitting(true);

      try {
        if (!user?.id) throw new Error("No authenticated user profile found.");
        await updateProfile(user.id, buildProfilePayload());
        notifySuccess("Profile updated successfully!");
      } catch (err) {
        notifyError(err.message || "Failed to update profile.");
      } finally {
        setSubmitting(false);
      }
    },
    [name, farmName, businessName, password, confirmPassword, currentPassword, securityAnswer, user, updateProfile, buildProfilePayload, t, notifySuccess, notifyError]
  );

  const handleVerifyPasswordChangeOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 4) return;
    setOtpVerifying(true);

    try {
      await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword: password,
          otp: otpCode
        })
      });

      await updateProfile(user.id, buildProfilePayload());

      notifySuccess("Password and profile updated successfully!");
      setPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
      setOtpCode("");
      setOtpModalOpen(false);
    } catch (err) {
      notifyError(err.message || "Failed to verify OTP or change password.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : "U";

  return (
    <div className="fc-page-transition" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div className="fc-page-head">
        <div>
          <h1 className="fc-h1">{t("profile.profileSettings") || "Profile Settings"}</h1>
          <p className="fc-muted fc-mt-8">Manage your role-specific account details and profile information.</p>
        </div>
      </div>

      <div className="fc-panel" style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "24px" }}>
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "var(--brand-light)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            fontWeight: "bold",
            border: "2px solid var(--border)"
          }}
        >
          {initials}
        </div>
        <div>
          <h3 className="fc-h3">{user?.name}</h3>
          <p className="fc-soft" style={{ marginTop: "4px" }}>{user?.email}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <span
              className="fc-status-badge fc-status-delivered"
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                background: "var(--bg-soft)",
                color: "var(--text)",
                textTransform: "uppercase"
              }}
            >
              Role: {user?.role === "farmer" ? "🌾 Farmer Account" : (user?.role === "vendor" ? "🏪 Vendor Account" : "Administrator")}
            </span>
          </div>
        </div>
      </div>

      <form className="fc-panel" onSubmit={handleSubmit}>
        <h3 className="fc-h3 fc-mb-16">Personal Details</h3>

        <div className="fc-form-row">
          <FormField label="Full Name" error={errors.name}>
            <input className={`fc-input ${errors.name ? "fc-input-error" : ""}`} type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Email Address">
            <input className="fc-input" type="email" value={email} disabled style={{ background: "var(--bg-soft)", color: "var(--text-soft)", cursor: "not-allowed" }} />
          </FormField>
        </div>

        <div className="fc-form-row">
          <FormField label="Mobile Number">
            <input className="fc-input" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+91 98765 43210" />
          </FormField>
          <FormField label="Region / State">
            <select className="fc-select" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">-- Select Region --</option>
              {REGIONS.map((reg) => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </FormField>
        </div>

        <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

        {/* FARMER ROLE SPECIFIC PROFILE FIELDS */}
        {user?.role === "farmer" && (
          <>
            <h3 className="fc-h3 fc-mb-16">🌾 Farm Details</h3>
            <div className="fc-form-row">
              <FormField label="Farm Name" error={errors.farmName}>
                <input className={`fc-input ${errors.farmName ? "fc-input-error" : ""}`} type="text" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
              </FormField>
              <FormField label="Farm Size">
                <input className="fc-input" type="text" value={farmSize} onChange={(e) => setFarmSize(e.target.value)} placeholder="e.g. 5 Acres" />
              </FormField>
            </div>

            <div className="fc-form-row">
              <FormField label="Farming Experience">
                <input className="fc-input" type="text" value={farmingExperience} onChange={(e) => setFarmingExperience(e.target.value)} placeholder="e.g. 10 Years" />
              </FormField>
              <FormField label="Primary Crop">
                <input className="fc-input" type="text" value={primaryCrop} onChange={(e) => setPrimaryCrop(e.target.value)} placeholder="e.g. Heirloom Tomatoes" />
              </FormField>
            </div>

            <FormField label="Crops / Products Grown">
              <input className="fc-input" type="text" value={cropsGrown} onChange={(e) => setCropsGrown(e.target.value)} placeholder="e.g. Tomatoes, Spinach, Onions" />
            </FormField>

            <FormField label="Expected Output Quantity">
              <input className="fc-input" type="text" value={expectedQuantity} onChange={(e) => setExpectedQuantity(e.target.value)} placeholder="e.g. 5000 kg / season" />
            </FormField>

            <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />
          </>
        )}

        {/* VENDOR ROLE SPECIFIC PROFILE FIELDS */}
        {user?.role === "vendor" && (
          <>
            <h3 className="fc-h3 fc-mb-16">🏪 Business & Procurement Details</h3>
            <div className="fc-form-row">
              <FormField label="Business Name" error={errors.businessName}>
                <input className={`fc-input ${errors.businessName ? "fc-input-error" : ""}`} type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </FormField>
              <FormField label="Business Type">
                <select className="fc-select" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                  <option value="Wholesaler">Wholesaler / Distributor</option>
                  <option value="Restaurant / Cloud Kitchen">Restaurant / Cloud Kitchen</option>
                  <option value="Hotel / Hospitality">Hotel / Hospitality Chain</option>
                  <option value="Retailer / Supermarket">Retailer / Supermarket</option>
                  <option value="Food Processor">Food Processor</option>
                </select>
              </FormField>
            </div>

            <FormField label="GSTIN Number">
              <input className="fc-input" type="text" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AAAAA0000A1Z5" />
            </FormField>

            <FormField label="Required Produce Categories">
              <input className="fc-input" type="text" value={procurementCategories} onChange={(e) => setProcurementCategories(e.target.value)} placeholder="e.g. Organic Vegetables, Grains, Spices" />
            </FormField>

            <FormField label="Approximate Procurement Quantity">
              <input className="fc-input" type="text" value={procurementQuantity} onChange={(e) => setProcurementQuantity(e.target.value)} placeholder="e.g. 500 kg / week" />
            </FormField>

            <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />
          </>
        )}

        <h3 className="fc-h3 fc-mb-16">About</h3>
        <FormField label={user?.role === "farmer" ? "About Your Farm" : "About Your Business"}>
          <textarea className="fc-textarea" rows={3} value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Tell us about your operations or business..." />
        </FormField>

        <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

        <h3 className="fc-h3 fc-mb-16">Security Question</h3>
        <FormField label="Security Question">
          <select className="fc-select" value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)}>
            {SECURITY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
        </FormField>

        <FormField label="Security Answer" error={errors.securityAnswer}>
          <input className={`fc-input ${errors.securityAnswer ? "fc-input-error" : ""}`} type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
        </FormField>

        <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

        <h3 className="fc-h3 fc-mb-16">Change Password</h3>
        <FormField label="Current Password (Required for Password Update)" error={errors.currentPassword}>
          <input className={`fc-input ${errors.currentPassword ? "fc-input-error" : ""}`} type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
        </FormField>

        <div className="fc-form-row">
          <FormField label="New Password" error={errors.password}>
            <input className={`fc-input ${errors.password ? "fc-input-error" : ""}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
          </FormField>

          <FormField label="Confirm New Password" error={errors.confirmPassword}>
            <input className={`fc-input ${errors.confirmPassword ? "fc-input-error" : ""}`} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
          </FormField>
        </div>

        <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Saving..." : "Save Profile Changes"}
          </Button>
        </div>
      </form>

      {/* Phase 3D-2: Persistent AI Memory & Preferences Management Section */}
      <div style={{ marginTop: "32px", borderTop: "1px solid var(--border)", paddingTop: "28px" }}>
        <AiMemoryManager />
      </div>

      {/* OTP Modal */}
      <Modal isOpen={otpModalOpen} onClose={() => setOtpModalOpen(false)} title="Verify Password Change">
        <form onSubmit={handleVerifyPasswordChangeOtp}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, color: "var(--brand)" }}>
            <ShieldCheck size={24} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Verification code sent to {user?.email}</span>
          </div>

          <FormField label="Enter Verification Code (OTP)">
            <input className="fc-input" type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="Enter 6-digit OTP code" required />
          </FormField>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
            <Button variant="ghost" type="button" onClick={() => setOtpModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={otpVerifying}>{otpVerifying ? "Verifying..." : "Verify & Save"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export const ProfileSettings = memo(ProfileSettingsBase);
export default ProfileSettings;
