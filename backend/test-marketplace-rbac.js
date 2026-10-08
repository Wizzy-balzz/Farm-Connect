import http from "http";
import express from "express";
import { signJwt } from "./utils/security.js";
import aiRouter from "./ai/aiRouter.js";

async function runMarketplaceRbacTests() {
  console.log("================================================================================");
  console.log("       FARMCONNECT — MARKETPLACE / SELL-SMARTER RBAC TARGETED TEST SUITE       ");
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

  // Create isolated ephemeral Express instance mounting aiRouter
  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // Test tokens
  const farmerToken = signJwt({ id: "f1", role: "farmer", district: "Nashik", region: "Maharashtra" });
  const adminToken = signJwt({ id: "a1", role: "admin", district: "Chennai", region: "Tamil Nadu" });
  const vendorToken = signJwt({ id: "v1", role: "vendor", district: "Nashik", region: "Maharashtra" });

  const endpoints = [
    {
      name: "Single Crop / Selling Strategy",
      path: "/api/ai/marketplace/selling-strategy",
      method: "POST",
      body: { commodity: "Tomato", quantity: 100 },
      handlerField: "strategy"
    },
    {
      name: "Selling Plan",
      path: "/api/ai/marketplace/selling-plan",
      method: "POST",
      body: {},
      handlerField: "plan"
    },
    {
      name: "Compare Crops",
      path: "/api/ai/marketplace/compare",
      method: "POST",
      body: { commodities: ["Tomato", "Onion"] },
      handlerField: "comparison"
    }
  ];

  async function makeRequest(path, method, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  for (const ep of endpoints) {
    console.log(`\n--- Testing Endpoint: ${ep.name} (${ep.path}) ---`);

    // Case 1: Authenticated farmer -> must NOT return 403
    const farmerRes = await makeRequest(ep.path, ep.method, ep.body, farmerToken);
    assert(
      farmerRes.status === 200,
      `Case 1: Authenticated farmer receives HTTP 200 (not 403) for ${ep.name}`,
      `Got HTTP ${farmerRes.status}: ${JSON.stringify(farmerRes.data)}`
    );
    assert(
      farmerRes.data && farmerRes.data.success === true,
      `Case 1: Authenticated farmer response has success === true for ${ep.name}`
    );

    // Case 2: Authenticated admin -> must NOT return 403
    const adminRes = await makeRequest(ep.path, ep.method, ep.body, adminToken);
    assert(
      adminRes.status === 200,
      `Case 2: Authenticated admin receives HTTP 200 (not 403) for ${ep.name}`,
      `Got HTTP ${adminRes.status}: ${JSON.stringify(adminRes.data)}`
    );
    assert(
      adminRes.data && adminRes.data.success === true,
      `Case 2: Authenticated admin response has success === true for ${ep.name}`
    );

    // Case 3: Authenticated vendor -> must remain forbidden (HTTP 403)
    const vendorRes = await makeRequest(ep.path, ep.method, ep.body, vendorToken);
    assert(
      vendorRes.status === 403,
      `Case 3: Authenticated vendor receives HTTP 403 Forbidden for ${ep.name}`,
      `Got HTTP ${vendorRes.status}: ${JSON.stringify(vendorRes.data)}`
    );
    assert(
      vendorRes.data && vendorRes.data.error?.code === "FORBIDDEN",
      `Case 3: Authenticated vendor response error code is FORBIDDEN for ${ep.name}`
    );

    // Case 4: Unauthenticated request -> must remain rejected (HTTP 401)
    const unauthRes = await makeRequest(ep.path, ep.method, ep.body, null);
    assert(
      unauthRes.status === 401,
      `Case 4: Unauthenticated request receives HTTP 401 Unauthorized for ${ep.name}`,
      `Got HTTP ${unauthRes.status}: ${JSON.stringify(unauthRes.data)}`
    );
    assert(
      unauthRes.data && unauthRes.data.error?.code === "UNAUTHENTICATED",
      `Case 4: Unauthenticated response error code is UNAUTHENTICATED for ${ep.name}`
    );

    // Case 5: Verify business handler is reached for authorized farmer
    const hasHandlerData = farmerRes.data && farmerRes.data[ep.handlerField] !== undefined;
    assert(
      hasHandlerData,
      `Case 5: Business handler reached for authorized farmer — '${ep.handlerField}' payload populated for ${ep.name}`
    );

    // Case 6: Verify authorization still terminates requests before business handler execution
    const vendorHasNoBusinessData = !vendorRes.data || vendorRes.data[ep.handlerField] === undefined;
    const unauthHasNoBusinessData = !unauthRes.data || unauthRes.data[ep.handlerField] === undefined;
    assert(
      vendorHasNoBusinessData && unauthHasNoBusinessData,
      `Case 6: Authorization terminates request before business handler execution for unauthorized roles (${ep.name})`
    );
  }

  // Teardown ephemeral server
  await new Promise((resolve) => server.close(resolve));

  console.log("\n================================================================================");
  console.log(`MARKETPLACE RBAC TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runMarketplaceRbacTests().catch((err) => {
  console.error("Marketplace RBAC test runner encountered an unexpected error:", err);
  process.exit(1);
});
