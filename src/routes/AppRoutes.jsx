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
const ValueAdditionPage = lazy(() => import("../pages/farmer/ValueAdditionPage.jsx"));
const ValueAdditionDetailPage = lazy(() => import("../pages/farmer/ValueAdditionDetailPage.jsx"));
const ValueAdditionCalculatorPage = lazy(() => import("../pages/farmer/ValueAdditionCalculatorPage.jsx"));
const ValueAdditionEquipmentPage = lazy(() => import("../pages/farmer/ValueAdditionEquipmentPage.jsx"));
const ValueAdditionProjectsPage = lazy(() => import("../pages/farmer/ValueAdditionProjectsPage.jsx"));
const CropImageAnalyzer = lazy(() => import("../components/ai/CropImageAnalyzer.jsx"));
const MarketplaceAgent = lazy(() => import("../components/ai/MarketplaceAgent.jsx"));
const FarmingGuidePage = lazy(() => import("../pages/farmer/FarmingGuidePage.jsx"));
const CropDetailPage = lazy(() => import("../pages/farmer/CropDetailPage.jsx"));
const FarmDiaryPage = lazy(() => import("../pages/farmer/FarmDiaryPage.jsx"));
const FarmEconomicsPage = lazy(() => import("../pages/farmer/FarmEconomicsPage.jsx"));
const FarmPlannerPage = lazy(() => import("../pages/farmer/FarmPlannerPage.jsx"));

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

// Profile Route guard: dynamically resolves /profile to role-specific profile page
function ProfileRoute() {
  const { role, isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) return <SuspenseFallback />;
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />;
  if (role === "farmer") return <Navigate to="/farmer/profile" replace />;
  if (role === "vendor") return <Navigate to="/vendor/profile" replace />;
  if (role === "admin") return <Navigate to="/admin/profile" replace />;
  return <Navigate to="/login" replace />;
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
        <Route path="tracking" element={<OrderTracking />} />
        <Route path="tracking/:orderId" element={<OrderTracking />} />
        <Route path="analytics" element={<FarmerDashboard />} />
        <Route path="crop-health" element={<CropImageAnalyzer />} />
        <Route path="crop-vision" element={<CropImageAnalyzer />} />
        <Route path="sell-smarter" element={<MarketplaceAgent />} />
        <Route path="selling-agent" element={<MarketplaceAgent />} />
        <Route path="value-addition" element={<ValueAdditionPage />} />
        <Route path="value-addition/calculator" element={<ValueAdditionCalculatorPage />} />
        <Route path="value-addition/equipment" element={<ValueAdditionEquipmentPage />} />
        <Route path="value-addition/projects" element={<ValueAdditionProjectsPage />} />
        <Route path="value-addition/:productId" element={<ValueAdditionDetailPage />} />
        <Route path="farming-guide" element={<FarmingGuidePage />} />
        <Route path="farming-guide/crops" element={<FarmingGuidePage />} />
        <Route path="farming-guide/crops/:cropId" element={<CropDetailPage />} />
        <Route path="farming-guide/soil-compatibility" element={<FarmingGuidePage />} />
        <Route path="farming-guide/calendar" element={<FarmingGuidePage />} />
        <Route path="farming-guide/growth-stages" element={<FarmingGuidePage />} />
        <Route path="farming-guide/crop-rotation" element={<FarmingGuidePage />} />
        <Route path="farming-guide/seed-sowing" element={<FarmingGuidePage />} />
        <Route path="farming-guide/irrigation" element={<FarmingGuidePage />} />
        <Route path="farming-guide/nutrients" element={<FarmingGuidePage />} />
        <Route path="farming-guide/pests" element={<FarmingGuidePage />} />
        <Route path="farming-guide/harvest" element={<FarmingGuidePage />} />
        <Route path="farming-guide/post-harvest" element={<FarmingGuidePage />} />
        <Route path="farm-diary" element={<FarmDiaryPage />} />
        <Route path="farm-economics" element={<FarmEconomicsPage />} />
        <Route path="farm-planner" element={<FarmPlannerPage />} />
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
        <Route path="delivery" element={<AdminDashboard />} />
        <Route path="reviews" element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminDashboard />} />
        <Route path="profile" element={<ProfileSettings />} />
      </Route>

      {/* Global Protected Direct Messages / Chat Route */}
      <Route path="/chat" element={<RoleGuard allowedRole={["farmer", "vendor", "admin"]} />}>
        <Route index element={<ChatPage />} />
        <Route path=":conversationId" element={<ChatPage />} />
      </Route>

      {/* Global Protected Order Tracking Route */}
      <Route path="/tracking" element={<RoleGuard allowedRole={["farmer", "vendor", "admin"]} />}>
        <Route index element={<OrderTracking />} />
        <Route path=":orderId" element={<OrderTracking />} />
      </Route>

      {/* Global Protected Profile Route */}
      <Route path="/profile" element={<ProfileRoute />} />

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
