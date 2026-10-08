import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { pool, initDatabase, query } from "./database.js";
import { signJwt } from "./utils/security.js";
import { parseCookies } from "./middleware/auth.js";
import farmingGuideRouter from "./routes/farmingGuideRouter.js";
import { seedFarmingGuide } from "./seed-farming-guide.js";

const TEST_PORT = 5055;
const API_BASE = `http://127.0.0.1:${TEST_PORT}/api`;

async function runTests() {
  console.log("=== FARMCONNECT PHASE B API TEST SUITE ===");
  await initDatabase();
  await seedFarmingGuide();

  // Setup test Express server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    req.cookies = parseCookies(req);
    next();
  });

  app.use("/api/farming-guide", farmingGuideRouter);
  app.use("/api/farm-diary", farmingGuideRouter);
  app.use("/api/farm-planner", farmingGuideRouter);

  const server = app.listen(TEST_PORT);

  // Generate test JWT for farmer
  const farmerToken = signJwt({ id: "user_farmer_101", role: "farmer", email: "farmer_b7@farmconnect.com" });
  const vendorToken = signJwt({ id: "user_vendor_101", role: "vendor", email: "vendor_b7@farmconnect.com" });
  const authHeaders = { "Authorization": `Bearer ${farmerToken}`, "Cookie": `fc_token=${farmerToken}` };

  // Ensure test users exist for FK constraint
  const now = new Date().toISOString();
  await query.run("DELETE FROM users WHERE email IN (?, ?) OR id IN (?, ?)", ["farmer_b7@farmconnect.com", "vendor_b7@farmconnect.com", "user_farmer_101", "user_vendor_101"]);
  await query.run(
    "INSERT INTO users (id, name, email, role, createdAt) VALUES (?, 'Test Farmer', 'farmer_b7@farmconnect.com', 'farmer', ?)",
    ["user_farmer_101", now]
  );
  await query.run(
    "INSERT INTO users (id, name, email, role, createdAt) VALUES (?, 'Test Vendor', 'vendor_b7@farmconnect.com', 'vendor', ?)",
    ["user_vendor_101", now]
  );

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`[FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  try {
    // 1. GET /api/farming-guide/crops
    await test("B1: Search & Filter Crop Library", async () => {
      const res = await fetch(`${API_BASE}/farming-guide/crops?q=Rice`);
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error("Failed to search crops or Rice not found");
      }
      const crop = json.data[0];
      if (!crop.source || !crop.last_verified) {
        throw new Error("Crop missing authoritative source or last_verified date");
      }
    });

    // 2. GET /api/farming-guide/crops/:id
    await test("B1: Fetch Crop Detail with Soil & Climate Requirements", async () => {
      const res = await fetch(`${API_BASE}/farming-guide/crops/crop_rice`);
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error("Failed to fetch crop detail for Rice");
      }
      if (json.data.name !== "Rice" || !json.data.soil_texture || !json.data.ph_min) {
        throw new Error("Rice detail missing soil texture or pH requirements");
      }
    });

    // 3. POST /api/farming-guide/soil-compatibility
    await test("B2: Soil Compatibility Deterministic Engine", async () => {
      const payload = {
        soilType: "Clay Loam",
        ph: 6.5,
        season: "Kharif",
        waterAvailability: "High / Irrigated"
      };
      const res = await fetch(`${API_BASE}/farming-guide/soil-compatibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error("Soil compatibility check failed");
      }
      const topResult = json.data[0];
      if (!topResult.crop || !topResult.compatibility || !Array.isArray(topResult.reasons)) {
        throw new Error("Invalid compatibility result structure");
      }
    });

    // 4. GET /api/farming-guide/crops/crop_rice/calendar
    await test("B3: Crop Calendar & Growth Stages", async () => {
      const res = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/calendar`);
      const json = await res.json();
      if (!json.success || !Array.isArray(json.stages) || json.stages.length === 0) {
        throw new Error("Failed to fetch growth stages for Rice");
      }
      const stage1 = json.stages[0];
      if (!stage1.stage_name || !stage1.farmer_activity) {
        throw new Error("Growth stage missing activity or name");
      }
    });

    // 5. POST /api/farming-guide/rotation/recommend
    await test("B4: Crop Rotation & Seed/Sowing Guide", async () => {
      const rotRes = await fetch(`${API_BASE}/farming-guide/rotation/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousCrop: "Rice" })
      });
      const rotJson = await rotRes.json();
      if (!rotJson.success || !Array.isArray(rotJson.suggestions)) {
        throw new Error("Failed rotation recommendation query");
      }

      const ssRes = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/seed-sowing`);
      const ssJson = await ssRes.json();
      if (!ssJson.success || !ssJson.guide) {
        throw new Error("Failed seed sowing query for Rice");
      }
    });

    // 6. GET /api/farming-guide/crops/crop_rice/irrigation & nutrients
    await test("B5: Irrigation & Nutrient Safety Guide", async () => {
      const irRes = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/irrigation`);
      const irJson = await irRes.json();
      if (!irJson.success || !irJson.guide.rainfall_considerations) {
        throw new Error("Irrigation guide missing rainfall consideration integration");
      }

      const nuRes = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/nutrients`);
      const nuJson = await nuRes.json();
      if (!nuJson.success || !nuJson.soilTestNotice) {
        throw new Error("Nutrient guide missing soil test mandatory safety notice");
      }
    });

    // 7. GET /api/farming-guide/crops/crop_rice/pests, harvest & post-harvest
    await test("B6: Pest/Disease, Harvest & Post-Harvest", async () => {
      const pestRes = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/pests`);
      const pestJson = await pestRes.json();
      if (!pestJson.success || !Array.isArray(pestJson.pests)) {
        throw new Error("Failed to fetch pest/disease guide");
      }

      const hpRes = await fetch(`${API_BASE}/farming-guide/crops/crop_rice/post-harvest`);
      const hpJson = await hpRes.json();
      if (!hpJson.success || !hpJson.postHarvest.storage) {
        throw new Error("Failed to fetch post-harvest storage details");
      }
    });

    // 8. Farm Diary CRUD & IDOR Security Checks
    await test("B7: Farm Diary CRUD & IDOR Prevention", async () => {
      // Create record as farmer
      const createRes = await fetch(`${API_BASE}/farm-diary/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          cropName: "Tomato",
          areaAcres: 1.5,
          sowingDate: "2026-02-01",
          location: "Plot A",
          expenses: 3500
        })
      });
      const createJson = await createRes.json();
      if (!createJson.success || !createJson.data || !createJson.data.id) {
        throw new Error(`Failed to create farm diary record: ${JSON.stringify(createJson)}`);
      }
      const recordId = createJson.data.id;

      // Read records as farmer
      const getRes = await fetch(`${API_BASE}/farm-diary/records`, {
        headers: authHeaders
      });
      const getJson = await getRes.json();
      if (!getJson.success || getJson.count === 0) {
        throw new Error("Failed to read farmer diary records");
      }

      // IDOR check: Vendor should be forbidden
      const vendorRes = await fetch(`${API_BASE}/farm-diary/records`, {
        headers: { "Authorization": `Bearer ${vendorToken}`, "Cookie": `fc_token=${vendorToken}` }
      });
      if (vendorRes.status !== 403) {
        throw new Error(`IDOR failure: Vendor received status ${vendorRes.status} instead of 403 Forbidden`);
      }

      // Delete record as farmer
      const delRes = await fetch(`${API_BASE}/farm-diary/records/${recordId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const delJson = await delRes.json();
      if (!delJson.success) {
        throw new Error("Failed to delete own farm diary record");
      }
    });

    // 9. POST /api/farming-guide/economics/calculate
    await test("B7: Farm Economics Server-Side Engine", async () => {
      const payload = {
        cropName: "Rice",
        areaAcres: 2.5,
        seedCost: 2500,
        fertilizerCost: 6000,
        labourCost: 8000,
        irrigationCost: 2000,
        pestCost: 1500,
        transportCost: 1200,
        otherCost: 800,
        expectedYieldQty: 5000,
        expectedYieldUnit: "kg",
        expectedSellingPrice: 25
      };
      const res = await fetch(`${API_BASE}/farming-guide/economics/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error("Economics calculation failed");
      }
      const d = json.data;
      if (d.totalCost !== 22000) {
        throw new Error(`Total cost mismatch: expected 22000, got ${d.totalCost}`);
      }
      if (d.expectedRevenue !== 125000) {
        throw new Error(`Expected revenue mismatch: expected 125000, got ${d.expectedRevenue}`);
      }
      if (d.estimatedProfit !== 103000) {
        throw new Error(`Estimated profit mismatch: expected 103000, got ${d.estimatedProfit}`);
      }
    });

    // 10. POST /api/farm-planner/recommend
    await test("B8: 'What Should I Farm?' Signature Farm Planner", async () => {
      const payload = {
        location: "Thanjavur",
        district: "Thanjavur",
        soilType: "Clay Loam",
        waterAvailability: "High / Irrigated",
        season: "Kharif",
        landArea: 3.0,
        previousCrop: "Maize"
      };
      const res = await fetch(`${API_BASE}/farm-planner/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data) || json.data.length === 0) {
        throw new Error("Farm planner failed to generate recommendations");
      }
      const topRec = json.data[0];
      if (!topRec.crop || !topRec.compatibilityScore || !topRec.relevantGovernmentSchemes) {
        throw new Error("Planner recommendation missing score or integrated government schemes");
      }
    });

    console.log(`\nPhase B API Test Summary: ${passed} Passed, ${failed} Failed`);
  } finally {
    server.close();
  }

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
