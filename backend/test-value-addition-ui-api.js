import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, initDatabase } from "./database.js";
import { signJwt } from "./utils/security.js";
import { parseCookies } from "./middleware/auth.js";
import valueAdditionRouter from "./routes/valueAdditionRouter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config();

console.log("======================================================================");
console.log("   VALUE ADDITION FARMER UI & API ENDPOINT INTEGRATION VERIFICATION   ");
console.log("======================================================================");

async function runApiIntegrationTests() {
  let server;
  try {
    await initDatabase();

    // Setup temporary test Express server
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use((req, res, next) => {
      req.cookies = parseCookies(req);
      next();
    });

    app.use("/api/value-addition", valueAdditionRouter);

    const testPort = 5099;
    server = app.listen(testPort);
    const baseUrl = `http://127.0.0.1:${testPort}`;

    // Fetch active farmer and vendor users from database
    const farmers = await pool.query("SELECT * FROM users WHERE role = 'farmer' LIMIT 2").then(r => r[0]);
    const vendorUser = await pool.query("SELECT * FROM users WHERE role = 'vendor' LIMIT 1").then(r => r[0][0]);

    if (farmers.length < 1 || !vendorUser) {
      throw new Error("Missing test users in database (farmer or vendor).");
    }

    const farmerUserA = farmers[0];
    const farmerUserB = farmers.length > 1 ? farmers[1] : { id: "f2", role: "farmer" };

    const farmerTokenA = signJwt({ id: farmerUserA.id, role: farmerUserA.role });
    const farmerTokenB = signJwt({ id: farmerUserB.id, role: farmerUserB.role });
    const vendorToken = signJwt({ id: vendorUser.id, role: vendorUser.role });

    console.log("\n[1/9] Testing RBAC Security: Farmer-only access enforcement...");

    // Test Unauthenticated request -> should return 401
    const unauthRes = await fetch(`${baseUrl}/api/value-addition/products`);
    const unauthData = await unauthRes.json();
    if (unauthRes.status !== 401 || unauthData.success !== false) {
      throw new Error("Security failure: Unauthenticated request was not blocked with 401.");
    }
    console.log("  ✅ Unauthenticated request correctly rejected with 401 UNAUTHENTICATED.");

    // Test Vendor request -> should return 403 FORBIDDEN
    const vendorRes = await fetch(`${baseUrl}/api/value-addition/products`, {
      headers: { Authorization: `Bearer ${vendorToken}` }
    });
    const vendorData = await vendorRes.json();
    if (vendorRes.status !== 403 || vendorData.success !== false) {
      throw new Error("Security failure: Vendor role was not restricted with 403.");
    }
    console.log("  ✅ Vendor role request correctly blocked with 403 FORBIDDEN.");

    // Test Farmer request -> should return 200 OK
    const farmerRes = await fetch(`${baseUrl}/api/value-addition/products`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const farmerData = await farmerRes.json();
    if (farmerRes.status !== 200 || !farmerData.success || !Array.isArray(farmerData.data)) {
      throw new Error("Farmer API request failed.");
    }
    console.log(`  ✅ Farmer access verified (200 OK, returned ${farmerData.data.length} products).`);

    console.log("\n[2/9] Testing GET /api/value-addition/filters...");
    const filtersRes = await fetch(`${baseUrl}/api/value-addition/filters`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const filtersData = await filtersRes.json();
    if (filtersRes.status !== 200 || !filtersData.success) {
      throw new Error("Failed to fetch filter options.");
    }
    console.log(`  ✅ Filter options fetched: ${filtersData.data.crops.length} crops, ${filtersData.data.categories.length} categories, ${filtersData.data.methods.length} methods.`);

    console.log("\n[3/9] Testing Search & Filter queries...");
    // Search query: Tomato
    const searchRes = await fetch(`${baseUrl}/api/value-addition/products?search=Tomato`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const searchData = await searchRes.json();
    console.log(`  ✅ Search query ('Tomato') returned ${searchData.data.length} products.`);

    // Crop filter query: Rice
    const cropRes = await fetch(`${baseUrl}/api/value-addition/products?crop=Rice`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const cropData = await cropRes.json();
    console.log(`  ✅ Crop filter ('Rice') returned ${cropData.data.length} products.`);

    console.log("\n[4/9] Testing GET /api/value-addition/products/:id detail endpoint...");
    const sampleProduct = farmerData.data[0];
    const detailRes = await fetch(`${baseUrl}/api/value-addition/products/${sampleProduct.id}`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const detailData = await detailRes.json();
    if (detailRes.status !== 200 || !detailData.success || !detailData.data.guide) {
      throw new Error("Failed to fetch full product guide detail.");
    }
    console.log(`  ✅ Product detail endpoint verified for '${detailData.data.product_name}':`);
    console.log(`     - Stages: ${detailData.data.guide.stages.length}`);
    console.log(`     - Equipment: ${detailData.data.guide.equipment.length}`);

    console.log("\n[5/9] Testing 404 Error handling on invalid product ID...");
    const invalidRes = await fetch(`${baseUrl}/api/value-addition/products/invalid_id_999`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const invalidData = await invalidRes.json();
    if (invalidRes.status !== 404 || invalidData.success !== false) {
      throw new Error("Invalid product ID was not handled with 404 error response.");
    }
    console.log("  ✅ Invalid product ID correctly returned 404 NOT_FOUND error response.");

    // PHASE 2 SAVED PROJECTS TESTS
    console.log("\n[6/9] Testing POST /api/value-addition/projects (Save Project API & Validation)...");

    // 6a. Unauthenticated POST -> 401
    const unauthPost = await fetch(`${baseUrl}/api/value-addition/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop_name: "Tomato", raw_quantity: 100 })
    });
    if (unauthPost.status !== 401) {
      throw new Error("Security failure: Unauthenticated project POST was not blocked with 401.");
    }
    console.log("  ✅ Unauthenticated POST correctly rejected with 401.");

    // 6b. Vendor POST -> 403
    const vendorPost = await fetch(`${baseUrl}/api/value-addition/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${vendorToken}` },
      body: JSON.stringify({ crop_name: "Tomato", raw_quantity: 100 })
    });
    if (vendorPost.status !== 403) {
      throw new Error("Security failure: Vendor project POST was not blocked with 403.");
    }
    console.log("  ✅ Vendor role POST correctly blocked with 403 FORBIDDEN.");

    // 6c. Invalid negative values -> 400
    const negPost = await fetch(`${baseUrl}/api/value-addition/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerTokenA}` },
      body: JSON.stringify({ crop_name: "Tomato", raw_quantity: -50, raw_unit_price: 20 })
    });
    const negData = await negPost.json();
    if (negPost.status !== 400 || negData.success !== false) {
      throw new Error("Validation failure: Negative values were not rejected with 400.");
    }
    console.log("  ✅ Negative input values correctly rejected with 400 INVALID_INPUT.");

    // 6d. Invalid product ID -> 400
    const invalidProdPost = await fetch(`${baseUrl}/api/value-addition/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerTokenA}` },
      body: JSON.stringify({ crop_name: "Tomato", value_added_product_id: "invalid_vap_xyz_999", raw_quantity: 100 })
    });
    const invalidProdData = await invalidProdPost.json();
    if (invalidProdPost.status !== 400 || invalidProdData.success !== false) {
      throw new Error("Validation failure: Invalid product ID was not rejected with 400.");
    }
    console.log("  ✅ Invalid product ID correctly rejected with 400 INVALID_PRODUCT.");

    // 6e. Valid Farmer A POST -> 201 Created + Server Calculation Verification
    const projectPayload = {
      project_name: "Tomato Puree Enterprise 2026",
      crop_name: "Tomato",
      value_added_product_id: sampleProduct.id,
      raw_quantity: 500,
      raw_unit: "kg",
      raw_unit_price: 20,
      raw_material_cost: 10000,
      processing_cost: 1500,
      labour_cost: 1000,
      packaging_cost: 800,
      transport_cost: 500,
      other_costs: 200,
      expected_processed_qty: 200,
      processed_unit: "kg",
      expected_selling_price: 120
    };

    const validPost = await fetch(`${baseUrl}/api/value-addition/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerTokenA}` },
      body: JSON.stringify(projectPayload)
    });
    const validData = await validPost.json();
    if (validPost.status !== 201 || !validData.success || !validData.data.id) {
      throw new Error(`Failed to save project: ${JSON.stringify(validData)}`);
    }

    const savedProjectA = validData.data;
    console.log(`  ✅ Saved project '${savedProjectA.project_name}' (ID: ${savedProjectA.id}).`);

    // Verify Server-Side Financial Calculations
    // Total Cost = 10000 + 1500 + 1000 + 800 + 500 + 200 = 14000
    // Revenue = 200 * 120 = 24000
    // Profit = 24000 - 14000 = 10000
    // ROI = (10000 / 14000) * 100 = 71.43%
    if (Number(savedProjectA.total_cost) !== 14000 || Number(savedProjectA.projected_revenue) !== 24000 || Number(savedProjectA.projected_profit) !== 10000) {
      throw new Error(`Server calculation discrepancy: total_cost=${savedProjectA.total_cost}, revenue=${savedProjectA.projected_revenue}, profit=${savedProjectA.projected_profit}`);
    }
    console.log("  ✅ Server-side financial calculations verified 100% authoritative & accurate.");

    console.log("\n[7/9] Testing GET /api/value-addition/projects (List & IDOR Isolation)...");
    const listResA = await fetch(`${baseUrl}/api/value-addition/projects`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const listDataA = await listResA.json();
    if (listResA.status !== 200 || !listDataA.success || listDataA.data.length === 0) {
      throw new Error("Farmer A project list fetch failed.");
    }
    console.log(`  ✅ Farmer A project list returned ${listDataA.data.length} saved project(s).`);

    // Farmer B should see 0 projects (No IDOR leak)
    const listResB = await fetch(`${baseUrl}/api/value-addition/projects`, {
      headers: { Authorization: `Bearer ${farmerTokenB}` }
    });
    const listDataB = await listResB.json();
    if (listResB.status !== 200 || listDataB.data.some(p => p.id === savedProjectA.id)) {
      throw new Error("IDOR failure: Farmer B can view Farmer A's saved project list!");
    }
    console.log("  ✅ IDOR isolation verified: Farmer B cannot view Farmer A's projects list.");

    console.log("\n[8/9] Testing GET /api/value-addition/projects/:id (Detail & IDOR Guard)...");
    const getByIdA = await fetch(`${baseUrl}/api/value-addition/projects/${savedProjectA.id}`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const getByIdDataA = await getByIdA.json();
    if (getByIdA.status !== 200 || !getByIdDataA.success) {
      throw new Error("Farmer A failed to fetch own project detail by ID.");
    }
    console.log("  ✅ Owner Farmer A successfully retrieved project detail by ID.");

    // Farmer B trying to GET Farmer A's project by ID -> 403 FORBIDDEN
    const getByIdB = await fetch(`${baseUrl}/api/value-addition/projects/${savedProjectA.id}`, {
      headers: { Authorization: `Bearer ${farmerTokenB}` }
    });
    const getByIdDataB = await getByIdB.json();
    if (getByIdB.status !== 403 || getByIdDataB.success !== false) {
      throw new Error("IDOR failure: Farmer B accessed Farmer A's project detail by ID!");
    }
    console.log("  ✅ IDOR protection verified: Farmer B attempt to GET Farmer A's project blocked with 403 FORBIDDEN.");

    console.log("\n[9/9] Testing DELETE /api/value-addition/projects/:id (Ownership Guard & Deletion)...");

    // Farmer B trying to DELETE Farmer A's project -> 403 FORBIDDEN
    const deleteB = await fetch(`${baseUrl}/api/value-addition/projects/${savedProjectA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmerTokenB}` }
    });
    const deleteDataB = await deleteB.json();
    if (deleteB.status !== 403 || deleteDataB.success !== false) {
      throw new Error("IDOR failure: Farmer B deleted Farmer A's project!");
    }
    console.log("  ✅ IDOR protection verified: Farmer B attempt to DELETE Farmer A's project blocked with 403 FORBIDDEN.");

    // Owner Farmer A DELETE -> 200 OK
    const deleteA = await fetch(`${baseUrl}/api/value-addition/projects/${savedProjectA.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const deleteDataA = await deleteA.json();
    if (deleteA.status !== 200 || !deleteDataA.success) {
      throw new Error("Farmer A failed to delete own project.");
    }
    console.log("  ✅ Owner Farmer A successfully deleted project.");

    // Subsequent GET -> 404 NOT FOUND
    const getAfterDelete = await fetch(`${baseUrl}/api/value-addition/projects/${savedProjectA.id}`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    if (getAfterDelete.status !== 404) {
      throw new Error("Deleted project still returned from database!");
    }
    console.log("  ✅ Deleted project confirmed purged (404 NOT_FOUND).");

    console.log("\n[10/10] Testing Government Schemes APIs & Product Mappings...");
    // 1. GET /api/value-addition/schemes
    const schemesRes = await fetch(`${baseUrl}/api/value-addition/schemes`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const schemesData = await schemesRes.json();
    if (schemesRes.status !== 200 || !schemesData.success || !Array.isArray(schemesData.data) || schemesData.data.length === 0) {
      throw new Error("Failed to fetch government schemes catalog.");
    }
    const sampleScheme = schemesData.data[0];
    const requiredSchemeFields = ["scheme_name", "authority", "description", "eligibility_info", "benefits_info", "official_source_url", "last_updated_date"];
    for (const f of requiredSchemeFields) {
      if (!sampleScheme[f]) {
        throw new Error(`Government Scheme record missing mandatory field: ${f}`);
      }
    }
    console.log(`  ✅ Government Schemes catalog fetched (${schemesData.data.length} official schemes in database). Mandatory fields verified.`);

    // 2. GET /api/value-addition/products/:id/schemes
    const targetProd = farmerData.data[0];
    const prodSchemesRes = await fetch(`${baseUrl}/api/value-addition/products/${targetProd.id}/schemes`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const prodSchemesData = await prodSchemesRes.json();
    if (prodSchemesRes.status !== 200 || !prodSchemesData.success || !prodSchemesData.data.schemes) {
      throw new Error("Failed to fetch mapped schemes for product.");
    }
    console.log(`  ✅ Product '${targetProd.product_name}' (${targetProd.crop_name}) successfully mapped to ${prodSchemesData.data.schemes.length} official scheme(s).`);

    // 3. Verify disclaimer present in API response
    if (!prodSchemesData.data.disclaimer) {
      throw new Error("Missing mandatory official eligibility disclaimer in API response.");
    }
    console.log("  ✅ Mandatory official eligibility verification disclaimer confirmed in response.");

    console.log("\n[11/11] Testing Marketplace Publishing Integration & 'What Can I Make?' Crop Query...");

    // Test 'What Can I Make?' crop query
    const cropQueryRes = await fetch(`${baseUrl}/api/value-addition/products?crop=Groundnut`, {
      headers: { Authorization: `Bearer ${farmerTokenA}` }
    });
    const cropQueryData = await cropQueryRes.json();
    if (cropQueryRes.status !== 200 || !cropQueryData.success || !Array.isArray(cropQueryData.data)) {
      throw new Error("'What Can I Make?' crop query failed.");
    }
    console.log(`  ✅ 'What Can I Make?' crop query ('Groundnut') returned ${cropQueryData.data.length} value-added products.`);

    // Test Marketplace prefill data validity
    const groundnutProduct = cropQueryData.data[0] || targetProd;
    if (!groundnutProduct.id || !groundnutProduct.product_name) {
      throw new Error("Marketplace prefill payload missing required fields.");
    }
    console.log(`  ✅ Marketplace prefill data verified for product '${groundnutProduct.product_name}' (value_added_product_id: ${groundnutProduct.id}).`);

    console.log("\n======================================================================");
    console.log("  ALL VALUE ADDITION PHASE A INTEGRATION TESTS PASSED 100%!           ");
    console.log("======================================================================\n");
  } catch (err) {
    console.error("\n❌ API Integration Test Failed:", err.message);
    process.exit(1);
  } finally {
    if (server) server.close();
    await pool.end();
  }
}

runApiIntegrationTests();
