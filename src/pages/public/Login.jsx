import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useNotifications } from "../../hooks/useNotifications.js";
import { FormField } from "../../components/common/FormField.jsx";
import { Button } from "../../components/common/Button.jsx";
import { Badge } from "../../components/common/Badge.jsx";
import { Sprout, AlertTriangle, Check, Tractor, Store, ArrowLeft } from "../../components/icons/Icons.jsx";
import PublicHeader from "../../components/layout/PublicHeader.jsx";

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
  const { login } = useAuth();
  const { notifySuccess } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Selected role stage: null = Role Selection Screen, "farmer" | "vendor" | "admin" = Login Form
  const [selectedRole, setSelectedRole] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((v) => !v);
  }, []);

  const handleSelectRoleCard = useCallback((r) => {
    setSelectedRole(r);
    setLoginError("");
    setErrors({});
    setEmail("");
    setPassword("");
    setRememberMe(false);
  }, []);

  useEffect(() => {
    if (location.state?.role) {
      handleSelectRoleCard(location.state.role);
    }
  }, [location.state, handleSelectRoleCard]);

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
        await new Promise((resolve) => setTimeout(resolve, 450));
        const authUser = await login(email, password, selectedRole);
        notifySuccess(`${t("welcomeBack") || "Welcome back"}, ${authUser.name}!`);

        if (authUser.role === "farmer") {
          navigate("/farmer/dashboard", { replace: true });
        } else if (authUser.role === "vendor") {
          navigate("/vendor/dashboard", { replace: true });
        } else if (authUser.role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        }
      } catch (err) {
        setLoginError(err.message || "Invalid credentials.");
      } finally {
        setLoading(false);
      }
    },
    [email, password, selectedRole, login, navigate, notifySuccess, t]
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
        {/* STAGE 1: ROLE SELECTION SCREEN */}
        {selectedRole === null ? (
          <div
            className="fc-fade-in"
            style={{
              maxWidth: "960px",
              width: "100%",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: "36px" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.18)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  color: "#ffffff",
                  padding: "6px 16px",
                  borderRadius: "999px",
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 14,
                  backdropFilter: "blur(8px)",
                }}
              >
                <Sprout size={15} /> Select Account Portal
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#ffffff",
                  margin: "0 0 10px 0",
                  letterSpacing: "-0.02em",
                  textShadow: "0 2px 10px rgba(0,0,0,0.3)",
                }}
              >
                Welcome to FarmConnect
              </h1>
              <p style={{ fontSize: "15px", color: "rgba(255, 255, 255, 0.9)", maxWidth: "600px", margin: "0 auto", lineHeight: 1.5 }}>
                Choose your application role to access your dedicated AgriTech portal.
              </p>
            </div>

            {/* TWO LARGE ROLE CARDS */}
            <div className="fc-role-select-grid" style={{ margin: "0 0 32px 0" }}>
              {/* FARMER CARD */}
              <div
                className="fc-role-card"
                onClick={() => handleSelectRoleCard("farmer")}
                style={{
                  border: "2px solid var(--brand-border)",
                  background: "rgba(255, 255, 255, 0.96)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "var(--radius-lg)",
                  padding: "36px 30px",
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 16px 36px rgba(0,0,0,0.18)",
                }}
              >
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: "var(--brand-light)",
                        color: "var(--brand)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--brand-border)",
                      }}
                    >
                      <Tractor size={28} />
                    </div>
                    <Badge variant="success" style={{ fontSize: "10.5px", fontWeight: 800 }}>
                      PRODUCER PORTAL
                    </Badge>
                  </div>

                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: "0 0 6px 0" }}>
                    Farmer
                  </h2>
                  <p className="fc-muted" style={{ fontSize: "13.5px", margin: "0 0 20px 0", lineHeight: 1.4 }}>
                    Sell and manage your agricultural products.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "13px", color: "var(--text)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--brand)", display: "flex" }}><Check size={16} /></span>
                      <span>Manage farm plots & produce listings</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--brand)", display: "flex" }}><Check size={16} /></span>
                      <span>Set wholesale bulk pricing tiers</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--brand)", display: "flex" }}><Check size={16} /></span>
                      <span>Track received vendor orders & shipments</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 28, position: "relative", zIndex: 2 }}>
                  <Button variant="primary" full style={{ padding: "12px", fontWeight: 700, fontSize: 14 }}>
                    Sign In as Farmer →
                  </Button>
                </div>
              </div>

              {/* VENDOR CARD */}
              <div
                className="fc-role-card"
                onClick={() => handleSelectRoleCard("vendor")}
                style={{
                  border: "2px solid var(--accent-border)",
                  background: "rgba(255, 255, 255, 0.96)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "var(--radius-lg)",
                  padding: "36px 30px",
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 16px 36px rgba(0,0,0,0.18)",
                }}
              >
                <div style={{ position: "relative", zIndex: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 16,
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid var(--accent-border)",
                      }}
                    >
                      <Store size={28} />
                    </div>
                    <Badge variant="warning" style={{ fontSize: "10.5px", fontWeight: 800 }}>
                      PROCUREMENT PORTAL
                    </Badge>
                  </div>

                  <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: "0 0 6px 0" }}>
                    Vendor
                  </h2>
                  <p className="fc-muted" style={{ fontSize: "13.5px", margin: "0 0 20px 0", lineHeight: 1.4 }}>
                    Source products directly from verified growers.
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "13px", color: "var(--text)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--accent)", display: "flex" }}><Check size={16} /></span>
                      <span>Browse agricultural produce catalog</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--accent)", display: "flex" }}><Check size={16} /></span>
                      <span>Procure high-grade crop lots directly</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ color: "var(--accent)", display: "flex" }}><Check size={16} /></span>
                      <span>Manage vendor orders & live transit tracking</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 28, position: "relative", zIndex: 2 }}>
                  <Button variant="accent" full style={{ padding: "12px", fontWeight: 700, fontSize: 14 }}>
                    Sign In as Vendor →
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom Links */}
            <div style={{ textAlign: "center", fontSize: 13.5, color: "rgba(255, 255, 255, 0.9)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                {t("public.dontHaveAccount") || "Don't have an account yet?"}{" "}
                <Link to="/register" style={{ fontWeight: 700, color: "#4ade80", textDecoration: "underline" }}>
                  {t("public.register") || "Register here"}
                </Link>
              </div>
              <button
                onClick={() => handleSelectRoleCard("admin")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255, 255, 255, 0.8)", fontSize: 12.5, textDecoration: "underline" }}
              >
                {t("admin.adminProfile") || "Admin Sign In"}
              </button>
            </div>
          </div>
        ) : (
          /* STAGE 2: LOGIN FORM FOR SELECTED ROLE */
          <div
            className="fc-slide-up"
            style={{
              maxWidth: "1000px",
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
            {/* Left Side: Role-Specific Hero Visual */}
            <div
              style={{
                background: selectedRole === "vendor"
                  ? "linear-gradient(rgba(35, 20, 5, 0.82), rgba(15, 8, 2, 0.92)), url('/images/farmconnect-hero.jpg') center/cover no-repeat"
                  : "linear-gradient(rgba(10, 32, 18, 0.82), rgba(5, 19, 11, 0.92)), url('/images/farmconnect-hero.jpg') center/cover no-repeat",
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
                    {selectedRole === "farmer" ? <Tractor size={22} /> : selectedRole === "vendor" ? <Store size={22} /> : <Sprout size={22} />}
                  </div>
                  <div>
                    <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, margin: 0 }}>
                      {t("navigation.appName") || t("appName")}
                    </h2>
                    <span style={{ fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {selectedRole === "farmer"
                        ? (t("common.farmer") || "Farmer")
                        : selectedRole === "vendor"
                        ? (t("common.vendor") || "Buyer / Business")
                        : (t("common.admin") || "Administrator")}
                    </span>
                  </div>
                </div>

                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 800, lineHeight: 1.25, marginBottom: 16 }}>
                  {t("public.heroTitle")}
                </h1>
                <p style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.5, marginBottom: 28 }}>
                  {t("public.heroSubtitle")}
                </p>
              </div>

              <div style={{ position: "relative", zIndex: 2, marginTop: 36, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.2)", fontSize: 12, opacity: 0.85 }}>
                {t("footer.copyright")}
              </div>
            </div>

            {/* Right Side: Authentication Form */}
            <div style={{ padding: "40px 36px", background: "var(--surface)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ marginBottom: 24 }}>
                <button
                  type="button"
                  onClick={() => setSelectedRole(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-soft)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    marginBottom: 16,
                    padding: 0,
                  }}
                >
                  <ArrowLeft size={14} /> {t("common.back") || "Back"}
                </button>

                <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
                  {t("public.login") || "Sign In"} – {selectedRole === "farmer" ? (t("common.farmer") || "Farmer") : (selectedRole === "vendor" ? (t("common.vendor") || "Buyer") : (t("common.admin") || "Administrator"))}
                </h2>
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
                {/* Email / Username Input */}
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
                  variant={selectedRole === "vendor" ? "accent" : "primary"}
                  full
                  disabled={loading}
                  style={{ padding: "12px", fontWeight: 700 }}
                >
                  {loading ? (t("common.loading") || "Signing in...") : t("public.login") || "Login"}
                </Button>
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
        )}
      </div>

    </>
  );
}

export const Login = memo(LoginBase);
export default Login;
