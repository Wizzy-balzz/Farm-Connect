import { useState, useCallback, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Tractor, AlertTriangle } from "../../components/icons/Icons.jsx";
import PublicHeader from "../../components/layout/PublicHeader.jsx";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
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

function LoginBase() {
  const { t } = useLanguage();
  const { login, loginWithGoogle } = useAuth();
  const { notifySuccess } = useNotifications();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingCredential, setOnboardingCredential] = useState(null);
  const [onboardingGoogleUser, setOnboardingGoogleUser] = useState(null);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((v) => !v);
  }, []);

  const navigateToDashboard = useCallback(
    (userRole) => {
      if (userRole === "farmer") {
        navigate("/farmer/dashboard", { replace: true });
      } else if (userRole === "vendor") {
        navigate("/vendor/dashboard", { replace: true });
      } else if (userRole === "admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/vendor/dashboard", { replace: true });
      }
    },
    [navigate]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoginError("");
      const validationErrors = {};

      if (!email.trim()) {
        validationErrors.email = t("fieldRequired") || "Please enter your email.";
      }
      if (!password) {
        validationErrors.password = t("fieldRequired") || "Please enter your password.";
      }

      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }

      setErrors({});
      setLoading(true);

      try {
        const authUser = await login(email, password);
        notifySuccess(`${t("welcomeBack") || "Welcome back"}, ${authUser.name}!`);
        navigateToDashboard(authUser.role);
      } catch (err) {
        setLoginError(err.message || "Invalid credentials.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, login, navigateToDashboard, notifySuccess, t]
  );

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      if (!credentialResponse?.credential) return;
      setLoginError("");
      setLoading(true);

      try {
        const res = await loginWithGoogle(credentialResponse.credential);

        if (res && res.requiresOnboarding) {
          setOnboardingCredential(credentialResponse.credential);
          setOnboardingGoogleUser(res.googleUser);
          setShowOnboardingModal(true);
          return;
        }

        if (res && res.role) {
          notifySuccess(`${t("welcomeBack") || "Welcome back"}, ${res.name}!`);
          navigateToDashboard(res.role);
        }
      } catch (err) {
        setLoginError(err.message || "Google Sign-In failed.");
      } finally {
        setLoading(false);
      }
    },
    [loginWithGoogle, navigateToDashboard, notifySuccess, t]
  );

  const handleGoogleError = useCallback(() => {
    setLoginError("Google Sign-In was cancelled or failed to initialize.");
  }, []);

  const handleCompleteOnboarding = useCallback(
    async (selectedRole) => {
      if (!onboardingCredential) return;
      setLoginError("");
      setLoading(true);

      try {
        const res = await loginWithGoogle(onboardingCredential, selectedRole);
        setShowOnboardingModal(false);
        setOnboardingCredential(null);
        setOnboardingGoogleUser(null);

        if (res && res.role) {
          notifySuccess(`${t("welcomeBack") || "Welcome"}, ${res.name}!`);
          navigateToDashboard(res.role);
        }
      } catch (err) {
        setLoginError(err.message || "Account creation failed.");
      } finally {
        setLoading(false);
      }
    },
    [onboardingCredential, loginWithGoogle, navigateToDashboard, notifySuccess, t]
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
          background: "linear-gradient(rgba(5, 45, 24, 0.60), rgba(5, 25, 14, 0.72)), url('/images/farmconnect-hero.jpg') center/cover no-repeat fixed",
        }}
      >
        <div
          className="fc-slide-up"
          style={{
            maxWidth: "960px",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0,0,0,0.3)",
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {/* Left Side: Brand Visual Shell */}
          <div
            style={{
              background: "linear-gradient(rgba(10, 32, 18, 0.82), rgba(5, 19, 11, 0.92)), url('/images/farmconnect-hero.jpg') center/cover no-repeat",
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
                    color: "#ffffff",
                  }}
                >
                  <Tractor size={22} />
                </div>
                <div>
                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, margin: 0 }}>
                    {t("navigation.appName") || t("appName") || "FarmConnect"}
                  </h2>
                  <span style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    AgriTech B2B Platform
                  </span>
                </div>
              </div>

              <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 800, lineHeight: 1.25, marginBottom: 16 }}>
                Direct Farm-to-Business Trade
              </h1>
              <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, marginBottom: 28 }}>
                Sign in with your email and password to access your dedicated portal.
              </p>
            </div>

            <div style={{ position: "relative", zIndex: 2, marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.2)", fontSize: 12, opacity: 0.85 }}>
              © 2026 FarmConnect. All rights reserved.
            </div>
          </div>

          {/* Right Side: Authentication Form */}
          <div style={{ padding: "40px 36px", background: "var(--surface)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                {t("public.login") || "Sign In"}
              </h2>
              <p style={{ fontSize: 13, color: "var(--text-soft)", margin: 0 }}>
                Enter your credentials to access your account.
              </p>
            </div>

            {/* Error Alert */}
            {loginError && (
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
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email Input */}
              <FormField label={t("public.email") || "Email Address"} error={errors.email}>
                <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 12, color: "var(--text-soft)", display: "flex" }}>
                    <UserIcon />
                  </div>
                  <input
                    className={`fc-input ${errors.email ? "fc-input-error" : ""}`}
                    type="email"
                    placeholder="Enter your email address"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ paddingLeft: 36 }}
                    required
                  />
                </div>
              </FormField>

              {/* Password Input */}
              <FormField label={t("public.password") || "Password"} error={errors.password}>
                <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center" }}>
                  <div style={{ position: "absolute", left: 12, color: "var(--text-soft)", display: "flex" }}>
                    <LockIcon />
                  </div>
                  <input
                    className={`fc-input ${errors.password ? "fc-input-error" : ""}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              {/* Remember Me & Forgot Password Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, fontSize: 12.5 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: "var(--brand)" }}
                  />
                  Remember me
                </label>
                <Link to="/forgot-password" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "underline" }}>
                  {t("public.forgotPassword") || "Forgot Password?"}
                </Link>
              </div>

              {/* Submit CTA */}
              <Button
                type="submit"
                variant="primary"
                full
                disabled={loading}
                style={{ padding: "12px", fontWeight: 700 }}
              >
                {loading ? (t("common.loading") || "Signing in...") : t("public.login") || "Login"}
              </Button>

              {/* OR Divider */}
              <div style={{ display: "flex", alignItems: "center", margin: "20px 0 16px 0", gap: 12 }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
                <span style={{ fontSize: 12, color: "var(--text-soft)", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>OR</span>
                <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
              </div>

              {/* Google Sign-In Button Container */}
              <div style={{ display: "flex", justifyContent: "center", width: "100%", minHeight: 40 }}>
                {googleClientId ? (
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      text="continue_with"
                      shape="rectangular"
                      size="large"
                      width="320"
                    />
                  </GoogleOAuthProvider>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--danger)", padding: 8 }}>
                    Google Client ID missing (set VITE_GOOGLE_CLIENT_ID in .env)
                  </div>
                )}
              </div>
            </form>

            {/* Register Redirect */}
            <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: "var(--text-soft)" }}>
              {t("public.dontHaveAccount") || "Don't have an account?"}{" "}
              <Link to="/register" style={{ fontWeight: 700, color: "var(--brand)", textDecoration: "underline" }}>
                {t("public.register") || "Register"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Role Selection Onboarding Modal for New Google Users */}
      {showOnboardingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              padding: 28,
              borderRadius: "var(--radius-lg)",
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              border: "1px solid var(--border)",
              textAlign: "center"
            }}
          >
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 800, margin: "0 0 10px 0" }}>
              Complete Your Account Setup
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginBottom: 20, lineHeight: 1.4 }}>
              Welcome <strong>{onboardingGoogleUser?.name || onboardingGoogleUser?.email}</strong>! Please choose your account type to proceed with FarmConnect.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Button
                variant="primary"
                full
                onClick={() => handleCompleteOnboarding("farmer")}
                disabled={loading}
                style={{ padding: "12px", fontWeight: 700 }}
              >
                🌾 Register as Farmer
              </Button>
              <Button
                variant="outline"
                full
                onClick={() => handleCompleteOnboarding("vendor")}
                disabled={loading}
                style={{ padding: "12px", fontWeight: 700 }}
              >
                🛒 Register as Buyer (Vendor)
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const Login = memo(LoginBase);
export default Login;
