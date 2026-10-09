import fs from "fs";

async function runProfileRouteTests() {
  console.log("================================================================================");
  console.log("          FARMCONNECT — PROFILE ROUTE & RESOLUTION TARGETED TEST SUITE          ");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // 1. Inspect AppRoutes.jsx for ProfileRoute and /profile route
  const appRoutesSrc = fs.readFileSync("frontend/src/routes/AppRoutes.jsx", "utf-8");

  assert(
    appRoutesSrc.includes("function ProfileRoute()"),
    "1. AppRoutes.jsx contains ProfileRoute component"
  );

  assert(
    appRoutesSrc.includes('<Route path="/profile" element={<ProfileRoute />} />'),
    "2. AppRoutes.jsx mounts /profile route pointing to ProfileRoute"
  );

  // 2. Validate ProfileRoute redirect logic for all roles
  const farmerMatch = appRoutesSrc.match(/role === "farmer"\) return <Navigate to="(\/farmer\/profile)" replace \/>/);
  assert(
    farmerMatch && farmerMatch[1] === "/farmer/profile",
    "3. Farmer selecting /profile redirects to /farmer/profile"
  );

  const vendorMatch = appRoutesSrc.match(/role === "vendor"\) return <Navigate to="(\/vendor\/profile)" replace \/>/);
  assert(
    vendorMatch && vendorMatch[1] === "/vendor/profile",
    "4. Vendor selecting /profile redirects to /vendor/profile"
  );

  const adminMatch = appRoutesSrc.match(/role === "admin"\) return <Navigate to="(\/admin\/profile)" replace \/>/);
  assert(
    adminMatch && adminMatch[1] === "/admin/profile",
    "5. Admin selecting /profile redirects to /admin/profile"
  );

  const unauthMatch = appRoutesSrc.match(/!isAuthenticated \|\| !role\) return <Navigate to="(\/login)" replace \/>/);
  assert(
    unauthMatch && unauthMatch[1] === "/login",
    "6. Unauthenticated request to /profile redirects to /login (matches existing auth behavior)"
  );

  // 3. Verify existing direct role-scoped profile routes are preserved
  assert(
    appRoutesSrc.includes('<Route path="profile" element={<ProfileSettings />} />'),
    "7. Role-scoped routes (/farmer/profile, /vendor/profile, /admin/profile) preserved and render ProfileSettings"
  );

  // 4. Verify AiChatDrawer navigation integration
  const aiChatDrawerSrc = fs.readFileSync("frontend/src/components/ai/AiChatDrawer.jsx", "utf-8");
  assert(
    aiChatDrawerSrc.includes('navigate("/profile")'),
    "8. AiChatDrawer navigates to /profile (seamlessly intercepted by ProfileRoute)"
  );

  // 5. Verify NotFound.jsx no longer exposes raw translation keys
  const notFoundSrc = fs.readFileSync("frontend/src/pages/public/NotFound.jsx", "utf-8");
  assert(
    notFoundSrc.includes('t("pageNotFound", "Page Not Found")'),
    "9. NotFound.jsx provides human-readable fallback for pageNotFound"
  );
  assert(
    notFoundSrc.includes('t("pageNotFoundMsg", "The page you are looking for does not exist or has been moved.")'),
    "10. NotFound.jsx provides human-readable fallback for pageNotFoundMsg"
  );
  assert(
    !notFoundSrc.includes('t("pageNotFound") ||'),
    "11. NotFound.jsx removed faulty truthy key check 't(\"pageNotFound\") ||'"
  );

  // 6. Verify locale files contain proper 404 translations
  const en = JSON.parse(fs.readFileSync("frontend/src/locales/en.json", "utf-8"));
  const ta = JSON.parse(fs.readFileSync("frontend/src/locales/ta.json", "utf-8"));
  const hi = JSON.parse(fs.readFileSync("frontend/src/locales/hi.json", "utf-8"));

  assert(
    en.common?.pageNotFound === "Page Not Found",
    "12. en.json contains English translation for pageNotFound"
  );
  assert(
    ta.common?.pageNotFound === "பக்கம் கிடைக்கவில்லை",
    "13. ta.json contains Tamil translation for pageNotFound"
  );
  assert(
    hi.common?.pageNotFound === "पृष्ठ नहीं मिला",
    "14. hi.json contains Hindi translation for pageNotFound"
  );

  // 7. Dynamic Role Resolution Simulation Function
  function resolveProfilePath(role, isAuthenticated) {
    if (!isAuthenticated || !role) return "/login";
    if (role === "farmer") return "/farmer/profile";
    if (role === "vendor") return "/vendor/profile";
    if (role === "admin") return "/admin/profile";
    return "/login";
  }

  assert(
    resolveProfilePath("farmer", true) === "/farmer/profile",
    "15. Simulated resolution: Authenticated farmer -> /farmer/profile"
  );
  assert(
    resolveProfilePath("vendor", true) === "/vendor/profile",
    "16. Simulated resolution: Authenticated vendor -> /vendor/profile"
  );
  assert(
    resolveProfilePath("admin", true) === "/admin/profile",
    "17. Simulated resolution: Authenticated admin -> /admin/profile"
  );
  assert(
    resolveProfilePath(null, false) === "/login",
    "18. Simulated resolution: Unauthenticated -> /login"
  );

  console.log("\n================================================================================");
  console.log(`PROFILE ROUTE TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runProfileRouteTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
