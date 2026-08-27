import { memo } from "react";
import { Link } from "react-router-dom";
import { Sprout } from "../icons/Icons.jsx";

function FooterBase() {
  return (
    <footer className="fc-footer">
      <div className="fc-footer-inner">
        <div>
          <div className="fc-footer-brand">
            <Sprout size={16} /> FarmConnect
          </div>
          <p className="fc-footer-tag">
            Direct farm-to-market commerce. Connecting verified farmers with trusted buyers through transparent listings and fair pricing.
          </p>
        </div>
        <div className="fc-footer-cols">
          <div>
            <div className="fc-footer-col-title">Platform</div>
            <Link to="/vendor/marketplace">Marketplace</Link>
            <Link to="/support">Support</Link>
          </div>
          <div>
            <div className="fc-footer-col-title">For Farmers</div>
            <Link to="/register">List Your Harvest</Link>
            <Link to="/login">Farmer Sign In</Link>
          </div>
          <div>
            <div className="fc-footer-col-title">For Buyers</div>
            <Link to="/register">Create Account</Link>
            <Link to="/login">Buyer Sign In</Link>
          </div>
        </div>
      </div>
      <div className="fc-footer-copy">
        © 2026 FarmConnect. Direct Farm-to-Market Commerce.
      </div>
    </footer>
  );
}

export const Footer = memo(FooterBase);
export default Footer;
