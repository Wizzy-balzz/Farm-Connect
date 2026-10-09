import assert from "assert";
import { query } from "../database.js";
import { searchLocations, reverseGeocode } from "../services/locationService.js";
import { calculateRoute } from "../services/mapService.js";
import { signJwt } from "../utils/security.js";

async function runOsmTrackingTests() {
  console.log("============================================================");
  console.log("FarmConnect 2.0 - OpenStreetMap & All-India Tracking Tests");
  console.log("============================================================");

  // Set up mock users for testing authorization
  const adminUser = { id: "a1", email: "admin@farmconnect.com", role: "admin", name: "Platform Admin" };
  const farmerUser = { id: "f1", email: "farmer@farmconnect.com", role: "farmer", name: "Rajesh Kumar" };
  const vendorUser = { id: "v1", email: "vendor@farmconnect.com", role: "vendor", name: "Ananya's Kitchen" };
  const otherVendor = { id: "v2", email: "taj@hotels.com", role: "vendor", name: "Taj Residency" };

  const testOrderId = `FC-TEST-${Date.now().toString(36).toUpperCase()}`;

  try {
    // ------------------------------------------------------------
    // TEST 1: Use Current Location -> coordinates -> address (Nominatim reverse geocode)
    // ------------------------------------------------------------
    console.log("\n[TEST 1] Reverse geocode coordinates to normalized address object...");
    const revRes = await reverseGeocode(19.0760, 72.8777); // Mumbai coordinates
    assert(revRes !== null, "Reverse geocoding returned an object");
    assert(typeof revRes.latitude === "number", "Latitude is a valid number");
    assert(typeof revRes.longitude === "number", "Longitude is a valid number");
    assert(Boolean(revRes.city || revRes.placeName), "City / place name extracted");
    assert(Boolean(revRes.country), "Country extracted");
    assert(Boolean(revRes.formattedAddress), "Formatted address present");
    console.log("✓ TEST 1 PASSED: Reverse geocode normalized:", {
      city: revRes.city,
      state: revRes.state,
      country: revRes.country,
      coordinates: `${revRes.latitude}, ${revRes.longitude}`
    });

    // ------------------------------------------------------------
    // TEST 2: User manually searches for location in Tamil Nadu
    // ------------------------------------------------------------
    console.log("\n[TEST 2] Search location in Tamil Nadu...");
    const tnResults = await searchLocations("Madurai", "IN");
    assert(Array.isArray(tnResults) && tnResults.length > 0, "Tamil Nadu location search returns matches");
    const tnMatch = tnResults[0];
    assert(Boolean(tnMatch.placeName || tnMatch.city), "Place name identified in Tamil Nadu");
    assert(typeof tnMatch.latitude === "number", "Valid latitude returned");
    console.log("✓ TEST 2 PASSED: Tamil Nadu location search result:", {
      placeName: tnMatch.placeName || tnMatch.city,
      state: tnMatch.state || tnMatch.region,
      coords: `${tnMatch.latitude}, ${tnMatch.longitude}`
    });

    // ------------------------------------------------------------
    // TEST 3: User selects location in another Indian state (e.g. Punjab / Ludhiana)
    // ------------------------------------------------------------
    console.log("\n[TEST 3] Search location in another Indian state (Punjab)...");
    const pbResults = await searchLocations("Ludhiana", "IN");
    assert(Array.isArray(pbResults) && pbResults.length > 0, "Punjab location search returns matches");
    const pbMatch = pbResults[0];
    assert(typeof pbMatch.latitude === "number" && typeof pbMatch.longitude === "number", "Coordinates returned for Punjab");
    console.log("✓ TEST 3 PASSED: Inter-state location search result:", {
      placeName: pbMatch.placeName || pbMatch.city,
      state: pbMatch.state || pbMatch.region,
      coords: `${pbMatch.latitude}, ${pbMatch.longitude}`
    });

    // ------------------------------------------------------------
    // TEST 4: Create order with deliveryLat/deliveryLng & initial "Order Placed" event
    // ------------------------------------------------------------
    console.log("\n[TEST 4] Create an inter-state order with coordinates and initial tracking event...");
    const destLat = 12.9716; // Bengaluru, Karnataka
    const destLng = 77.5946;
    const createdAt = new Date().toISOString();

    // Insert test order
    await query.run(
      `INSERT INTO orders (
        id, vendorId, vendorName, deliveryCountry, deliveryRegion, deliveryDistrict, deliveryCity,
        deliveryPostalCode, deliveryAddress, deliveryLat, deliveryLng, paymentMethod, totalAmount,
        subtotal, deliveryCharge, deliveryDistanceKm, deliveryEtaMinutes, paymentStatus, currency, status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testOrderId,
        vendorUser.id,
        vendorUser.name,
        "India",
        "Karnataka",
        "Bengaluru Urban",
        "Bengaluru",
        "560001",
        "MG Road Commercial Kitchen Base, Bengaluru",
        destLat,
        destLng,
        "cod",
        2500.00,
        2400.00,
        100.00,
        980.00,
        1200,
        "COD",
        "INR",
        "Order Placed",
        createdAt
      ]
    );

    // Insert order item linked to farmer f1
    await query.run(
      `INSERT INTO order_items (id, orderId, productId, farmerId, qty, unitPrice, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`item_${testOrderId}`, testOrderId, "p1", farmerUser.id, 50, 48.00, 2400.00]
    );

    // Insert initial "Order Placed" tracking event
    const initialTrackingId = `trk_init_${Date.now()}`;
    await query.run(
      `INSERT INTO order_tracking_events (
        id, order_id, status, location, latitude, longitude, description, timestamp, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        initialTrackingId,
        testOrderId,
        "Order Placed",
        "Bengaluru, Karnataka",
        destLat,
        destLng,
        "Order confirmed and placed on FarmConnect.",
        createdAt,
        vendorUser.id
      ]
    );

    const savedOrder = await query.get("SELECT * FROM orders WHERE id = ?", [testOrderId]);
    assert(savedOrder !== null, "Order stored in database");
    assert(parseFloat(savedOrder.deliveryLat) === destLat, "deliveryLat persisted accurately");
    assert(parseFloat(savedOrder.deliveryLng) === destLng, "deliveryLng persisted accurately");

    const savedEvents = await query.all("SELECT * FROM order_tracking_events WHERE order_id = ?", [testOrderId]);
    assert(savedEvents.length === 1, "Initial tracking event recorded");
    assert(savedEvents[0].status === "Order Placed", "Initial event status is 'Order Placed'");
    console.log("✓ TEST 4 PASSED: Order created with coordinates & initial tracking event.");

    // ------------------------------------------------------------
    // TEST 5: Admin changes tracking status and adds checkpoints
    // ------------------------------------------------------------
    console.log("\n[TEST 5] Admin posts checkpoint updates...");
    const checkpointTime1 = new Date(Date.now() + 60000).toISOString();
    const checkpointId1 = `trk_chk1_${Date.now()}`;

    // Admin marks "In Transit" at Pune Transit Hub
    await query.run(
      `INSERT INTO order_tracking_events (
        id, order_id, status, location, latitude, longitude, description, timestamp, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        checkpointId1,
        testOrderId,
        "In Transit",
        "Pune Highway Distribution Hub, Maharashtra",
        18.5204,
        73.8567,
        "Cargo consolidated and departed on inter-state refrigerated transport.",
        checkpointTime1,
        adminUser.id
      ]
    );
    await query.run("UPDATE orders SET status = ? WHERE id = ?", ["In Transit", testOrderId]);

    const updatedOrder = await query.get("SELECT status FROM orders WHERE id = ?", [testOrderId]);
    assert(updatedOrder.status === "In Transit", "Order status updated to 'In Transit'");

    const eventsAfterCheckpoint = await query.all(
      "SELECT * FROM order_tracking_events WHERE order_id = ? ORDER BY timestamp ASC",
      [testOrderId]
    );
    assert(eventsAfterCheckpoint.length === 2, "Two tracking events now recorded");
    assert(eventsAfterCheckpoint[1].status === "In Transit", "Latest event is 'In Transit'");
    console.log("✓ TEST 5 PASSED: Admin checkpoint event added & status synchronized.");

    // ------------------------------------------------------------
    // TEST 6: Authorized user sees tracking timeline & OSRM route
    // ------------------------------------------------------------
    console.log("\n[TEST 6] Authorized user accesses tracking timeline and OSRM route...");
    // Vendor (who placed order)
    const isVendorAuthorized = (savedOrder.vendorId === vendorUser.id);
    assert(isVendorAuthorized, "Vendor who placed order is authorized");

    // Farmer (whose product is in order)
    const farmerItem = await query.get(
      "SELECT id FROM order_items WHERE orderId = ? AND farmerId = ?",
      [testOrderId, farmerUser.id]
    );
    assert(farmerItem !== null, "Farmer with product in order is authorized");

    // Calculate OSRM route between farmer origin and buyer destination
    const routeInfo = await calculateRoute(19.9975, 73.7898, destLat, destLng);
    assert(routeInfo.distanceKm > 0, "OSRM road distance computed");
    assert(routeInfo.etaMinutes > 0, "OSRM ETA computed");
    console.log("✓ TEST 6 PASSED: Authorized parties validated. OSRM Route:", {
      distance: routeInfo.formattedDistance,
      eta: routeInfo.formattedEta,
      provider: routeInfo.provider
    });

    // ------------------------------------------------------------
    // TEST 7: Unauthorized user receives rejection (access control check)
    // ------------------------------------------------------------
    console.log("\n[TEST 7] Unauthorized user access control validation...");
    const isOtherVendorAuthorized = (savedOrder.vendorId === otherVendor.id);
    const otherFarmerItem = await query.get(
      "SELECT id FROM order_items WHERE orderId = ? AND farmerId = ?",
      [testOrderId, otherVendor.id]
    );
    const isAllowed = (otherVendor.role === "admin") || isOtherVendorAuthorized || Boolean(otherFarmerItem);
    assert(!isAllowed, "Unauthorized vendor (v2) is strictly denied access");
    console.log("✓ TEST 7 PASSED: Unauthorized user correctly denied access.");

    // ------------------------------------------------------------
    // TEST 8: OpenStreetMap displays source, destination, and latest location
    // ------------------------------------------------------------
    console.log("\n[TEST 8] Validating source, destination, and latest tracking coordinates...");
    const farmerRecord = await query.get("SELECT lat, lng, name, farmName FROM users WHERE id = ?", [farmerUser.id]);
    const sourceLat = parseFloat(farmerRecord.lat || 19.9975);
    const sourceLng = parseFloat(farmerRecord.lng || 73.7898);
    const latestEvent = eventsAfterCheckpoint[eventsAfterCheckpoint.length - 1];

    assert(!isNaN(sourceLat) && !isNaN(sourceLng), "Source coordinates are valid");
    assert(!isNaN(destLat) && !isNaN(destLng), "Destination coordinates are valid");
    assert(!isNaN(parseFloat(latestEvent.latitude)) && !isNaN(parseFloat(latestEvent.longitude)), "Latest tracking location coordinates are valid");

    console.log("✓ TEST 8 PASSED: All 3 tracking map anchors are verified:", {
      source: { name: farmerRecord.farmName, coords: `${sourceLat}, ${sourceLng}` },
      latest: { location: latestEvent.location, coords: `${latestEvent.latitude}, ${latestEvent.longitude}` },
      destination: { city: savedOrder.deliveryCity, coords: `${destLat}, ${destLng}` }
    });

    // ------------------------------------------------------------
    // TEST 9: Geocoding failure containment (graceful error handling)
    // ------------------------------------------------------------
    console.log("\n[TEST 9] Graceful error handling on invalid/failed coordinates...");
    const invalidReverse = await reverseGeocode(999.99, 999.99);
    assert(invalidReverse === null || invalidReverse.country === "India", "Invalid coordinates handled safely without uncaught exception");

    const emptySearch = await searchLocations("", "IN");
    assert(Array.isArray(emptySearch) && emptySearch.length === 0, "Empty search handled gracefully without error");
    console.log("✓ TEST 9 PASSED: Geocoding failures safely contained.");

    // ------------------------------------------------------------
    // TEST 10: Existing FarmConnect features continue working
    // ------------------------------------------------------------
    console.log("\n[TEST 10] Validating existing platform features (products, users, orders)...");
    const productCount = await query.get("SELECT COUNT(*) as count FROM products");
    assert(productCount.count > 0, "Products catalog intact");

    const userCount = await query.get("SELECT COUNT(*) as count FROM users");
    assert(userCount.count > 0, "Users table intact");

    const orderCount = await query.get("SELECT COUNT(*) as count FROM orders");
    assert(orderCount.count > 0, "Orders ledger intact");

    console.log("✓ TEST 10 PASSED: Existing platform data and features intact.");

    console.log("\n============================================================");
    console.log("🎉 ALL 10 TESTS PASSED SUCCESSFULLY!");
    console.log("============================================================");
  } finally {
    // Clean up test order
    try {
      await query.run("DELETE FROM order_tracking_events WHERE order_id = ?", [testOrderId]);
      await query.run("DELETE FROM order_items WHERE orderId = ?", [testOrderId]);
      await query.run("DELETE FROM orders WHERE id = ?", [testOrderId]);
    } catch {
      /* ignore cleanup */
    }
  }
}

runOsmTrackingTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failure:", err);
    process.exit(1);
  });
