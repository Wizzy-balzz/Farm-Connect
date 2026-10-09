import { useState, useRef, useEffect, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Sprout, Sun, Moon } from "../icons/Icons.jsx";
import { useLanguage } from "../../hooks/useLanguage.js";
import { useTheme } from "../../hooks/useTheme.js";
import { LANGUAGES } from "../../context/LanguageContext.jsx";

function PublicHeaderBase() {
  const { lang, setLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const isLoginPage = location.pathname === "/login";
  const isRegisterPage = location.pathname === "/register";

  return (
    <header className="fc-navbar" style={{
      position: "sticky",
      top: 0,
      width: "100%",
      zIndex: 100,
      background: "var(--glass-bg)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0 24px",
      height: "64px"
    }}>
      {/* Brand logo */}
      <div className="fc-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <div className="fc-brand-icon"><Sprout size={16} /></div>
        <span style={{ fontSize: "18px", fontWeight: "bold", color: "var(--text)" }}>FarmConnect</span>
      </div>

      {/* Action buttons + Language + Theme switcher */}
      <div className="fc-navbar-right" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Language selector */}
        <div className="fc-dropdown-wrap" ref={langRef} style={{ position: "relative" }}>
          <button className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => setLangOpen((s) => !s)} aria-label="language" style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: "bold",
            padding: "8px 12px",
          }}>
            <span>🌐</span>
            <span>{LANGUAGES.find((l) => l.code === lang)?.label || "English"}</span>
            <span style={{ fontSize: "10px" }}>▼</span>
          </button>
          {langOpen && (
            <div className="fc-dropdown fc-lang-menu fc-slide-down" style={{
              position: "absolute",
              top: "110%",
              right: 0,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
              borderRadius: "var(--radius-sm)",
              minWidth: "140px",
              padding: "6px 0",
              zIndex: 100
            }}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  className={`fc-lang-item ${lang === l.code ? "active" : ""}`}
                  onClick={() => { setLang(l.code); setLangOpen(false); }}
                >
                  <span style={{ width: "16px", color: "var(--brand)", fontWeight: "bold" }}>
                    {lang === l.code ? "✓" : ""}
                  </span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          className="fc-icon-btn"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark Mode" : "Light Mode"}
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        {/* Home / Login / Register buttons */}
        {!isLoginPage && (
          <button className="fc-btn fc-btn-outline fc-btn-sm" onClick={() => navigate("/login")}>
            Sign In
          </button>
        )}
        {!isRegisterPage && (
          <button className="fc-btn fc-btn-primary fc-btn-sm" onClick={() => navigate("/register")}>
            Register
          </button>
        )}
      </div>
    </header>
  );
}

export const PublicHeader = memo(PublicHeaderBase);
export default PublicHeader;
