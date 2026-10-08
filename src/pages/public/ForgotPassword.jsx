import { useState, useCallback, memo } from "react";
import { apiFetch } from "../../services/api.js";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Sprout, AlertTriangle, Check } from "../../components/icons/Icons.jsx";
import PublicHeader from "../../components/layout/PublicHeader.jsx";

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function ForgotPasswordBase() {
  const { t } = useLanguage();
  const { notifySuccess } = useNotifications();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Email verify, 2: Q&A + new password, 3: Success
  const [email, setEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((v) => !v);
  }, []);

  const [recoveryMethod, setRecoveryMethod] = useState("otp"); // "otp" or "security_question"
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Step 1: Verify email exists and optionally dispatch OTP
  const handleVerifyEmail = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorText("");
      if (!email.trim()) {
        setErrors({ email: "Please enter your email address." });
        return;
      }

      setErrors({});
      setLoading(true);

      try {
        if (recoveryMethod === "otp") {
          await apiFetch("/api/otp/request", {
            method: "POST",
            body: JSON.stringify({ contact: email.trim(), purpose: "password_reset" })
          });
          setOtpSent(true);
          notifySuccess("Verification code sent to your email!");
          setStep(2);
        } else {
          const data = await apiFetch("/api/auth/verify-security", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
          setSecurityQuestion(data.securityQuestion);
          setStep(2);
        }
      } catch (err) {
        setErrorText(err.message || "Failed to process account recovery.");
      } finally {
        setLoading(false);
      }
    },
    [email, recoveryMethod, notifySuccess]
  );

  // Step 2: Verify OTP / Answer and reset password
  const handleResetPassword = useCallback(
    async (e) => {
      e.preventDefault();
      setErrorText("");
      const validationErrors = {};

      if (recoveryMethod === "otp" && !otpCode.trim()) {
        validationErrors.otpCode = "6-digit OTP code is required.";
      }
      if (recoveryMethod === "security_question" && !securityAnswer.trim()) {
        validationErrors.securityAnswer = "Security answer is required.";
      }
      if (!newPassword) {
        validationErrors.newPassword = "New password is required.";
      } else if (newPassword.length < 6) {
        validationErrors.newPassword = "Password must be at least 6 characters.";
      }
      if (newPassword !== confirmPassword) {
        validationErrors.confirmPassword = "Passwords do not match.";
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});
      setLoading(true);

      try {
        if (recoveryMethod === "otp") {
          await apiFetch("/api/auth/reset-password-otp", {
            method: "POST",
            body: JSON.stringify({
              email: email.trim(),
              otp: otpCode.trim(),
              newPassword
            })
          });
        } else {
          await apiFetch("/api/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({
              email,
              securityAnswer,
              newPassword,
            }),
          });
        }

        notifySuccess("Password has been successfully updated!");
        setStep(3);
      } catch (err) {
        setErrorText(err.message || "Could not reset password.");
      } finally {
        setLoading(false);
      }
    },
    [email, recoveryMethod, otpCode, securityAnswer, newPassword, confirmPassword, notifySuccess]
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
          padding: "30px 20px",
          background: "var(--bg)",
        }}
      >
        {/* Split-Screen Container */}
        <div
          style={{
            maxWidth: "980px",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Left Side: AgriTech Hero Visual */}
          <div
            style={{
              background: "var(--gradient-hero)",
              padding: "44px 36px",
              color: "#ffffff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Sprout size={24} />
                </div>
                <div>
                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, margin: 0 }}>
                    {t("appName")}
                  </h2>
                  <span style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    ACCOUNT RECOVERY PORTAL
                  </span>
                </div>
              </div>

              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 800, lineHeight: 1.25, marginBottom: 16 }}>
                Secure Password Recovery
              </h1>
              <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, marginBottom: 28 }}>
                Verify your registered email and answer your security question to safely update your credentials.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justify: "center" }}>
                    <Check size={13} />
                  </span>
                  <span>Encrypted Credentials & Question Verification</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justify: "center" }}>
                    <Check size={13} />
                  </span>
                  <span>Instant Password Reset for Farmers & Vendors</span>
                </div>
              </div>
            </div>

            <div style={{ position: "relative", zIndex: 2, marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.2)", fontSize: 12, opacity: 0.85 }}>
              © 2026 FarmConnect B2B AgriTech. All rights reserved.
            </div>
          </div>

          {/* Right Side: Recovery Form */}
          <div style={{ padding: "40px 36px", background: "var(--surface)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                {t("public.resetPassword") || "Reset Password"}
              </h2>
            </div>

            {/* Error Alert */}
            {errorText && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "var(--danger-light)",
                  border: "1px solid var(--danger)",
                  color: "var(--danger)",
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: 20,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <AlertTriangle size={18} />
                <span>{errorText}</span>
              </div>
            )}

            {/* STEP 1: Enter Email & Select Recovery Method */}
            {step === 1 && (
              <form onSubmit={handleVerifyEmail}>
                <FormField label="Select Recovery Method">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => setRecoveryMethod("otp")}
                      className={`fc-btn ${recoveryMethod === "otp" ? "fc-btn-primary" : "fc-btn-outline"}`}
                      style={{ fontSize: 13, padding: "8px" }}
                    >
                      ⚡ 6-Digit OTP Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecoveryMethod("security_question")}
                      className={`fc-btn ${recoveryMethod === "security_question" ? "fc-btn-primary" : "fc-btn-outline"}`}
                      style={{ fontSize: 13, padding: "8px" }}
                    >
                      🔑 Security Question
                    </button>
                  </div>
                </FormField>

                <FormField label={t("public.email") || "Registered Email Address"} error={errors.email}>
                  <input
                    className={`fc-input ${errors.email ? "fc-input-error" : ""}`}
                    type="email"
                    placeholder="Enter your email address"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </FormField>

                <Button type="submit" variant="primary" full disabled={loading} style={{ marginTop: 16, padding: "12px", fontWeight: 700 }}>
                  {loading ? "Processing..." : recoveryMethod === "otp" ? "Send 6-Digit OTP Code →" : "Verify Question & Continue →"}
                </Button>
              </form>
            )}

            {/* STEP 2: Verify OTP / Answer & Set New Password */}
            {step === 2 && (
              <form onSubmit={handleResetPassword}>
                {recoveryMethod === "otp" ? (
                  <FormField label="Enter 6-Digit OTP Verification Code" error={errors.otpCode}>
                    <input
                      className={`fc-input ${errors.otpCode ? "fc-input-error" : ""}`}
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      style={{ fontSize: 18, letterSpacing: 4, textAlign: "center", fontWeight: 800 }}
                      required
                    />
                    <span className="fc-soft" style={{ fontSize: 11.5, marginTop: 4, display: "block" }}>
                      Verification code sent to {email}. Valid for 5 minutes.
                    </span>
                  </FormField>
                ) : (
                  <>
                    <div
                      style={{
                        background: "var(--bg-soft)",
                        padding: "14px",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: 16,
                        border: "1px solid var(--border)",
                        fontSize: 13,
                      }}
                    >
                      <strong style={{ fontSize: 11, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 2 }}>
                        {t("public.securityQuestion") || "SECURITY QUESTION"}
                      </strong>
                      <div style={{ fontWeight: 700, color: "var(--text)" }}>{t(securityQuestion) || securityQuestion}</div>
                    </div>

                    <FormField label={t("public.securityAnswer") || "Your Recovery Answer"} error={errors.securityAnswer}>
                      <input
                        className={`fc-input ${errors.securityAnswer ? "fc-input-error" : ""}`}
                        type="text"
                        placeholder="Enter security answer"
                        value={securityAnswer}
                        onChange={(e) => setSecurityAnswer(e.target.value)}
                        required
                      />
                    </FormField>
                  </>
                )}

                <FormField label={t("public.newPassword") || "New Password"} error={errors.newPassword}>
                  <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
                    <div style={{ position: "absolute", left: 12, color: "var(--text-soft)", display: "flex" }}>
                      <LockIcon />
                    </div>
                    <input
                      className={`fc-input ${errors.newPassword ? "fc-input-error" : ""}`}
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ paddingLeft: 36, paddingRight: 40 }}
                      required
                    />
                    <button
                      type="button"
                      onClick={togglePasswordVisibility}
                      style={{
                        position: "absolute",
                        right: 12,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-soft)",
                        display: "flex",
                        padding: 4,
                      }}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </FormField>

                <FormField label={t("public.confirmPassword") || "Confirm New Password"} error={errors.confirmPassword}>
                  <input
                    className={`fc-input ${errors.confirmPassword ? "fc-input-error" : ""}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </FormField>

                <Button type="submit" variant="primary" full disabled={loading} style={{ marginTop: 16, padding: "12px", fontWeight: 700 }}>
                  {loading ? (t("common.loading") || "Updating Password...") : (t("public.resetPassword") || "Reset Password")}
                </Button>
              </form>
            )}

            {/* STEP 3: Success Screen */}
            {step === 3 && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "var(--brand-light)",
                    color: "var(--brand)",
                    marginBottom: 16,
                  }}
                >
                  <Check size={28} />
                </div>
                <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 800, margin: "0 0 8px 0" }}>
                  {t("public.resetSuccess") || "Password Updated!"}
                </h3>
                <Button variant="primary" full onClick={() => navigate("/login")} style={{ padding: "12px", fontWeight: 700 }}>
                  {t("public.login") || "Go to Login"}
                </Button>
              </div>
            )}


            {/* Return to Login Link */}
            {step !== 3 && (
              <div style={{ marginTop: 20, textAlign: "center", fontSize: 13 }}>
                <Link to="/login" style={{ fontWeight: 700, color: "var(--text-muted)", textDecoration: "underline" }}>
                  ← Return to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const ForgotPassword = memo(ForgotPasswordBase);
export default ForgotPassword;
