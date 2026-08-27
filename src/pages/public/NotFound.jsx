import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "../../components/icons/Icons.jsx";
import { Button } from "../../components/common/Button.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";

function NotFoundBase() {
  const { t } = useLanguage();
  const { role } = useAuth();
  const navigate = useNavigate();

  const handleReturnHome = useCallback(() => {
    if (role === "farmer") {
      navigate("/farmer/dashboard");
    } else if (role === "vendor") {
      navigate("/vendor/marketplace");
    } else {
      navigate("/");
    }
  }, [role, navigate]);

  return (
    <div className="fc-page-transition" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "70vh",
      padding: "20px"
    }}>
      <div className="fc-card fc-card-pad" style={{
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
        boxShadow: "var(--shadow-md)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        border: "1px solid var(--border)"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--danger-light)",
          color: "var(--danger)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px"
        }}>
          <AlertTriangle size={28} />
        </div>
        <h1 className="fc-h1" style={{ fontSize: "32px", marginBottom: "10px" }}>404</h1>
        <h2 className="fc-h2" style={{ marginBottom: "16px" }}>{t("pageNotFound") || "Page Not Found"}</h2>
        <p className="fc-muted" style={{ marginBottom: "28px", fontSize: "14px", lineHeight: "1.5" }}>
          {t("pageNotFoundMsg") || "The page you are looking for does not exist or has been moved."}
        </p>
        <Button variant="primary" full onClick={handleReturnHome}>
          {role ? (role === "farmer" ? t("dashboard") : t("marketplace")) : t("getStarted")}
        </Button>
      </div>
    </div>
  );
}

export const NotFound = memo(NotFoundBase);
export default NotFound;
