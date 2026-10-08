import express from "express";
import { query } from "../database.js";
import { requireAuth } from "../middleware/auth.js";
import { validateGeoJsonPolygon, calculateGeodesicArea, calculateCentroid } from "../utils/gisUtils.js";

const router = express.Router();

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

function generateId(prefix = "parcel") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

// ----------------------------------------------------
// 1. GET /api/farm/parcels — Retrieve user's farm parcels
// ----------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    let targetUserId = req.user.id;

    // Allow platform admin to inspect another user's parcel if requested
    if (req.user.role === "admin" && req.query.userId) {
      targetUserId = String(req.query.userId);
    }

    const rows = await query.all(
      `SELECT * FROM farm_parcels WHERE user_id = ? ORDER BY created_at DESC`,
      [targetUserId]
    );

    const parcels = (rows || []).map((row) => {
      let geojson = null;
      try {
        geojson = typeof row.geometry_geojson === "string" ? JSON.parse(row.geometry_geojson) : row.geometry_geojson;
      } catch {
        geojson = null;
      }
      return {
        ...row,
        geometry_geojson: geojson
      };
    });

    res.json({
      success: true,
      parcels
    });
  } catch (err) {
    console.error("Fetch farm parcels error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to retrieve farm parcels.");
  }
});

// ----------------------------------------------------
// 2. POST /api/farm/parcels — Create a user-drawn farm parcel
// ----------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, geometry_geojson, document_reference } = req.body;

    if (!geometry_geojson) {
      return sendError(res, 400, "INVALID_PAYLOAD", "geometry_geojson is required.");
    }

    // Strict GeoJSON validation
    const validation = validateGeoJsonPolygon(geometry_geojson);
    if (!validation.valid) {
      return sendError(res, 400, "INVALID_GEOMETRY", validation.error);
    }

    const polygonObj = validation.parsed;
    const ring = polygonObj.coordinates[0];

    // Compute accurate geodesic area and centroid
    const { areaSqm, areaAcres, areaHectares } = calculateGeodesicArea(ring);
    const { lat: centroidLat, lng: centroidLng } = calculateCentroid(ring);

    const parcelId = generateId("parcel");
    const parcelName = typeof name === "string" && name.trim().length > 0
      ? name.trim().substring(0, 255)
      : "My Farm Parcel";
    const now = new Date().toISOString();

    await query.run(
      `INSERT INTO farm_parcels (
        id, user_id, name, geometry_geojson,
        area_acres, area_hectares, centroid_lat, centroid_lng,
        source, cadastral_status, document_reference, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USER_DRAWN', 'NON_CADASTRAL', ?, ?, ?)`,
      [
        parcelId,
        req.user.id,
        parcelName,
        JSON.stringify(polygonObj),
        areaAcres,
        areaHectares,
        centroidLat,
        centroidLng,
        document_reference ? String(document_reference).substring(0, 255) : null,
        now,
        now
      ]
    );

    res.status(201).json({
      success: true,
      parcel: {
        id: parcelId,
        user_id: req.user.id,
        name: parcelName,
        geometry_geojson: polygonObj,
        area_acres: areaAcres,
        area_hectares: areaHectares,
        area_sqm: areaSqm,
        centroid_lat: centroidLat,
        centroid_lng: centroidLng,
        source: "USER_DRAWN",
        cadastral_status: "NON_CADASTRAL",
        document_reference: document_reference || null,
        created_at: now,
        updated_at: now
      }
    });
  } catch (err) {
    console.error("Create farm parcel error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to save farm parcel.");
  }
});

// ----------------------------------------------------
// 3. PUT /api/farm/parcels/:id — Update existing farm parcel
// ----------------------------------------------------
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, geometry_geojson, document_reference } = req.body;

    const existing = await query.get(
      `SELECT * FROM farm_parcels WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Farm parcel not found.");
    }

    // Ownership Enforcement (IDOR Protection)
    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to modify this farm parcel.");
    }

    let updatedGeojsonStr = existing.geometry_geojson;
    let areaAcres = existing.area_acres;
    let areaHectares = existing.area_hectares;
    let centroidLat = existing.centroid_lat;
    let centroidLng = existing.centroid_lng;

    if (geometry_geojson) {
      const validation = validateGeoJsonPolygon(geometry_geojson);
      if (!validation.valid) {
        return sendError(res, 400, "INVALID_GEOMETRY", validation.error);
      }
      const polygonObj = validation.parsed;
      const ring = polygonObj.coordinates[0];
      const areaResult = calculateGeodesicArea(ring);
      const centroidResult = calculateCentroid(ring);

      updatedGeojsonStr = JSON.stringify(polygonObj);
      areaAcres = areaResult.areaAcres;
      areaHectares = areaResult.areaHectares;
      centroidLat = centroidResult.lat;
      centroidLng = centroidResult.lng;
    }

    const updatedName = typeof name === "string" && name.trim().length > 0
      ? name.trim().substring(0, 255)
      : existing.name;

    const updatedDocRef = document_reference !== undefined
      ? (document_reference ? String(document_reference).substring(0, 255) : null)
      : existing.document_reference;

    const now = new Date().toISOString();

    await query.run(
      `UPDATE farm_parcels SET
        name = ?,
        geometry_geojson = ?,
        area_acres = ?,
        area_hectares = ?,
        centroid_lat = ?,
        centroid_lng = ?,
        document_reference = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        updatedName,
        updatedGeojsonStr,
        areaAcres,
        areaHectares,
        centroidLat,
        centroidLng,
        updatedDocRef,
        now,
        id
      ]
    );

    let parsedGeojson = null;
    try {
      parsedGeojson = JSON.parse(updatedGeojsonStr);
    } catch {
      parsedGeojson = null;
    }

    res.json({
      success: true,
      parcel: {
        id,
        user_id: existing.user_id,
        name: updatedName,
        geometry_geojson: parsedGeojson,
        area_acres: areaAcres,
        area_hectares: areaHectares,
        centroid_lat: centroidLat,
        centroid_lng: centroidLng,
        source: existing.source,
        cadastral_status: existing.cadastral_status,
        document_reference: updatedDocRef,
        created_at: existing.created_at,
        updated_at: now
      }
    });
  } catch (err) {
    console.error("Update farm parcel error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to update farm parcel.");
  }
});

// ----------------------------------------------------
// 4. DELETE /api/farm/parcels/:id — Delete farm parcel
// ----------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query.get(
      `SELECT * FROM farm_parcels WHERE id = ?`,
      [id]
    );

    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Farm parcel not found.");
    }

    // Ownership Enforcement (IDOR Protection)
    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "You do not have permission to delete this farm parcel.");
    }

    await query.run(`DELETE FROM farm_parcels WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: "Farm parcel deleted successfully."
    });
  } catch (err) {
    console.error("Delete farm parcel error:", err);
    sendError(res, 500, "SERVER_ERROR", "Failed to delete farm parcel.");
  }
});

export default router;
