import { Router } from "express";
import { query } from "../database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

function generateId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function sendError(res, statusCode, code, message) {
  return res.status(statusCode).json({
    success: false,
    error: { code, message }
  });
}

// ============================================================
// B1 — CROP LIBRARY APIs
// ============================================================

// GET /api/farming-guide/crops
router.get("/crops", async (req, res) => {
  try {
    const { q, category, season, region } = req.query;

    let sql = "SELECT * FROM crops WHERE 1=1";
    const params = [];

    if (q) {
      sql += " AND (name LIKE ? OR scientific_name LIKE ? OR category LIKE ? OR soil_requirements LIKE ?)";
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    if (category && category !== "All") {
      sql += " AND category = ?";
      params.push(category);
    }

    if (season && season !== "All") {
      sql += " AND (seasons LIKE ? OR seasons LIKE '%Year-round%')";
      params.push(`%${season}%`);
    }

    if (region) {
      sql += " AND (suitable_regions LIKE ? OR suitable_regions IS NULL)";
      params.push(`%${region}%`);
    }

    sql += " ORDER BY name ASC";

    const crops = await query.all(sql, params);

    res.json({
      success: true,
      count: crops.length,
      data: crops
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// GET /api/farming-guide/crops/:id
router.get("/crops/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [id, id]);

    if (!crop) {
      return sendError(res, 404, "NOT_FOUND", "Crop not found in Farming Guide database.");
    }

    // Fetch associated sub-guides if available
    const growthStages = await query.all("SELECT * FROM crop_growth_stages WHERE crop_id = ? ORDER BY stage_order ASC", [crop.id]);
    const seedSowing = await query.get("SELECT * FROM crop_seed_sowing_guides WHERE crop_id = ?", [crop.id]);
    const irrigation = await query.get("SELECT * FROM crop_irrigation_guides WHERE crop_id = ?", [crop.id]);
    const nutrients = await query.get("SELECT * FROM crop_nutrient_guides WHERE crop_id = ?", [crop.id]);
    const pests = await query.all("SELECT * FROM crop_pest_diseases WHERE crop_id = ?", [crop.id]);
    const harvestPost = await query.get("SELECT * FROM crop_harvest_post_harvest WHERE crop_id = ?", [crop.id]);
    const rotation = await query.all("SELECT * FROM crop_rotation_rules WHERE previous_crop_name = ? OR suggested_crop_name = ?", [crop.name, crop.name]);

    // Check for Value Addition integration (Phase A)
    const valueAddedProducts = await query.all(
      "SELECT * FROM crop_value_added_products WHERE crop_name LIKE ?",
      [`%${crop.name}%`]
    );

    // Check for Government Scheme integration (Phase A)
    const governmentSchemes = await query.all(
      `SELECT DISTINCT gs.*, cpsm.relevance_notes
       FROM government_schemes gs
       JOIN crop_product_scheme_mappings cpsm ON gs.id = cpsm.scheme_id
       JOIN crop_value_added_products vap ON cpsm.value_added_product_id = vap.id
       WHERE vap.crop_name LIKE ?`,
      [`%${crop.name}%`]
    );

    res.json({
      success: true,
      data: {
        ...crop,
        growthStages,
        seedSowing: seedSowing || null,
        irrigation: irrigation || null,
        nutrients: nutrients || null,
        pests,
        harvestPost: harvestPost || null,
        rotation,
        valueAddedProducts,
        governmentSchemes
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// GET /api/farming-guide/crops/:id/soil
router.get("/crops/:id/soil", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    res.json({
      success: true,
      data: {
        crop: crop.name,
        soilRequirements: crop.soil_requirements,
        soilTexture: crop.soil_texture,
        phMin: crop.ph_min,
        phMax: crop.ph_max,
        drainage: crop.drainage,
        source: crop.source,
        lastVerified: crop.last_verified
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B2 — SOIL COMPATIBILITY ENGINE
// ============================================================

// POST /api/farming-guide/soil-compatibility
router.post("/soil-compatibility", async (req, res) => {
  try {
    const { soilType, ph, season, waterAvailability, district, previousCrop } = req.body;

    const allCrops = await query.all("SELECT * FROM crops ORDER BY name ASC");
    const results = [];

    const parsedPh = ph !== undefined && ph !== null && ph !== "" ? parseFloat(ph) : null;

    for (const c of allCrops) {
      let score = 70; // Base score
      const reasons = [];
      const conditions = [];
      const missingInfo = [];

      // 1. Soil Texture Matching
      if (soilType) {
        const soilLower = soilType.toLowerCase();
        const cropSoilLower = (c.soil_texture || c.soil_requirements || "").toLowerCase();

        if (cropSoilLower.includes(soilLower)) {
          score += 15;
          reasons.push(`Soil texture '${soilType}' perfectly matches ${c.name} soil requirements.`);
        } else if (cropSoilLower.includes("loam") && (soilLower.includes("sandy") || soilLower.includes("clay"))) {
          score += 5;
          reasons.push(`Soil texture '${soilType}' is moderately suitable with organic soil amendments.`);
        } else {
          score -= 15;
          conditions.push(`Soil texture '${soilType}' may require drainage or clay/sand conditioning.`);
        }
      } else {
        missingInfo.push("Soil type not provided; default regional soil assumptions applied.");
      }

      // 2. pH Matching
      if (parsedPh !== null && !isNaN(parsedPh)) {
        if (c.ph_min && c.ph_max) {
          if (parsedPh >= c.ph_min && parsedPh <= c.ph_max) {
            score += 15;
            reasons.push(`Soil pH ${parsedPh} is within optimal range (${c.ph_min} - ${c.ph_max}).`);
          } else if (Math.abs(parsedPh - c.ph_min) <= 0.5 || Math.abs(parsedPh - c.ph_max) <= 0.5) {
            score -= 5;
            conditions.push(`Soil pH ${parsedPh} is slightly outside ideal range (${c.ph_min} - ${c.ph_max}). Lime or sulfur application recommended.`);
          } else {
            score -= 25;
            conditions.push(`Soil pH ${parsedPh} is suboptimal for ${c.name} (${c.ph_min} - ${c.ph_max}). Severe yield drop possible without pH correction.`);
          }
        }
      } else {
        missingInfo.push("Soil pH not provided. Perform a laboratory soil test for precise pH verification.");
      }

      // 3. Season Matching
      if (season) {
        const cropSeasons = (c.seasons || "").toLowerCase();
        if (cropSeasons.includes(season.toLowerCase()) || cropSeasons.includes("year-round")) {
          score += 10;
          reasons.push(`Fits season '${season}'.`);
        } else {
          score -= 20;
          conditions.push(`Off-season crop for '${season}'. High climate risk.`);
        }
      }

      // 4. Water Availability Matching
      if (waterAvailability) {
        const wLower = waterAvailability.toLowerCase();
        if (wLower.includes("high") || wLower.includes("irrigated")) {
          if (c.category === "Cereals" || c.name === "Rice" || c.name === "Sugarcane" || c.name === "Banana") {
            score += 10;
            reasons.push("Sufficient water available for high water-demanding crop.");
          }
        } else if (wLower.includes("low") || wLower.includes("rainfed")) {
          if (c.category === "Oilseeds" || c.category === "Millets" || c.category === "Pulses" || c.name === "Groundnut" || c.name === "Amla") {
            score += 15;
            reasons.push("Low water requirement crop well-suited for rainfed condition.");
          } else if (c.name === "Rice" || c.name === "Sugarcane") {
            score -= 30;
            conditions.push("High risk: Water availability is low for heavy water-demanding crop.");
          }
        }
      }

      // Normalize Score
      score = Math.max(10, Math.min(98, score));
      let compatibilityLevel = "LOW";
      if (score >= 75) compatibilityLevel = "HIGH";
      else if (score >= 50) compatibilityLevel = "MEDIUM";

      results.push({
        cropId: c.id,
        crop: c.name,
        scientificName: c.scientific_name,
        category: c.category,
        compatibility: compatibilityLevel,
        score,
        reasons,
        importantConditions: conditions,
        missingInformation: missingInfo.length > 0 ? missingInfo : ["None"]
      });
    }

    results.sort((a, b) => b.score - a.score);

    res.json({
      success: true,
      inputs: { soilType, ph: parsedPh, season, waterAvailability, district, previousCrop },
      count: results.length,
      data: results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B3 — CROP CALENDAR & GROWTH STAGES
// ============================================================

router.get("/crops/:id/calendar", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const stages = await query.all("SELECT * FROM crop_growth_stages WHERE crop_id = ? ORDER BY stage_order ASC", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      durationDays: crop.duration_days,
      stages: stages.length > 0 ? stages : [],
      note: stages.length === 0 ? "Sequence structure presented. Specific regional dates depend on sowing date." : undefined
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/crops/:id/growth-stages", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const stages = await query.all("SELECT * FROM crop_growth_stages WHERE crop_id = ? ORDER BY stage_order ASC", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      stages
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B4 — CROP ROTATION & SEED/SOWING
// ============================================================

router.get("/crops/:id/rotation", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    const cropName = crop ? crop.name : req.params.id;

    const rules = await query.all(
      "SELECT * FROM crop_rotation_rules WHERE previous_crop_name LIKE ? OR suggested_crop_name LIKE ?",
      [`%${cropName}%`, `%${cropName}%`]
    );

    res.json({
      success: true,
      crop: cropName,
      rotationRules: rules
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.post("/rotation/recommend", async (req, res) => {
  try {
    const { previousCrop, currentCrop, season, region, soil } = req.body;

    if (!previousCrop) {
      return sendError(res, 400, "MISSING_INPUT", "Previous crop is required for rotation calculation.");
    }

    const rules = await query.all(
      "SELECT * FROM crop_rotation_rules WHERE previous_crop_name LIKE ?",
      [`%${previousCrop}%`]
    );

    const defaultSuggestions = [
      {
        suggestedCrop: "Groundnut / Legumes",
        compatibility: "HIGH",
        reasons: "Fixes atmospheric nitrogen into soil and breaks pest cycles.",
        benefits: "Enriches soil organic nitrogen and improves soil friability.",
        cropsToAvoid: `${previousCrop} (continuous monoculture)`,
        fieldPreparation: "Deep ploughing to aerate soil pan.",
        gapMonths: 1
      },
      {
        suggestedCrop: "Millets / Maize",
        compatibility: "MEDIUM",
        reasons: "Diversifies root zone nutrient extraction depths.",
        benefits: "Provides food grain and valuable crop straw fodder.",
        cropsToAvoid: "Same family crops",
        fieldPreparation: "Disc harrowing and bed formation.",
        gapMonths: 1
      }
    ];

    res.json({
      success: true,
      previousCrop,
      season,
      suggestions: rules.length > 0 ? rules.map(r => ({
        suggestedCrop: r.suggested_crop_name,
        compatibility: r.compatibility_level,
        reasons: r.reasons,
        benefits: r.benefits,
        cropsToAvoid: r.crops_to_avoid,
        fieldPreparation: r.field_preparation,
        gapMonths: r.gap_months
      })) : defaultSuggestions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/crops/:id/seed-sowing", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const seedSowing = await query.get("SELECT * FROM crop_seed_sowing_guides WHERE crop_id = ?", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      landPreparation: crop.land_preparation,
      guide: seedSowing || {
        seedRatePerAcre: "Information not available. Consult the appropriate agricultural authority/expert.",
        seedSelection: crop.seed_selection || "Use certified high-germination seed lot.",
        seedTreatment: crop.seed_treatment || "Bio-fungicide seed treatment recommended.",
        sowingMethod: crop.sowing_method || "Direct line sowing or transplanting.",
        spacing: crop.spacing || "Recommended standard spacing.",
        depthCm: 3.0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B5 — IRRIGATION & NUTRIENTS
// ============================================================

router.get("/crops/:id/irrigation", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const irrigation = await query.get("SELECT * FROM crop_irrigation_guides WHERE crop_id = ?", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      guide: irrigation || {
        waterRequirementMm: "500 - 800 mm",
        method: "Controlled Furrow or Drip Irrigation",
        criticalStages: "Flowering, Fruit/Grain set",
        waterStressSigns: "Leaf rolling, midday wilting",
        overwateringSigns: "Root rot, yellowing of lower leaves",
        rainfallConsiderations: "Review planned irrigation based on expected rainfall from weather forecast. Suspend irrigation during heavy rains.",
        dripSprinklerSuitability: "Drip irrigation highly suitable for water conservation."
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/crops/:id/nutrients", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const nutrients = await query.get("SELECT * FROM crop_nutrient_guides WHERE crop_id = ?", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      soilTestNotice: "MANDATORY NOTICE: Conduct laboratory soil testing before applying chemical fertilizers. Do not exceed recommended dosage.",
      guide: nutrients || {
        nRecommendationKgPerAcre: "40 - 60 kg/acre (split doses)",
        pRecommendationKgPerAcre: "20 - 30 kg/acre (basal)",
        kRecommendationKgPerAcre: "20 - 40 kg/acre (split doses)",
        micronutrients: "Zinc Sulphate @ 10 kg/acre basal if deficient",
        deficiencySymptoms: "Nitrogen: General yellowing of older leaves. Phosphorus: Purple tint on leaf margins.",
        growthStageTiming: "Basal at sowing; Top dressing at 30 and 60 days.",
        soilTestImportance: "Soil testing prevents soil degradation and unnecessary fertilizer cost.",
        management_notes: "Always apply fertilizers under adequate soil moisture conditions."
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B6 — PEST/DISEASE + HARVEST + POST-HARVEST
// ============================================================

router.get("/crops/:id/pests", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const pests = await query.all("SELECT * FROM crop_pest_diseases WHERE crop_id = ?", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      safetyDisclaimer: "DO NOT automatically prescribe pesticide dosage without consulting an authorized agricultural extension officer.",
      visionIntegration: "Integrate with FarmConnect Crop Image Analyzer for visual AI problem identification.",
      pests
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/crops/:id/harvest", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const harvestPost = await query.get("SELECT * FROM crop_harvest_post_harvest WHERE crop_id = ?", [crop.id]);

    res.json({
      success: true,
      crop: crop.name,
      harvest: {
        maturityIndicators: harvestPost?.maturity_indicators || "Color change, grain/fruit hardness, foliage drying.",
        timing: harvestPost?.timing || "Cool morning hours during clear dry weather.",
        harvestMethod: harvestPost?.harvest_method || "Manual or mechanical harvester.",
        handling: harvestPost?.handling || "Gentle handling in clean containers.",
        qualityIndicators: harvestPost?.quality_indicators || "Uniform size, proper moisture content, free from blemishes."
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

router.get("/crops/:id/post-harvest", async (req, res) => {
  try {
    const crop = await query.get("SELECT * FROM crops WHERE id = ? OR name = ?", [req.params.id, req.params.id]);
    if (!crop) return sendError(res, 404, "NOT_FOUND", "Crop not found.");

    const harvestPost = await query.get("SELECT * FROM crop_harvest_post_harvest WHERE crop_id = ?", [crop.id]);

    // Value addition options link
    const valueAdditionProducts = await query.all(
      "SELECT id, product_name, category, value_addition_multiplier FROM crop_value_added_products WHERE crop_name LIKE ?",
      [`%${crop.name}%`]
    );

    res.json({
      success: true,
      crop: crop.name,
      postHarvest: {
        cleaning: harvestPost?.cleaning || "Air cleaning and winnowing.",
        sortingGrading: harvestPost?.sorting_grading || "Grade by size, weight, and quality parameters.",
        drying: harvestPost?.drying || "Sun drying on clean tarpaulin to safe storage moisture level.",
        storage: harvestPost?.storage || "Store in cool, dry, pest-proof godown.",
        packaging: harvestPost?.packaging || "Moisture-proof gunny/HDPE bags or plastic crates.",
        transportation: harvestPost?.transportation || "Covered transport vehicles.",
        qualityPreservation: harvestPost?.quality_preservation || "Maintain proper ventilation and moisture barrier."
      },
      valueAdditionOpportunities: valueAdditionProducts
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B7 — FARM DIARY & FARM ECONOMICS
// ============================================================

// GET /api/farm-diary/records or /api/farming-guide/diary/records
const getDiaryRecords = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const records = await query.all(
      "SELECT * FROM farmer_farm_diary WHERE farmer_id = ? ORDER BY created_at DESC",
      [farmerId]
    );

    res.json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};
router.get("/records", requireAuth, requireRole("farmer"), getDiaryRecords);
router.get("/diary/records", requireAuth, requireRole("farmer"), getDiaryRecords);

// POST /api/farm-diary/records or /api/farming-guide/diary/records
const createDiaryRecord = async (req, res) => {
  try {
    const farmerId = req.user.id; // STRICT AUTHENTICATED IDENTITY
    const { cropName, areaAcres, sowingDate, location, seedInfo, irrigationActivity, nutrientActivity, pestObservation, notes, expenses, harvestQty, sellingPrice } = req.body;

    if (!cropName) {
      return sendError(res, 400, "MISSING_CROP", "Crop name is required for Farm Diary entry.");
    }

    const id = generateId("fd");
    const now = new Date().toISOString();

    await query.run(
      `INSERT INTO farmer_farm_diary (
        id, farmer_id, crop_name, area_acres, sowing_date, location, seed_info,
        irrigation_activity, nutrient_activity, pest_observation, notes,
        expenses, harvest_qty, selling_price, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, farmerId, cropName, parseFloat(areaAcres || 1.0), sowingDate || null, location || null, seedInfo || null,
        irrigationActivity || null, nutrientActivity || null, pestObservation || null, notes || null,
        parseFloat(expenses || 0), parseFloat(harvestQty || 0), parseFloat(sellingPrice || 0), now, now
      ]
    );

    const record = await query.get("SELECT * FROM farmer_farm_diary WHERE id = ?", [id]);

    res.status(201).json({
      success: true,
      message: "Farm diary entry created successfully.",
      data: record
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};
router.post("/records", requireAuth, requireRole("farmer"), createDiaryRecord);
router.post("/diary/records", requireAuth, requireRole("farmer"), createDiaryRecord);

// DELETE /api/farm-diary/records/:id or /api/farming-guide/diary/records/:id
const deleteDiaryRecord = async (req, res) => {
  try {
    const farmerId = req.user.id;
    const { id } = req.params;

    const existing = await query.get("SELECT * FROM farmer_farm_diary WHERE id = ?", [id]);
    if (!existing) {
      return sendError(res, 404, "NOT_FOUND", "Farm diary entry not found.");
    }

    if (existing.farmer_id !== farmerId) {
      return sendError(res, 403, "FORBIDDEN", "Access denied. You can only delete your own diary entries.");
    }

    await query.run("DELETE FROM farmer_farm_diary WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Farm diary entry deleted successfully."
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};
router.delete("/records/:id", requireAuth, requireRole("farmer"), deleteDiaryRecord);
router.delete("/diary/records/:id", requireAuth, requireRole("farmer"), deleteDiaryRecord);

// POST /api/farming-guide/economics/calculate (Server-Side Calculation Engine)
router.post("/economics/calculate", async (req, res) => {
  try {
    const {
      cropName, areaAcres, seedCost, fertilizerCost, labourCost, irrigationCost,
      pestCost, transportCost, otherCost, expectedYieldQty, expectedYieldUnit, expectedSellingPrice
    } = req.body;

    const area = Math.max(0.1, parseFloat(areaAcres || 1.0));
    const sCost = Math.max(0, parseFloat(seedCost || 0));
    const fCost = Math.max(0, parseFloat(fertilizerCost || 0));
    const lCost = Math.max(0, parseFloat(labourCost || 0));
    const iCost = Math.max(0, parseFloat(irrigationCost || 0));
    const pCost = Math.max(0, parseFloat(pestCost || 0));
    const tCost = Math.max(0, parseFloat(transportCost || 0));
    const oCost = Math.max(0, parseFloat(otherCost || 0));

    const totalCost = sCost + fCost + lCost + iCost + pCost + tCost + oCost;

    const yieldQty = Math.max(0, parseFloat(expectedYieldQty || 0));
    const price = Math.max(0, parseFloat(expectedSellingPrice || 0));

    const expectedRevenue = yieldQty * price;
    const estimatedProfit = expectedRevenue - totalCost;
    const profitPerAcre = area > 0 ? estimatedProfit / area : estimatedProfit;

    res.json({
      success: true,
      calculationNotice: "ESTIMATE ONLY. Actual yields and market prices may vary based on weather, pest incidence, and market dynamics.",
      data: {
        cropName: cropName || "Selected Crop",
        areaAcres: area,
        costBreakdown: {
          seedCost: sCost,
          fertilizerCost: fCost,
          labourCost: lCost,
          irrigationCost: iCost,
          pestCost: pCost,
          transportCost: tCost,
          otherCost: oCost
        },
        totalCost,
        yieldDetails: {
          expectedYieldQty: yieldQty,
          unit: expectedYieldUnit || "kg",
          expectedSellingPrice: price
        },
        expectedRevenue,
        estimatedProfit,
        profitPerAcre
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// ============================================================
// B8 — "WHAT SHOULD I FARM?" SIGNATURE FARM PLANNER
// ============================================================

const recommendPlanner = async (req, res) => {
  try {
    const {
      location, district, soilType, ph, landArea, waterAvailability,
      season, budget, previousCrop, marketPreference
    } = req.body;

    const allCrops = await query.all("SELECT * FROM crops ORDER BY name ASC");
    const recommendations = [];

    const parsedPh = ph !== undefined && ph !== null && ph !== "" ? parseFloat(ph) : null;
    const parsedBudget = budget !== undefined && budget !== null && budget !== "" ? parseFloat(budget) : null;
    const area = parseFloat(landArea || 1.0);

    for (const c of allCrops) {
      let score = 70;
      const positiveFactors = [];
      const riskFactors = [];

      // 1. Soil Suitability
      if (soilType) {
        const soilLower = soilType.toLowerCase();
        const cropSoilLower = (c.soil_texture || c.soil_requirements || "").toLowerCase();
        if (cropSoilLower.includes(soilLower)) {
          score += 15;
          positiveFactors.push(`Soil texture '${soilType}' matches ${c.name} ideal requirements.`);
        } else if (cropSoilLower.includes("loam")) {
          score += 5;
          positiveFactors.push(`Soil texture '${soilType}' is suitable with organic soil management.`);
        } else {
          score -= 10;
          riskFactors.push(`Soil texture '${soilType}' requires soil conditioning for ${c.name}.`);
        }
      }

      // 2. Season Suitability
      if (season) {
        const seasonsLower = (c.seasons || "").toLowerCase();
        if (seasonsLower.includes(season.toLowerCase()) || seasonsLower.includes("year-round")) {
          score += 15;
          positiveFactors.push(`Fully suitable for cultivation in '${season}' season.`);
        } else {
          score -= 20;
          riskFactors.push(`Off-season crop for '${season}' in ${district || 'this region'}.`);
        }
      }

      // 3. Water Suitability
      if (waterAvailability) {
        const wLower = waterAvailability.toLowerCase();
        if (wLower.includes("high") || wLower.includes("irrigated")) {
          if (["Rice", "Sugarcane", "Banana", "Tomato"].includes(c.name)) {
            score += 10;
            positiveFactors.push("High water availability supports heavy crop water requirement.");
          }
        } else if (wLower.includes("low") || wLower.includes("rainfed")) {
          if (["Groundnut", "Millets", "Pulses", "Amla"].includes(c.name)) {
            score += 15;
            positiveFactors.push("Drought-tolerant crop perfectly aligns with low water availability.");
          } else if (["Rice", "Sugarcane"].includes(c.name)) {
            score -= 30;
            riskFactors.push("High water-demand crop risky under rainfed/low-water conditions.");
          }
        }
      }

      // 4. Rotation Bonus
      if (previousCrop) {
        if (previousCrop.toLowerCase() === c.name.toLowerCase()) {
          score -= 20;
          riskFactors.push(`Continuous monoculture after '${previousCrop}' increases soil-borne disease buildup.`);
        } else if (previousCrop.toLowerCase().includes("rice") && c.name === "Groundnut") {
          score += 15;
          positiveFactors.push("Excellent rotation legume after rice; fixes soil nitrogen.");
        }
      }

      // Normalize score
      score = Math.max(15, Math.min(98, score));

      // Fetch linked Phase A Government Schemes & Value Addition
      const valueAddedProducts = await query.all(
        "SELECT id, product_name, category, value_addition_multiplier FROM crop_value_added_products WHERE crop_name LIKE ?",
        [`%${c.name}%`]
      );

      const governmentSchemes = await query.all(
        `SELECT DISTINCT gs.id, gs.scheme_name, gs.authority, gs.benefits_info, gs.official_source_url
         FROM government_schemes gs
         JOIN crop_product_scheme_mappings cpsm ON gs.id = cpsm.scheme_id
         JOIN crop_value_added_products vap ON cpsm.value_added_product_id = vap.id
         WHERE vap.crop_name LIKE ?`,
        [`%${c.name}%`]
      );

      // Check for Market Intelligence price in products table if existing
      const marketPriceRow = await query.get(
        "SELECT AVG(price) as avgPrice, unit FROM products WHERE category LIKE ? OR name LIKE ? GROUP BY unit",
        [`%${c.name}%`, `%${c.name}%`]
      );

      recommendations.push({
        cropId: c.id,
        crop: c.name,
        scientificName: c.scientific_name,
        category: c.category,
        compatibilityScore: score,
        whyRecommended: positiveFactors.length > 0 ? positiveFactors.join(" ") : `Standard suitable crop for ${district || 'region'}.`,
        soilSuitability: c.soil_requirements || "Standard loamy soil",
        seasonSuitability: c.seasons || "Kharif, Rabi",
        waterSuitability: c.category === "Pulses" || c.name === "Groundnut" ? "Low to Moderate" : "Moderate to High",
        durationDays: c.duration_days,
        landPreparation: c.land_preparation,
        riskFactors: riskFactors.length > 0 ? riskFactors : ["Standard agricultural weather risk."],
        weatherConsiderations: "Check 7-day Open-Meteo rainfall forecast prior to sowing.",
        marketInformation: marketPriceRow && marketPriceRow.avgPrice ? {
          averagePrice: Math.round(marketPriceRow.avgPrice),
          unit: marketPriceRow.unit || "kg",
          source: "FarmConnect Active Marketplace Listings"
        } : {
          status: "Information not available. Consult the local APMC mandi/agricultural authority."
        },
        relevantGovernmentSchemes: governmentSchemes,
        relevantValueAddition: valueAddedProducts
      });
    }

    // Sort by compatibility score
    recommendations.sort((a, b) => b.compatibilityScore - a.score);

    res.json({
      success: true,
      inputs: { location, district, soilType, ph: parsedPh, landArea: area, waterAvailability, season, budget: parsedBudget, previousCrop, marketPreference },
      count: recommendations.length,
      data: recommendations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
};

router.post("/recommend", recommendPlanner);
router.post("/planner/recommend", recommendPlanner);

export default router;
