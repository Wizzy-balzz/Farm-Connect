/* Centralized inline SVG icon set — no external icon package required. */
const base = (size) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
});

export const Sprout = ({ size = 18 }) => (<svg {...base(size)}><path d="M7 20h10" /><path d="M12 20v-8" /><path d="M12 12C7 12 5 8 5 5c3 0 7 1 7 7Z" /><path d="M12 12c5 0 7-4 7-7-3 0-7 1-7 7Z" /></svg>);
export const Search = ({ size = 16 }) => (<svg {...base(size)}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>);
export const Bell = ({ size = 18 }) => (<svg {...base(size)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>);
export const Cart = ({ size = 16 }) => (<svg {...base(size)}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>);
export const Heart = ({ size = 15, filled = false }) => (<svg {...base(size)} fill={filled ? "currentColor" : "none"}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z" /></svg>);
export const Minus = ({ size = 14 }) => (<svg {...base(size)}><path d="M5 12h14" /></svg>);
export const Plus = ({ size = 14 }) => (<svg {...base(size)}><path d="M5 12h14M12 5v14" /></svg>);
export const Trash = ({ size = 15 }) => (<svg {...base(size)}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>);
export const Truck = ({ size = 16 }) => (<svg {...base(size)}><path d="M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h1" /><path d="M14 9h4l4 4v4a1 1 0 0 1-1 1h-1" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>);
export const Check = ({ size = 14 }) => (<svg {...base(size)}><path d="M20 6 9 17l-5-5" /></svg>);
export const X = ({ size = 16 }) => (<svg {...base(size)}><path d="M18 6 6 18M6 6l12 12" /></svg>);
export const Edit = ({ size = 14 }) => (<svg {...base(size)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
export const Sun = ({ size = 17 }) => (<svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const Moon = ({ size = 17 }) => (<svg {...base(size)}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></svg>);
export const Globe = ({ size = 17 }) => (<svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" /></svg>);
export const ChevronDown = ({ size = 14 }) => (<svg {...base(size)}><path d="m6 9 6 6 6-6" /></svg>);
export const Menu = ({ size = 20 }) => (<svg {...base(size)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>);
export const Package = ({ size = 18 }) => (<svg {...base(size)}><path d="m7.5 4.27 9 5.15" /><path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" /><path d="M3.3 7 12 12l8.7-5M12 22V12" /></svg>);
export const TrendingUp = ({ size = 16 }) => (<svg {...base(size)}><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></svg>);
export const TrendingDown = ({ size = 16 }) => (<svg {...base(size)}><path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></svg>);
export const ShoppingBag = ({ size = 18 }) => (<svg {...base(size)}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>);
export const ClipboardList = ({ size = 16 }) => (<svg {...base(size)}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M9 12h6M9 16h6M9 8h6" /></svg>);
export const AlertTriangle = ({ size = 16 }) => (<svg {...base(size)}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>);
export const MapPin = ({ size = 14 }) => (<svg {...base(size)}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>);
export const Store = ({ size = 24 }) => (<svg {...base(size)}><path d="M3 9h18l-1-5H4L3 9Z" /><path d="M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9" /><path d="M9 20v-6h6v6" /></svg>);
export const Tractor = ({ size = 24 }) => (<svg {...base(size)}><circle cx="7" cy="18" r="3" /><circle cx="18" cy="18" r="2.5" /><path d="M7 15V6h4l3 5h3a2 2 0 0 1 2 2v2.5" /><path d="M4 18h1M13 11l-2 4h-2" /></svg>);
export const CreditCard = ({ size = 16 }) => (<svg {...base(size)}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>);
export const CheckCircle = ({ size = 18 }) => (<svg {...base(size)}><path d="M21.8 11.1a10 10 0 1 1-5.9-8.3" /><path d="m9 11 3 3L22 4" /></svg>);
export const XCircle = ({ size = 18 }) => (<svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>);
export const Loader = ({ size = 16 }) => (<svg {...base(size)} style={{ animation: "spin 0.8s linear infinite" }}><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" /></svg>);

export const RefreshCw = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
);

export const Star = ({ size = 16, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color === "none" ? "currentColor" : color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const Info = ({ size = 16 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
);

export const ArrowLeft = ({ size = 16 }) => (
  <svg {...base(size)}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
);

export const ArrowRight = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);

export const User = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export const Lock = ({ size = 16 }) => (
  <svg {...base(size)}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

export const Eye = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);

export const EyeOff = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);

export const Filter = ({ size = 16 }) => (
  <svg {...base(size)}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
);

export const Sliders = ({ size = 16 }) => (
  <svg {...base(size)}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
);

export const Calendar = ({ size = 16 }) => (
  <svg {...base(size)}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

export const Download = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);

export const ShieldCheck = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
);

export const HelpCircle = ({ size = 16 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
);

export const FileText = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg>
);

export const MessageSquare = ({ size = 16 }) => (
  <svg {...base(size)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);

export const Compass = ({ size = 16 }) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>
);

export const Navigation = ({ size = 16 }) => (
  <svg {...base(size)}><polygon points="3 11 22 2 13 21 11 13 3 11" /></svg>
);

export const Map = ({ size = 16 }) => (
  <svg {...base(size)}><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" /></svg>
);

const Icons = {
  Sprout, Search, Bell, Cart, Heart, Minus, Plus, Trash, Truck, Check, X, Edit, Sun, Moon, Globe, ChevronDown, Menu, Package, TrendingUp, TrendingDown, ShoppingBag, ClipboardList, AlertTriangle, MapPin, Store, Tractor, CreditCard, CheckCircle, XCircle, Loader, RefreshCw, Star, Info, ArrowLeft, ArrowRight, User, Lock, Eye, EyeOff, Filter, Sliders, Calendar, Download, ShieldCheck, HelpCircle, FileText, MessageSquare, Compass, Navigation, Map
};
export default Icons;
