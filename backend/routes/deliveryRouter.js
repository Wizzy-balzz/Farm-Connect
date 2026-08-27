import express from "express";
import { calculateDeliveryCharge } from "../services/deliveryPricingService.js";
import { query } from "../database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// POST /api/delivery/calculate (Calculate road distance & delivery fee)
router.post("/calculate", async (req, res) => {
  const { originLat, originLng, destLat, destLng, orderValue } = req.body || {};

  try {
    const result = await calculateDeliveryCharge({
      originLat: parseFloat(originLat || "19.9975"), // Default Nashik farm region
      originLng: parseFloat(originLng || "73.7898"),
      destLat: parseFloat(destLat || "19.076"),    // Default Mumbai vendor delivery
      destLng: parseFloat(destLng || "72.8777"),
      orderValue: parseFloat(orderValue || "0")
    });

    res.json({ success: true, delivery: result });
  } catch (err) {
    console.error("Delivery charge calculation error:", err.message);
    sendError(res, 500, "DELIVERY_CALCULATION_FAILED", "Failed to calculate delivery fee.");
  }
});

// GET /api/delivery/pricing-rules (Admin fetch pricing rules)
router.get("/pricing-rules", async (req, res) => {
  try {
    const rules = await query.all("SELECT * FROM delivery_pricing_rules ORDER BY minDistanceKm ASC");
    res.json({ success: true, rules });
  } catch (err) {
    console.error("Fetch delivery pricing rules error:", err.message);
    sendError(res, 500, "SERVER_ERROR", "Failed to fetch delivery pricing rules.");
  }
});

// POST /api/delivery/pricing-rules (Admin update pricing rule)
router.post("/pricing-rules", requireAuth, requireRole("admin"), async (req, res) => {
  const { id, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge, active } = req.body || {};

  if (minDistanceKm === undefined || maxDistanceKm === undefined || baseCharge === undefined) {
    return sendError(res, 400, "INVALID_INPUT", "minDistanceKm, maxDistanceKm, and baseCharge are required.");
  }

  const now = new Date().toISOString();
  try {
    if (id) {
      await query.run(
        `UPDATE delivery_pricing_rules 
         SET minDistanceKm = ?, maxDistanceKm = ?, baseCharge = ?, perKmCharge = ?, active = ?, updatedAt = ?
         WHERE id = ?`,
        [minDistanceKm, maxDistanceKm, baseCharge, perKmCharge || 0, active ?? 1, now, id]
      );
    } else {
      const newId = `rule_${Date.now()}`;
      await query.run(
        `INSERT INTO delivery_pricing_rules (id, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge, active, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge || 0, active ?? 1, now, now]
      );
    }

    const rules = await query.all("SELECT * FROM delivery_pricing_rules ORDER BY minDistanceKm ASC");
    res.json({ success: true, message: "Delivery pricing rule saved successfully.", rules });
  } catch (err) {
    console.error("Save pricing rule error:", err.message);
    sendError(res, 500, "SERVER_ERROR", "Failed to save delivery pricing rule.");
  }
});

export default router;
