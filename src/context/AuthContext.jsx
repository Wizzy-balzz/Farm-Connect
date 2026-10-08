/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useMemo, useCallback } from "react";
import { apiFetch } from "../services/api.js";
import { CURRENT_FARMER } from "../utils/constants.js";

export const AuthContext = createContext(null);

const DEMO_CREDENTIALS = [
  { email: "farmer@farmconnect.com", password: "farmer123", role: "farmer", name: "Rajesh Kumar" },
  { email: "vendor@farmconnect.com", password: "vendor123", role: "vendor", name: "Ananya's Kitchen" },
  { email: "admin@farmconnect.com", password: "admin123", role: "admin", name: "Platform Admin" }
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Restore authenticated session from httpOnly cookie on app load / refresh
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const data = await apiFetch("/api/auth/me");
        if (isMounted && data && data.user) {
          setUser(data.user);
          setRole(data.user.role);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const currentVendorProfile = useMemo(() => {
    if (user && role === "vendor") {
      return { id: user.id, name: user.name };
    }
    return { id: "v1", name: "Ananya's Kitchen" };
  }, [user, role]);

  const currentFarmerProfile = useMemo(() => {
    if (user && role === "farmer") {
      return {
        id: user.id,
        name: user.name,
        farmName: user.farmName || "My Farm",
        region: user.region || "Maharashtra",
      };
    }
    return CURRENT_FARMER;
  }, [user, role]);

  const login = useCallback(async (email, password) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    const authUser = data.user;
    setUser(authUser);
    setRole(authUser.role);
    return authUser;
  }, []);

  const loginWithGoogle = useCallback(async (credential, requestedRole) => {
    const data = await apiFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, role: requestedRole })
    });

    if (data && data.requiresOnboarding) {
      return data;
    }

    const authUser = data.user;
    if (authUser) {
      setUser(authUser);
      setRole(authUser.role);
    }
    return authUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout request errors */
    } finally {
      setUser(null);
      setRole(null);
      try {
        localStorage.removeItem("fc_auth_user");
        localStorage.removeItem("fc_role");
        localStorage.removeItem("fc_cart_state");
      } catch {
        /* noop */
      }
    }
  }, []);

  const register = useCallback(async (payload) => {
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const authUser = data.user;
    setUser(authUser);
    setRole(authUser.role);
    return authUser;
  }, []);

  const updateProfile = useCallback(async (userId, payload) => {
    const updatedUser = await apiFetch(`/api/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    setUser(updatedUser);
    return updatedUser;
  }, []);

  const chooseRole = useCallback(async (r) => {
    const demo = DEMO_CREDENTIALS.find((c) => c.role === r);
    if (demo) {
      await login(demo.email, demo.password, r).catch((err) => console.error("Role login failed:", err));
    }
  }, [login]);

  const isAuthenticated = !!user && !!role;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      role,
      isInitializing,
      login,
      loginWithGoogle,
      logout,
      register,
      updateProfile,
      chooseRole,
      exitDemo: logout,
      farmerProfile: currentFarmerProfile,
      vendorProfile: currentVendorProfile
    }),
    [
      user,
      isAuthenticated,
      role,
      isInitializing,
      login,
      loginWithGoogle,
      logout,
      register,
      updateProfile,
      chooseRole,
      currentFarmerProfile,
      currentVendorProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
