import { memo } from "react";
import { NavLink } from "react-router-dom";
import { X } from "../icons/Icons.jsx";
import {
  ClipboardList, Package, ShoppingBag, Heart, Cart as CartIcon, Truck,
} from "../icons/Icons.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../hooks/useLanguage.js";

const LayoutGrid = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const UserIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const DollarIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const ShieldIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BarChartIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
  </svg>
);

const FARMER_LINKS = [
  { path: "/farmer/dashboard", label: "Overview", icon: LayoutGrid },
  { path: "/farmer/farm", label: "My Farm", icon: Package },
  { path: "/farmer/products", label: "Harvest Listings", icon: ShoppingBag },
  { path: "/farmer/orders", label: "Orders", icon: Truck },
  { path: "/farmer/profile", label: "Profile", icon: UserIcon },
];

const VENDOR_LINKS = [
  { path: "/vendor/dashboard", label: "Overview", icon: LayoutGrid },
  { path: "/vendor/marketplace", label: "Marketplace", icon: ShoppingBag },
  { path: "/vendor/orders", label: "Orders", icon: ClipboardList },
  { path: "/vendor/wishlist", label: "Saved Harvests", icon: Heart },
  { path: "/vendor/cart", label: "Cart", icon: CartIcon },
  { path: "/vendor/profile", label: "Profile", icon: UserIcon },
];

const ADMIN_LINKS = [
  { path: "/admin/dashboard", label: "Overview", icon: LayoutGrid },
  { path: "/admin/users", label: "Users", icon: UserIcon },
  { path: "/admin/farmers", label: "Verification", icon: ShieldIcon },
  { path: "/admin/products", label: "Listings", icon: Package },
  { path: "/admin/orders", label: "Orders", icon: Truck },
  { path: "/admin/profile", label: "Profile", icon: UserIcon },
];

function SidebarBase({ mobileOpen, onCloseMobile }) {
  const { role, logout } = useAuth();
  const links = role === "admin" ? ADMIN_LINKS : (role === "farmer" ? FARMER_LINKS : VENDOR_LINKS);

  const roleLabel = role === "admin" ? "Admin" : (role === "farmer" ? "Farmer" : "Buyer");

  const handleLogout = () => {
    logout();
    onCloseMobile?.();
  };

  const content = (
    <>
      <div className="fc-side-section-title">
        {roleLabel}
      </div>
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <NavLink
            key={l.path}
            to={l.path}
            className={({ isActive }) => `fc-side-link ${isActive ? "active" : ""}`}
            onClick={onCloseMobile}
          >
            <Icon size={16} /> {l.label}
          </NavLink>
        );
      })}

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <button
          className="fc-side-link"
          onClick={handleLogout}
          style={{ width: "100%", color: "var(--danger)", background: "transparent" }}
          aria-label="Sign out"
        >
          <X size={16} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="fc-sidebar">{content}</aside>
      {mobileOpen && (
        <div className="fc-modal-overlay" style={{ justifyContent: "flex-start" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseMobile(); }}>
          <div className="fc-sidebar fc-slide-up" style={{ height: "100vh", boxShadow: "var(--shadow-lg)", display: "flex" }}>
            <div className="fc-flex-between" style={{ marginBottom: 10 }}>
              <strong>Menu</strong>
              <button className="fc-icon-btn" onClick={onCloseMobile} aria-label="Close menu"><X size={16} /></button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}

export const Sidebar = memo(SidebarBase);
export default Sidebar;
