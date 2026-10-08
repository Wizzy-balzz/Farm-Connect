import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { query } from "./database.js";
import { signJwt } from "./utils/security.js";
import { validateGeoJsonPolygon, calculateGeodesicArea, calculateCentroid } from "./utils/gisUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runGisTests() {
  console.log("================================================================================");
  console.log("             FARMCONNECT GIS PHASE 1 — TARGETED VERIFICATION SUITE              ");
  console.log("================================================================================\n");

  // 1. Test Geodesic Area Calculation & GeoJSON Validation
  console.log("--- Testing GIS Utility Functions ---");
  const validRing = [
    [73.7800, 20.0000],
    [73.7900, 20.0000],
    [73.7900, 20.0100],
    [73.7800, 20.0100],
    [73.7800, 20.0000]
  ];
  const validGeoJson = {
    type: "Polygon",
    coordinates: [validRing]
  };

  const validation = validateGeoJsonPolygon(validGeoJson);
  assert(validation.valid === true, "Valid GeoJSON Polygon accepted");

  const areaResult = calculateGeodesicArea(validRing);
  assert(areaResult.areaAcres > 250 && areaResult.areaAcres < 320, `Accurate geodesic area calculated (${areaResult.areaAcres} acres)`);
  assert(areaResult.areaHectares > 100 && areaResult.areaHectares < 130, `Accurate hectare equivalent calculated (${areaResult.areaHectares} ha)`);

  const centroid = calculateCentroid(validRing);
  assert(Math.abs(centroid.lat - 20.005) < 0.001, "Centroid latitude correctly computed");
  assert(Math.abs(centroid.lng - 73.785) < 0.001, "Centroid longitude correctly computed");

  // Invalid cases
  const unclosedRing = [
    [73.7800, 20.0000],
    [73.7900, 20.0000],
    [73.7900, 20.0100],
    [73.7800, 20.0100]
  ];
  assert(validateGeoJsonPolygon({ type: "Polygon", coordinates: [unclosedRing] }).valid === false, "Unclosed polygon ring rejected");
  assert(validateGeoJsonPolygon({ type: "LineString", coordinates: validRing }).valid === false, "Non-Polygon geometry type rejected");
  assert(validateGeoJsonPolygon({ type: "Polygon", coordinates: [[[73.78, 20.0], [73.79, 20.0], [73.78, 20.0]]] }).valid === false, "Polygon with fewer than 4 coordinates rejected");
  assert(validateGeoJsonPolygon({ type: "Polygon", coordinates: [[[200.0, 20.0], [73.79, 20.0], [73.79, 20.01], [200.0, 20.0]]] }).valid === false, "Out-of-bounds coordinates rejected");

  // 2. Testing API Endpoints & Ownership Security
  console.log("\n--- Testing API Endpoints & Ownership Security ---");
  const baseUrl = "http://localhost:5000/api/farm/parcels";
  const farmer1Token = signJwt({ id: "f1", email: "farmer1@farmconnect.com", role: "farmer" });
  const farmer2Token = signJwt({ id: "f2", email: "farmer2@farmconnect.com", role: "farmer" });

  let testParcelId = null;

  try {
    // A. Create Parcel as Farmer 1
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1Token}`
      },
      body: JSON.stringify({
        name: "North Vineyard Parcel",
        geometry_geojson: validGeoJson
      })
    });

    const createData = await createRes.json();
    assert(createRes.status === 201, "Farmer 1 creates parcel successfully (HTTP 201)");
    assert(createData.success === true, "Create response indicates success");
    assert(createData.parcel && createData.parcel.user_id === "f1", "Parcel strictly bound to authenticated user_id");
    assert(createData.parcel.source === "USER_DRAWN", "Parcel source marked as USER_DRAWN");
    assert(createData.parcel.cadastral_status === "NON_CADASTRAL", "Cadastral status marked as NON_CADASTRAL");

    testParcelId = createData.parcel.id;

    // B. Retrieve Parcel as Farmer 1
    const getRes1 = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${farmer1Token}` }
    });
    const getData1 = await getRes1.json();
    assert(getRes1.status === 200, "Farmer 1 retrieves own parcels (HTTP 200)");
    assert(getData1.parcels.some(p => p.id === testParcelId), "Created parcel appears in Farmer 1 parcel list");

    // C. IDOR Protection: Farmer 2 should NOT see Farmer 1's parcel
    const getRes2 = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${farmer2Token}` }
    });
    const getData2 = await getRes2.json();
    assert(getRes2.status === 200, "Farmer 2 retrieves own parcels (HTTP 200)");
    assert(!getData2.parcels.some(p => p.id === testParcelId), "IDOR Check: Farmer 2 cannot see Farmer 1's parcel");

    // D. IDOR Protection: Farmer 2 cannot update Farmer 1's parcel
    const putResUnauthorized = await fetch(`${baseUrl}/${testParcelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer2Token}`
      },
      body: JSON.stringify({ name: "Malicious Tampering" })
    });
    assert(putResUnauthorized.status === 403, "IDOR Check: Farmer 2 forbidden from updating Farmer 1's parcel (HTTP 403)");

    // E. IDOR Protection: Farmer 2 cannot delete Farmer 1's parcel
    const delResUnauthorized = await fetch(`${baseUrl}/${testParcelId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmer2Token}` }
    });
    assert(delResUnauthorized.status === 403, "IDOR Check: Farmer 2 forbidden from deleting Farmer 1's parcel (HTTP 403)");

    // F. Farmer 1 updates own parcel
    const putResAuthorized = await fetch(`${baseUrl}/${testParcelId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmer1Token}`
      },
      body: JSON.stringify({ name: "Updated Vineyard Boundary" })
    });
    const putData = await putResAuthorized.json();
    assert(putResAuthorized.status === 200, "Farmer 1 successfully updates own parcel (HTTP 200)");
    assert(putData.parcel.name === "Updated Vineyard Boundary", "Updated parcel name reflected correctly");

    // G. Farmer 1 deletes own parcel
    const delResAuthorized = await fetch(`${baseUrl}/${testParcelId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${farmer1Token}` }
    });
    assert(delResAuthorized.status === 200, "Farmer 1 successfully deletes own parcel (HTTP 200)");

    // Verify parcel is completely deleted
    const verifyDel = await query.get("SELECT id FROM farm_parcels WHERE id = ?", [testParcelId]);
    assert(verifyDel === null, "Test parcel purged completely from database (clean state preserved)");
    testParcelId = null;

  } finally {
    // Cleanup if anything was left over
    if (testParcelId) {
      await query.run("DELETE FROM farm_parcels WHERE id = ?", [testParcelId]);
    }
  }

  console.log("\n================================================================================");
  console.log(`GIS TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runGisTests().catch(err => {
  console.error("Fatal GIS test error:", err);
  process.exit(1);
});
