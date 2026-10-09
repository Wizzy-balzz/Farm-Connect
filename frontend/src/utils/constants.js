/* ========================================================================
   FarmConnect Centralized Constants
   ======================================================================== */

export const CATEGORIES = ["Vegetables", "Grains", "Fruits", "Spices", "Dairy"];
export const REGIONS = ["Maharashtra", "Punjab", "Haryana", "Ratnagiri", "Kerala", "Gujarat", "Andhra Pradesh"];
export const UNITS = ["kg", "quintal", "dozen", "liter", "ton"];
export const GRADES = ["A", "B", "C"];

// Order lifecycle statuses
export const ORDER_STATUSES = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In Transit",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

// Map backend status values to CSS class suffix
export const STATUS_CLASS_MAP = {
  Pending: "pending",
  Confirmed: "confirmed",
  Accepted: "accepted",
  Preparing: "preparing",
  Dispatched: "dispatched",
  "In Transit": "in-transit",
  "Out for Delivery": "dispatched",
  "Ready for Pickup": "preparing",
  "Picked Up": "dispatched",
  Delivered: "delivered",
  Cancelled: "cancelled",
  Rejected: "rejected",
};

// Verification statuses
export const VERIFICATION_STATUSES = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

// Product grade colors
export const GRADE_COLORS = {
  A: "#166534",
  B: "#b45309",
  C: "#6b7280",
};

// Security questions for registration
export const SECURITY_QUESTIONS = [
  "What is your favorite food?",
  "What city were you born in?",
  "What is your pet's name?",
  "What was your first school?",
  "What is your mother's maiden name?",
];

// Payment methods
export const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery" },
  { value: "upi", label: "UPI Payment" },
  { value: "card", label: "Credit / Debit Card" },
];

// Category image mapping for product cards
export const CATEGORY_IMAGES = {
  Vegetables: "/images/products/tomatoes.jpg",
  Grains: "/images/products/rice.jpg",
  Fruits: "/images/farmconnect-produce.jpg",
  Spices: "/images/farmconnect-produce.jpg",
  Dairy: "/images/farmconnect-farm.jpg",
};

// Product-specific images by name
export const PRODUCT_IMAGES = {
  tomato: "/images/products/tomatoes.jpg",
  onion: "/images/products/onions.jpg",
  spinach: "/images/products/spinach.jpg",
  potato: "/images/products/potatoes.jpg",
  rice: "/images/products/rice.jpg",
  wheat: "/images/products/rice.jpg",
  basmati: "/images/products/rice.jpg",
};

// Get image for a product based on name/category
export function getProductImage(product) {
  if (!product) return "/images/farmconnect-produce.jpg";
  if (product.imageUrl && product.imageUrl.startsWith("/")) return product.imageUrl;

  const nameLower = (product.name || "").toLowerCase();
  for (const [key, url] of Object.entries(PRODUCT_IMAGES)) {
    if (nameLower.includes(key)) return url;
  }

  return CATEGORY_IMAGES[product.category] || "/images/farmconnect-produce.jpg";
}

// Get status badge CSS class
export function getStatusClass(status) {
  return STATUS_CLASS_MAP[status] || "pending";
}

// Demo data defaults (kept for backward compatibility)
export const CURRENT_FARMER = {
  id: "f1",
  name: "Rajesh Kumar",
  farmName: "Green Valley Farms",
  region: "Maharashtra",
};

export const OTHER_FARMERS = [
  { id: "f2", name: "Satish Patil", region: "Punjab" },
  { id: "f3", name: "Gurpreet Singh", region: "Haryana" },
  { id: "f4", name: "Milind Rao", region: "Ratnagiri" },
  { id: "f5", name: "Kiran Dev", region: "Kerala" },
  { id: "f6", name: "Gopal Yadav", region: "Gujarat" },
  { id: "f7", name: "Naidu Reddy", region: "Andhra Pradesh" },
];

export const ALL_FARMERS = [CURRENT_FARMER, ...OTHER_FARMERS];
