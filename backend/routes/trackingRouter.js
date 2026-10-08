import express from "express";
import { query } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
import { calculateRoute } from "../services/mapService.js";
import { broadcastEventToUser } from "../services/realtimeService.js";

const router = express.Router({ mergeParams: true });

function generateId(prefix = "trk") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

export const VALID_TRACKING_STAGES = [
  "Order Placed",
  "Order Confirmed",
  "Packed",
  "Dispatched",
  "In Transit",
  "Reached Destination Hub",
  "Out for Delivery",
  "Delivered",
  "Cancelled"
];

/**
 * GET /api/orders/:id/tracking
 * Retrieve verified order tracking history, OSRM route, source/destination, and latest known location
 */
router.get("/:id/tracking", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const order = await query.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: "ORDER_NOT_FOUND", message: "Order not found." }
      });
    }

    // Role-based authorization: Admin, Ordering Vendor, or Farmer supplying items in order
    let isAuthorized = req.user.role === "admin" || order.vendorId === req.user.id;
    if (!isAuthorized && req.user.role === "farmer") {
      const farmerItem = await query.get(
        "SELECT id FROM order_items WHERE orderId = ? AND farmerId = ? LIMIT 1",
        [id, req.user.id]
      );
      if (farmerItem) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You are not authorized to view tracking for this order." }
      });
    }

    // Fetch order items with farmer and product location details
    const items = await query.all(
      `SELECT oi.id, oi.productId, oi.farmerId, oi.qty, oi.unitPrice, oi.amount,
              p.name as productName, p.unit, p.lat as productLat, p.lng as productLng,
              u.name as farmerName, u.farmName, u.lat as farmerLat, u.lng as farmerLng,
              u.address as farmerAddress, u.city as farmerCity, u.district as farmerDistrict, u.region as farmerRegion
       FROM order_items oi
       LEFT JOIN products p ON oi.productId = p.id
       LEFT JOIN users u ON oi.farmerId = u.id
       WHERE oi.orderId = ?`,
      [id]
    );

    const firstItem = items[0] || {};

    // Source Location (Farmer field or product listing origin)
    const sourceLat = firstItem.productLat || firstItem.farmerLat || 19.9975;
    const sourceLng = firstItem.productLng || firstItem.farmerLng || 73.7898;
    const sourceName = firstItem.farmName || firstItem.farmerName || "Grower Farm Hub";
    const sourceAddress = [
      firstItem.farmerAddress,
      firstItem.farmerCity,
      firstItem.farmerDistrict,
      firstItem.farmerRegion,
      "India"
    ].filter(Boolean).join(", ");

    // Destination Location (Vendor delivery address)
    const destLat = order.deliveryLat || 19.0760;
    const destLng = order.deliveryLng || 72.8777;
    const destName = order.deliveryCity || order.deliveryDistrict || order.deliveryRegion || "Delivery Destination";
    const destAddress = order.deliveryAddress || `${destName}, India`;

    // Fetch historical tracking events from database
    let events = await query.all(
      `SELECT id, order_id as orderId, status, location, latitude, longitude, description, timestamp, updated_by as updatedBy
       FROM order_tracking_events
       WHERE order_id = ?
       ORDER BY timestamp ASC`,
      [id]
    );

    // If order has no tracking events yet (e.g. legacy order), synthesize and seed initial "Order Placed"
    if (!events || events.length === 0) {
      const initEventId = generateId("trk");
      const initLocation = order.deliveryCity || order.deliveryRegion || sourceName;
      const initDesc = `Order placed by ${order.vendorName || "buyer"}.`;
      const initTime = order.createdAt || new Date().toISOString();

      await query.run(
        `INSERT INTO order_tracking_events (id, order_id, status, location, latitude, longitude, description, timestamp, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [initEventId, id, "Order Placed", initLocation, destLat, destLng, initDesc, initTime, order.vendorId || "system"]
      );

      events = [{
        id: initEventId,
        orderId: id,
        status: "Order Placed",
        location: initLocation,
        latitude: destLat,
        longitude: destLng,
        description: initDesc,
        timestamp: initTime,
        updatedBy: order.vendorId || "system"
      }];
    }

    const latestEvent = events[events.length - 1];

    // Authoritative OSRM driving distance, ETA, and routing
    const routeInfo = await calculateRoute(sourceLat, sourceLng, destLat, destLng);

    // Estimated delivery date calculation: 3-5 days from order creation for interstate, 1-2 days for local
    const orderCreatedDate = new Date(order.createdAt || Date.now());
    const transitDays = routeInfo.distanceKm > 300 ? 4 : (routeInfo.distanceKm > 50 ? 2 : 1);
    const estDeliveryDate = new Date(orderCreatedDate.getTime() + transitDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    res.json({
      success: true,
      order: {
        id: order.id,
        vendorId: order.vendorId,
        vendorName: order.vendorName,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        currency: order.currency || "INR",
        createdAt: order.createdAt
      },
      source: {
        name: sourceName,
        farmerName: firstItem.farmerName,
        address: sourceAddress,
        city: firstItem.farmerCity,
        district: firstItem.farmerDistrict,
        region: firstItem.farmerRegion,
        latitude: parseFloat(sourceLat),
        longitude: parseFloat(sourceLng)
      },
      destination: {
        name: destName,
        vendorName: order.vendorName,
        address: destAddress,
        city: order.deliveryCity,
        district: order.deliveryDistrict,
        region: order.deliveryRegion,
        postalCode: order.deliveryPostalCode,
        latitude: parseFloat(destLat),
        longitude: parseFloat(destLng)
      },
      latestLocation: {
        status: latestEvent.status,
        location: latestEvent.location,
        latitude: latestEvent.latitude !== null ? parseFloat(latestEvent.latitude) : destLat,
        longitude: latestEvent.longitude !== null ? parseFloat(latestEvent.longitude) : destLng,
        description: latestEvent.description,
        timestamp: latestEvent.timestamp,
        updatedBy: latestEvent.updatedBy
      },
      route: {
        distanceKm: routeInfo.distanceKm,
        etaMinutes: routeInfo.etaMinutes,
        formattedDistance: routeInfo.formattedDistance,
        formattedEta: routeInfo.formattedEta,
        provider: routeInfo.provider,
        estimatedDeliveryDate: estDeliveryDate
      },
      events: events.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        status: e.status,
        location: e.location,
        latitude: e.latitude !== null ? parseFloat(e.latitude) : null,
        longitude: e.longitude !== null ? parseFloat(e.longitude) : null,
        description: e.description,
        timestamp: e.timestamp,
        updatedBy: e.updatedBy
      })),
      items: items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        unit: i.unit,
        qty: i.qty,
        unitPrice: i.unitPrice,
        amount: i.amount
      }))
    });
  } catch (err) {
    console.error("Order tracking fetch error:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load order tracking details." }
    });
  }
});

/**
 * POST /api/orders/:id/tracking
 * Admin (or Farmer for their orders) appends an authoritative tracking event
 */
router.post("/:id/tracking", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, location, latitude, longitude, description } = req.body || {};

  if (!status || !location) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_INPUT", message: "Status and location are required." }
    });
  }

  // Lat/Lng validation if provided
  let validLat = null;
  let validLng = null;
  if (latitude !== undefined && latitude !== null && latitude !== "") {
    validLat = parseFloat(latitude);
    if (isNaN(validLat) || validLat < -90 || validLat > 90) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_COORDINATES", message: "Latitude must be a valid number between -90 and 90." }
      });
    }
  }
  if (longitude !== undefined && longitude !== null && longitude !== "") {
    validLng = parseFloat(longitude);
    if (isNaN(validLng) || validLng < -180 || validLng > 180) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_COORDINATES", message: "Longitude must be a valid number between -180 and 180." }
      });
    }
  }

  try {
    const order = await query.get("SELECT * FROM orders WHERE id = ?", [id]);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: { code: "ORDER_NOT_FOUND", message: "Order not found." }
      });
    }

    // Authorization: Admin or Farmer of an item in the order
    let isAuthorized = req.user.role === "admin";
    if (!isAuthorized && req.user.role === "farmer") {
      const farmerItem = await query.get(
        "SELECT id FROM order_items WHERE orderId = ? AND farmerId = ? LIMIT 1",
        [id, req.user.id]
      );
      if (farmerItem) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Only administrators and involved farmers can update tracking events." }
      });
    }

    const eventId = generateId("trk");
    const timestamp = new Date().toISOString();
    const eventDesc = description || `Shipment checkpoint reached: ${location} (${status})`;

    // Insert tracking event
    await query.run(
      `INSERT INTO order_tracking_events (id, order_id, status, location, latitude, longitude, description, timestamp, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, id, status, location.trim(), validLat, validLng, eventDesc, timestamp, req.user.id]
    );

    // Update main order status
    await query.run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);

    // If marked Delivered, update farmer completed orders
    if (status === "Delivered") {
      const orderItems = await query.all("SELECT DISTINCT farmerId FROM order_items WHERE orderId = ?", [id]);
      for (const item of orderItems) {
        if (item.farmerId) {
          await query.run("UPDATE users SET completedOrders = completedOrders + 1 WHERE id = ?", [item.farmerId]);
        }
      }
    }

    // Notify vendor
    if (order.vendorId) {
      const notifId = generateId("n");
      const notifText = `Order ${id} tracking updated: ${status} at ${location}`;
      await query.run(
        `INSERT INTO notifications (id, userId, text, type, \`read\`, createdAt)
         VALUES (?, ?, ?, 'order', 0, ?)`,
        [notifId, order.vendorId, notifText, timestamp]
      );
      broadcastEventToUser(order.vendorId, "order_tracking_update", {
        orderId: id,
        status,
        location,
        timestamp
      });
    }

    // Broadcast to farmers
    const orderItems = await query.all("SELECT DISTINCT farmerId FROM order_items WHERE orderId = ?", [id]);
    for (const item of orderItems) {
      if (item.farmerId) {
        broadcastEventToUser(item.farmerId, "order_tracking_update", {
          orderId: id,
          status,
          location,
          timestamp
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Tracking event recorded successfully.",
      event: {
        id: eventId,
        orderId: id,
        status,
        location,
        latitude: validLat,
        longitude: validLng,
        description: eventDesc,
        timestamp,
        updatedBy: req.user.id
      }
    });
  } catch (err) {
    console.error("Add tracking event error:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to record tracking event." }
    });
  }
});

export default router;
