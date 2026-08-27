import { useState, useCallback, memo } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Modal } from "../../components/common/Modal.jsx";
import { apiFetch } from "../../services/api.js";
import { REGIONS } from "../../utils/constants.js";
import { Check, ShieldCheck } from "../../components/icons/Icons.jsx";

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

  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [farmName, setFarmName] = useState(user?.farmName || "");
  const [region, setRegion] = useState(user?.region || "");
  const [securityQuestion, setSecurityQuestion] = useState(user?.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState(user?.securityAnswer || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
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

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const validationErrors = {};

    if (!name.trim()) {
      validationErrors.name = t("messages.fieldRequired") || t("fieldRequired");
    }

    if (user?.role === "farmer" && !farmName.trim()) {
      validationErrors.farmName = t("messages.fieldRequired") || t("fieldRequired");
    }

    if ((user?.role === "farmer" || user?.role === "vendor") && !region) {
      validationErrors.region = t("messages.fieldRequired") || t("fieldRequired");
    }

    if (password) {
      if (password.length < 6) {
        validationErrors.password = t("passwordTooShort") || "Password must be at least 6 characters.";
      }
      if (password !== confirmPassword) {
        validationErrors.confirmPassword = t("passwordsDoNotMatch") || "Passwords do not match.";
      }
      if (!currentPassword) {
        validationErrors.currentPassword = "Current password is required to set new password.";
      }
    }

    if (!securityAnswer.trim()) {
      validationErrors.securityAnswer = t("messages.fieldRequired") || t("fieldRequired");
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    // If password change is requested, demand OTP verification first
    if (password) {
      await handleRequestPasswordOtp();
      return;
    }

    setSubmitting(true);

    const payload = {
      name,
      securityQuestion,
      securityAnswer,
      ...(user?.role === "farmer" ? { farmName, region } : {}),
      ...(user?.role === "vendor" ? { region } : {})
    };

    try {
      if (!user?.id) throw new Error("No authenticated user profile found.");
      await updateProfile(user.id, payload);
      notifySuccess(t("profile.profileUpdated") || t("profileUpdated") || "Profile updated successfully!");
    } catch (err) {
      notifyError(err.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  }, [name, farmName, region, securityQuestion, securityAnswer, password, confirmPassword, currentPassword, user, updateProfile, t, notifySuccess, notifyError]);

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

      // Update non-password profile fields
      await updateProfile(user.id, {
        name,
        securityQuestion,
        securityAnswer,
        ...(user?.role === "farmer" ? { farmName, region } : {}),
        ...(user?.role === "vendor" ? { region } : {})
      });

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
    <div className="fc-page-transition" style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div className="fc-page-head">
        <div>
          <h1 className="fc-h1">{t("profile.profileSettings") || t("navigation.profile") || "Profile Settings"}</h1>
          <p className="fc-muted fc-mt-8">{t("profile.manageAccountMsg") || "Manage your account information, password, and security verification."}</p>
        </div>
      </div>

      <div className="fc-panel" style={{ display: "flex", gap: "24px", alignItems: "center", marginBottom: "24px" }}>
        <div style={{
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
        }}>
          {initials}
        </div>
        <div>
          <h3 className="fc-h3">{user?.name}</h3>
          <p className="fc-soft" style={{ marginTop: "4px" }}>{user?.email}</p>
          <span className="fc-status-badge fc-status-delivered" style={{
            display: "inline-block",
            marginTop: "8px",
            fontSize: "11px",
            fontWeight: "bold",
            background: "var(--bg-soft)",
            color: "var(--text)"
          }}>
            {user?.role === "admin" ? t("admin.adminProfile") : (user?.role === "farmer" ? t("common.farmer") : t("common.vendor"))}
          </span>
        </div>
      </div>

      <form className="fc-panel" onSubmit={handleSubmit}>
        <h3 className="fc-h3 fc-mb-16">{t("profile.personalDetails") || "Personal Details"}</h3>

        <div className="fc-form-row">
          <FormField label={t("public.fullName") || t("fullName") || "Full Name"} error={errors.name}>
            <input
              className={`fc-input ${errors.name ? "fc-input-error" : ""}`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>
          <FormField label={t("public.email") || "Email Address"}>
            <input
              className="fc-input"
              type="email"
              value={email}
              disabled
              style={{ background: "var(--bg-soft)", color: "var(--text-soft)", cursor: "not-allowed" }}
            />
          </FormField>
        </div>

        {user?.role === "farmer" && (
          <div className="fc-form-row">
            <FormField label={t("public.farmName") || t("farmNameLabel") || "Farm Name"} error={errors.farmName}>
              <input
                className={`fc-input ${errors.farmName ? "fc-input-error" : ""}`}
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
              />
            </FormField>
            <FormField label={t("public.region") || t("regionLabel") || "Region"} error={errors.region}>
              <select
                className={`fc-select ${errors.region ? "fc-input-error" : ""}`}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="">-- {t("common.filter") || "Select Region"} --</option>
                {REGIONS.map((reg) => (
                  <option key={reg} value={reg}>{reg}</option>
                ))}
              </select>
            </FormField>
          </div>
        )}

        {user?.role === "vendor" && (
          <FormField label={t("public.region") || t("baseLocationLabel") || "Base Location (Region)"} error={errors.region}>
            <select
              className={`fc-select ${errors.region ? "fc-input-error" : ""}`}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="">-- {t("common.filter") || "Select Location"} --</option>
              {REGIONS.map((reg) => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
            </select>
          </FormField>
        )}

        <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

        <h3 className="fc-h3 fc-mb-16">{t("public.securityQuestion") || t("securityQuestionLabel") || "Security Question"}</h3>
        <p className="fc-muted fc-mb-16" style={{ fontSize: "12px", lineHeight: "1.4" }}>
          {t("profile.securityQuestionHelp") || "Used to verify your identity and recover your password if you forget it."}
        </p>

        <FormField label={t("public.securityQuestion") || t("securityQuestionLabel") || "Security Question"}>
          <select
            className="fc-select"
            value={securityQuestion}
            onChange={(e) => setSecurityQuestion(e.target.value)}
          >
            {SECURITY_QUESTIONS.map((q) => (
              <option key={q} value={q}>{t(q)}</option>
            ))}
          </select>
        </FormField>

        <FormField label={t("public.securityAnswer") || t("securityAnswerLabel") || "Security Answer"} error={errors.securityAnswer}>
          <input
            className={`fc-input ${errors.securityAnswer ? "fc-input-error" : ""}`}
            type="text"
            placeholder={t("public.securityAnswer") || "Your answer"}
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
          />
        </FormField>

        <hr style={{ border: "0.5px solid var(--border)", margin: "24px 0" }} />

        <h3 className="fc-h3 fc-mb-16">{t("public.newPassword") || t("passwordLabel") || "Change Password"}</h3>

        <FormField label="Current Password (Required for Password Update)" error={errors.currentPassword}>
          <input
            className={`fc-input ${errors.currentPassword ? "fc-input-error" : ""}`}
            type="password"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </FormField>

        <div className="fc-form-row">
          <FormField label={t("public.newPassword") || t("passwordLabel") || "New Password"} error={errors.password}>
            <input
              className={`fc-input ${errors.password ? "fc-input-error" : ""}`}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>
          <FormField label={t("public.confirmPassword") || t("confirmPasswordLabel") || "Confirm Password"} error={errors.confirmPassword}>
            <input
              className={`fc-input ${errors.confirmPassword ? "fc-input-error" : ""}`}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </FormField>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px" }}>
          <Button type="submit" variant="primary" disabled={submitting} style={{ padding: "10px 24px" }}>
            <Check size={14} style={{ marginRight: "6px" }} />
            {submitting ? (t("common.loading") || "Saving...") : (t("common.saveChanges") || t("saveChanges") || "Save Changes")}
          </Button>
        </div>
      </form>

      {/* OTP Verification Modal for Password Change */}
      {otpModalOpen && (
        <Modal
          isOpen={otpModalOpen}
          onClose={() => setOtpModalOpen(false)}
          title="🔐 Verify Password Change"
        >
          <form onSubmit={handleVerifyPasswordChangeOtp} style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, background: "var(--brand-light)", padding: 12, borderRadius: 8 }}>
              <ShieldCheck size={24} style={{ color: "var(--brand)" }} />
              <span style={{ fontSize: 12.5, color: "var(--brand-dark)" }}>
                A 6-digit verification code was sent to <strong>{user?.email}</strong> to authorize this password change.
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
                {otpVerifying ? "Verifying..." : "Verify & Update Password"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export const ProfileSettings = memo(ProfileSettingsBase);
export default ProfileSettings;
