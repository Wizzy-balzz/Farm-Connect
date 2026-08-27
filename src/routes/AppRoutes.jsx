import { lazy, Suspense, useState } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { LoadingState } from "../components/common/LoadingState.jsx";

// Layout components (loaded synchronously for shell stability)
import Navbar from "../components/layout/Navbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import Footer from "../components/layout/Footer.jsx";
import AiChatDrawer from "../components/ai/AiChatDrawer.jsx";

// Lazy-loaded page components for optimal bundle splitting
const LandingPage = lazy(() => import("../pages/public/LandingPage.jsx"));
const Login = lazy(() => import("../pages/public/Login.jsx"));
const Register = lazy(() => import("../pages/public/Register.jsx"));
const ForgotPassword = lazy(() => import("../pages/public/ForgotPassword.jsx"));
const Support = lazy(() => import("../pages/public/Support.jsx"));
const FarmerProfile = lazy(() => import("../pages/public/FarmerProfile.jsx"));

const FarmerDashboard = lazy(() => import("../pages/farmer/FarmerDashboard.jsx"));
const MyFarm = lazy(() => import("../pages/farmer/MyFarm.jsx"));
const MyProducts = lazy(() => import("../pages/farmer/MyProducts.jsx"));
const FarmerOrders = lazy(() => import("../pages/farmer/FarmerOrders.jsx"));

const VendorDashboard = lazy(() => import("../pages/vendor/VendorDashboard.jsx"));
const Marketplace = lazy(() => import("../pages/vendor/Marketplace.jsx"));
const ProductDetails = lazy(() => import("../pages/vendor/ProductDetails.jsx"));
const Wishlist = lazy(() => import("../pages/vendor/Wishlist.jsx"));
const CartPage = lazy(() => import("../pages/vendor/CartPage.jsx"));
const Checkout = lazy(() => import("../pages/vendor/Checkout.jsx"));
const OrderHistory = lazy(() => import("../pages/vendor/OrderHistory.jsx"));
const OrderTracking = lazy(() => import("../pages/vendor/OrderTracking.jsx"));

const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard.jsx"));
const ProfileSettings = lazy(() => import("../pages/common/ProfileSettings.jsx"));
const ChatPage = lazy(() => import("../pages/chat/ChatPage.jsx"));
const NotFound = lazy(() => import("../pages/public/NotFound.jsx"));

function SuspenseFallback() {
  return (
    <div style={{ padding: "60px 0" }}>
      <LoadingState text="Loading page module..." />
    </div>
  );
}

// Layout shell that coordinates Navbar, Sidebar, and page content
function LayoutShell() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="fc-app animate-fade-in">
      <Navbar onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
      <div className="fc-shell">
        <Sidebar mobileOpen={mobileSidebarOpen} onCloseMobile={() => setMobileSidebarOpen(false)} />
        <main className="fc-main">
          <Suspense fallback={<SuspenseFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Footer />
      <AiChatDrawer />
    </div>
  );
}

// Public Route guard
function PublicRoute() {
  const { role, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <SuspenseFallback />;
  if (isAuthenticated && role === "farmer") return <Navigate to="/farmer/dashboard" replace />;
  if (isAuthenticated && role === "vendor") return <Navigate to="/vendor/dashboard" replace />;
  if (isAuthenticated && role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <LandingPage />
    </Suspense>
  );
}

// Login Route guard
function LoginRoute() {
  const { role, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <SuspenseFallback />;
  if (isAuthenticated && role === "farmer") return <Navigate to="/farmer/dashboard" replace />;
  if (isAuthenticated && role === "vendor") return <Navigate to="/vendor/dashboard" replace />;
  if (isAuthenticated && role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Login />
    </Suspense>
  );
}

// Register Route guard
function RegisterRoute() {
  const { role, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <SuspenseFallback />;
  if (isAuthenticated && role === "farmer") return <Navigate to="/farmer/dashboard" replace />;
  if (isAuthenticated && role === "vendor") return <Navigate to="/vendor/dashboard" replace />;
  if (isAuthenticated && role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Register />
    </Suspense>
  );
}

// Forgot Password Route guard
function ForgotPasswordRoute() {
  const { role, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <SuspenseFallback />;
  if (isAuthenticated && role === "farmer") return <Navigate to="/farmer/dashboard" replace />;
  if (isAuthenticated && role === "vendor") return <Navigate to="/vendor/dashboard" replace />;
  if (isAuthenticated && role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <ForgotPassword />
    </Suspense>
  );
}

// Guard for role-specific routes
function RoleGuard({ allowedRole }) {
  const { user, role, isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <SuspenseFallback />;
  }

  if (!isAuthenticated || !user || !role) {
    return <Navigate to="/login" replace />;
  }

  const isAllowed = Array.isArray(allowedRole)
    ? allowedRole.includes(role)
    : role === allowedRole;

  if (!isAllowed) {
    const dest =
      role === "farmer"
        ? "/farmer/dashboard"
        : role === "vendor"
        ? "/vendor/dashboard"
        : "/admin/dashboard";
    return <Navigate to={dest} replace />;
  }

  return <LayoutShell />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<PublicRoute />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />
      <Route path="/forgot-password" element={<ForgotPasswordRoute />} />
      <Route
        path="/support"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <Support />
          </Suspense>
        }
      />
      <Route
        path="/farmer-profile/:farmerId"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <FarmerProfile />
          </Suspense>
        }
      />

      {/* Farmer Pages */}
      <Route path="/farmer" element={<RoleGuard allowedRole="farmer" />}>
        <Route index element={<Navigate to="/farmer/dashboard" replace />} />
        <Route path="dashboard" element={<FarmerDashboard />} />
        <Route path="farm" element={<MyFarm />} />
        <Route path="products" element={<MyProducts />} />
        <Route path="products/add" element={<MyProducts openAdd={true} />} />
        <Route path="orders" element={<FarmerOrders />} />
        <Route path="orders/:orderId" element={<FarmerOrders />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Route>

      {/* Vendor Pages */}
      <Route path="/vendor" element={<RoleGuard allowedRole="vendor" />}>
        <Route index element={<Navigate to="/vendor/dashboard" replace />} />
        <Route path="dashboard" element={<VendorDashboard />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="products/:productId" element={<ProductDetails />} />
        <Route path="farmer-profile/:farmerId" element={<FarmerProfile />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders" element={<OrderHistory />} />
        <Route path="orders/:orderId" element={<OrderHistory />} />
        <Route path="tracking" element={<OrderTracking />} />
        <Route path="tracking/:orderId" element={<OrderTracking />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Route>

      {/* Admin Pages */}
      <Route path="/admin" element={<RoleGuard allowedRole="admin" />}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminDashboard />} />
        <Route path="farmers" element={<AdminDashboard />} />
        <Route path="vendors" element={<AdminDashboard />} />
        <Route path="products" element={<AdminDashboard />} />
        <Route path="orders" element={<AdminDashboard />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Route>

      {/* Global Protected Direct Messages / Chat Route */}
      <Route path="/chat" element={<RoleGuard allowedRole={["farmer", "vendor", "admin"]} />}>
        <Route index element={<ChatPage />} />
        <Route path=":conversationId" element={<ChatPage />} />
      </Route>

      {/* 404 Route */}
      <Route
        path="*"
        element={
          <Suspense fallback={<SuspenseFallback />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
}
