import express from "express";
import { query } from "../database.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/value-addition/filters
 * Returns distinct filter options (crops, categories, processing methods)
 */
router.get("/filters", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const cropRows = await query.all(
      `SELECT DISTINCT crop_name FROM crop_value_added_products ORDER BY crop_name ASC`
    );
    const categoryRows = await query.all(
      `SELECT DISTINCT category FROM crop_value_added_products WHERE category IS NOT NULL AND category != '' ORDER BY category ASC`
    );
    const methodRows = await query.all(
      `SELECT DISTINCT processing_method FROM processing_guides WHERE processing_method IS NOT NULL AND processing_method != '' ORDER BY processing_method ASC`
    );
    const eqMethodRows = await query.all(
      `SELECT DISTINCT processing_method FROM processing_equipment WHERE processing_method IS NOT NULL AND processing_method != '' ORDER BY processing_method ASC`
    );

    // Merge and deduplicate processing methods
    const allMethods = Array.from(new Set([
      ...methodRows.map((r) => r.processing_method),
      ...eqMethodRows.map((r) => r.processing_method)
    ])).sort();

    res.json({
      success: true,
      data: {
        crops: cropRows.map((r) => r.crop_name),
        categories: categoryRows.map((r) => r.category),
        methods: allMethods
      }
    });
  } catch (err) {
    console.error("Error fetching value addition filters:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load value addition filters." }
    });
  }
});

/**
 * GET /api/value-addition/equipment
 * Query parameters: search, crop, method, category
 */
router.get("/equipment", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { search, crop, method, category } = req.query;

    let sql = `
      SELECT 
        e.*,
        g.title AS guide_title,
        p.product_name,
        p.crop_name,
        p.category AS product_category
      FROM processing_equipment e
      LEFT JOIN processing_guides g ON e.guide_id = g.id
      LEFT JOIN crop_value_added_products p ON g.value_added_product_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      sql += ` AND (e.equipment_name LIKE ? OR e.purpose LIKE ? OR e.applicable_crops LIKE ? OR e.applicable_products LIKE ? OR e.processing_method LIKE ? OR e.operational_description LIKE ?)`;
      params.push(term, term, term, term, term, term);
    }

    if (crop && crop !== "All" && crop.trim() !== "") {
      const cropTerm = `%${crop.trim()}%`;
      sql += ` AND (e.applicable_crops LIKE ? OR p.crop_name = ?)`;
      params.push(cropTerm, crop.trim());
    }

    if (method && method !== "All" && method.trim() !== "") {
      sql += ` AND (e.processing_method = ? OR g.processing_method = ?)`;
      params.push(method.trim(), method.trim());
    }

    if (category && category !== "All" && category.trim() !== "") {
      const catTerm = `%${category.trim()}%`;
      sql += ` AND (e.applicable_products LIKE ? OR p.category = ?)`;
      params.push(catTerm, category.trim());
    }

    sql += ` ORDER BY e.equipment_name ASC`;

    const equipmentList = await query.all(sql, params);

    res.json({
      success: true,
      data: equipmentList
    });
  } catch (err) {
    console.error("Error querying processing equipment:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load processing equipment." }
    });
  }
});

/**
 * GET /api/value-addition/equipment/:id
 * Detailed view of a single equipment item
 */
router.get("/equipment/:id", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const eq = await query.get(
      `SELECT 
        e.*,
        g.title AS guide_title,
        g.processing_method AS guide_processing_method,
        p.id AS product_id,
        p.product_name,
        p.crop_name,
        p.category AS product_category
       FROM processing_equipment e
       LEFT JOIN processing_guides g ON e.guide_id = g.id
       LEFT JOIN crop_value_added_products p ON g.value_added_product_id = p.id
       WHERE e.id = ?`,
      [id]
    );

    if (!eq) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Equipment record not found." }
      });
    }

    const firstCrop = eq.applicable_crops ? eq.applicable_crops.split(',')[0].trim() : '';

    const relatedEquipment = await query.all(
      `SELECT e.id, e.equipment_name, e.processing_method, e.applicable_crops, e.purpose
       FROM processing_equipment e
       WHERE (e.processing_method = ? OR (e.applicable_crops LIKE ? AND ? != '')) AND e.id != ?
       LIMIT 4`,
      [eq.processing_method || '', `%${firstCrop}%`, firstCrop, eq.id]
    );

    res.json({
      success: true,
      data: {
        ...eq,
        relatedEquipment
      }
    });
  } catch (err) {
    console.error("Error fetching processing equipment details:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load equipment detail." }
    });
  }
});

/**
 * GET /api/value-addition/products
 * Query parameters: search, crop, category, method
 */
router.get("/products", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { search, crop, category, method } = req.query;

    let sql = `
      SELECT 
        p.id, 
        p.crop_name, 
        p.product_name, 
        p.category, 
        p.description, 
        p.value_addition_multiplier,
        p.created_at,
        p.updated_at,
        g.id AS guide_id, 
        g.title AS guide_title, 
        g.processing_method, 
        g.difficulty_level,
        g.expected_yield_percentage, 
        g.processing_time_hours, 
        g.summary, 
        g.source_reference
      FROM crop_value_added_products p
      LEFT JOIN processing_guides g ON g.value_added_product_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      sql += ` AND (p.product_name LIKE ? OR p.crop_name LIKE ? OR p.description LIKE ? OR g.processing_method LIKE ? OR p.category LIKE ?)`;
      params.push(term, term, term, term, term);
    }

    if (crop && crop !== "All" && crop.trim() !== "") {
      sql += ` AND p.crop_name = ?`;
      params.push(crop.trim());
    }

    if (category && category !== "All" && category.trim() !== "") {
      sql += ` AND p.category = ?`;
      params.push(category.trim());
    }

    if (method && method !== "All" && method.trim() !== "") {
      sql += ` AND g.processing_method = ?`;
      params.push(method.trim());
    }

    sql += ` ORDER BY p.crop_name ASC, p.product_name ASC`;

    const products = await query.all(sql, params);

    res.json({
      success: true,
      data: products
    });
  } catch (err) {
    console.error("Error querying value addition products:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load value-added products." }
    });
  }
});

/**
 * GET /api/value-addition/products/:id
 * Detailed view of a single product with full guide, stages, equipment, packaging & market info
 */
router.get("/products/:id", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const product = await query.get(
      `SELECT * FROM crop_value_added_products WHERE id = ?`,
      [id]
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Value-added product not found." }
      });
    }

    const guide = await query.get(
      `SELECT * FROM processing_guides WHERE value_added_product_id = ?`,
      [product.id]
    );

    let stages = [];
    let equipment = [];
    let packaging = null;
    let marketInfo = null;

    if (guide) {
      stages = await query.all(
        `SELECT * FROM processing_stages WHERE guide_id = ? ORDER BY stage_number ASC`,
        [guide.id]
      );
      equipment = await query.all(
        `SELECT * FROM processing_equipment WHERE guide_id = ?`,
        [guide.id]
      );
      packaging = await query.get(
        `SELECT * FROM processing_packaging_storage WHERE guide_id = ?`,
        [guide.id]
      );
      marketInfo = await query.get(
        `SELECT * FROM processing_market_info WHERE guide_id = ?`,
        [guide.id]
      );
    }

    // Fetch related value-added products derived from the same source crop
    const relatedProducts = await query.all(
      `SELECT p.id, p.crop_name, p.product_name, p.category, p.description, p.value_addition_multiplier, g.processing_method
       FROM crop_value_added_products p
       LEFT JOIN processing_guides g ON g.value_added_product_id = p.id
       WHERE p.crop_name = ? AND p.id != ?
       LIMIT 4`,
      [product.crop_name, product.id]
    );

    // Fetch mapped government schemes
    const schemes = await query.all(
      `SELECT 
        s.id AS scheme_id,
        s.scheme_name,
        s.short_code,
        s.authority,
        s.description,
        s.eligibility_info,
        s.benefits_info,
        s.official_source_url,
        s.last_updated_date,
        m.relevance_notes
       FROM crop_product_scheme_mappings m
       JOIN government_schemes s ON m.scheme_id = s.id
       WHERE m.value_added_product_id = ?
       ORDER BY s.scheme_name ASC`,
      [product.id]
    );

    res.json({
      success: true,
      data: {
        ...product,
        relatedProducts,
        schemes,
        guide: guide ? {
          ...guide,
          stages,
          equipment,
          packaging,
          marketInfo
        } : null
      }
    });
  } catch (err) {
    console.error("Error fetching value addition product details:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load product detail." }
    });
  }
});

/**
 * GET /api/value-addition/schemes
 * List all supported government schemes or filter by search/crop
 */
router.get("/schemes", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { search, crop } = req.query;

    let sql = `
      SELECT DISTINCT
        s.id,
        s.scheme_name,
        s.short_code,
        s.authority,
        s.description,
        s.eligibility_info,
        s.benefits_info,
        s.official_source_url,
        s.last_updated_date,
        s.created_at
      FROM government_schemes s
      LEFT JOIN crop_product_scheme_mappings m ON m.scheme_id = s.id
      LEFT JOIN crop_value_added_products p ON m.value_added_product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      sql += ` AND (s.scheme_name LIKE ? OR s.short_code LIKE ? OR s.authority LIKE ? OR s.description LIKE ? OR s.eligibility_info LIKE ? OR s.benefits_info LIKE ?)`;
      params.push(term, term, term, term, term, term);
    }

    if (crop && crop !== "All" && crop.trim() !== "") {
      sql += ` AND p.crop_name = ?`;
      params.push(crop.trim());
    }

    sql += ` ORDER BY s.scheme_name ASC`;

    const schemes = await query.all(sql, params);

    res.json({
      success: true,
      data: schemes,
      disclaimer: "Government schemes and eligibility criteria are subject to official verification by the respective authority. FarmConnect does not grant auto-eligibility."
    });
  } catch (err) {
    console.error("Error querying government schemes:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load government schemes." }
    });
  }
});

/**
 * GET /api/value-addition/products/:id/schemes
 * Specific government schemes mapped to a value-added product
 */
router.get("/products/:id/schemes", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const { id } = req.params;

    const product = await query.get("SELECT id, crop_name, product_name FROM crop_value_added_products WHERE id = ?", [id]);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Value-added product not found." }
      });
    }

    const schemes = await query.all(
      `SELECT 
        s.id AS scheme_id,
        s.scheme_name,
        s.short_code,
        s.authority,
        s.description,
        s.eligibility_info,
        s.benefits_info,
        s.official_source_url,
        s.last_updated_date,
        m.relevance_notes
       FROM crop_product_scheme_mappings m
       JOIN government_schemes s ON m.scheme_id = s.id
       WHERE m.value_added_product_id = ?
       ORDER BY s.scheme_name ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        product,
        schemes,
        disclaimer: "Government schemes and eligibility criteria are subject to official verification by the respective authority upon formal application. FarmConnect does not grant auto-eligibility."
      }
    });
  } catch (err) {
    console.error("Error fetching schemes for product:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load product government schemes." }
    });
  }
});

/**
 * POST /api/value-addition/calculate
 * Calculate financial comparison between raw crop sale and value-added processed sale
 */
router.post("/calculate", requireAuth, requireRole("farmer", "admin"), async (req, res) => {
  try {
    const {
      crop_name,
      raw_quantity = 0,
      raw_material_cost = 0,
      raw_unit_price = 0,
      processing_cost = 0,
      labour_cost = 0,
      packaging_cost = 0,
      transport_cost = 0,
      other_costs = 0,
      expected_processed_qty = 0,
      expected_selling_price = 0
    } = req.body;

    // Sanitize and validate numeric inputs
    const rawQty = Math.max(0, Number(raw_quantity) || 0);
    const rawUnitPrice = Math.max(0, Number(raw_unit_price) || 0);
    const rawCostInput = Math.max(0, Number(raw_material_cost) || 0);

    // Compute base raw material cost
    const rawMaterialCost = rawCostInput > 0 ? rawCostInput : (rawQty * rawUnitPrice);
    const rawRevenue = rawMaterialCost; // Selling raw yields rawMaterialCost

    const procCost = Math.max(0, Number(processing_cost) || 0);
    const labCost = Math.max(0, Number(labour_cost) || 0);
    const pkgCost = Math.max(0, Number(packaging_cost) || 0);
    const transCost = Math.max(0, Number(transport_cost) || 0);
    const othCost = Math.max(0, Number(other_costs) || 0);

    // Total Cost = Raw Material Cost + Processing + Labour + Packaging + Transport + Other
    const totalCost = rawMaterialCost + procCost + labCost + pkgCost + transCost + othCost;

    const processedQty = Math.max(0, Number(expected_processed_qty) || 0);
    const processedUnitPrice = Math.max(0, Number(expected_selling_price) || 0);

    // Estimated Revenue = Processed Qty * Processed Selling Price
    const estimatedRevenue = processedQty * processedUnitPrice;

    // Estimated Profit = Estimated Revenue - Total Cost
    const estimatedProfit = estimatedRevenue - totalCost;

    // Profit Margin = (Profit / Revenue) * 100 (handling division by zero)
    const profitMargin = estimatedRevenue > 0 ? (estimatedProfit / estimatedRevenue) * 100 : 0;

    // Net Value Addition Gain over selling raw
    const netValueAdditionGain = estimatedProfit - rawRevenue;

    res.json({
      success: true,
      data: {
        crop_name: crop_name || "General Crop",
        raw_option: {
          raw_quantity: rawQty,
          raw_unit_price: rawUnitPrice,
          estimated_revenue: Number(rawRevenue.toFixed(2))
        },
        value_added_option: {
          raw_material_cost: Number(rawMaterialCost.toFixed(2)),
          processing_cost: Number(procCost.toFixed(2)),
          labour_cost: Number(labCost.toFixed(2)),
          packaging_cost: Number(pkgCost.toFixed(2)),
          transport_cost: Number(transCost.toFixed(2)),
          other_costs: Number(othCost.toFixed(2)),
          total_cost: Number(totalCost.toFixed(2)),
          expected_processed_qty: processedQty,
          expected_selling_price: processedUnitPrice,
          estimated_revenue: Number(estimatedRevenue.toFixed(2)),
          estimated_profit: Number(estimatedProfit.toFixed(2)),
          profit_margin_pct: Number(profitMargin.toFixed(2)),
          net_gain_over_raw: Number(netValueAdditionGain.toFixed(2))
        },
        disclaimer: "All calculations are estimates for decision support. Actual revenues and profits depend on market volatility, batch yield variations, and local operational costs."
      }
    });
  } catch (err) {
    console.error("Error calculating value addition economics:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to perform calculation." }
    });
  }
});

/**
 * POST /api/value-addition/projects
 * Save a farmer's explicit value-addition calculation project
 */
router.post("/projects", requireAuth, requireRole("farmer"), async (req, res) => {
  try {
    const farmerId = req.user.id; // Authenticated farmer identity ONLY (Prevents IDOR)

    const {
      project_name,
      crop_name,
      value_added_product_id,
      raw_quantity = 0,
      raw_unit = "kg",
      raw_unit_price = 0,
      raw_material_cost = 0,
      processing_cost = 0,
      labour_cost = 0,
      packaging_cost = 0,
      transport_cost = 0,
      other_costs = 0,
      expected_processed_qty = 0,
      processed_unit = "kg",
      expected_selling_price = 0,
      notes = null,
      status = "SAVED"
    } = req.body;

    // Validate presence of required text fields
    const cropNameClean = (crop_name || "").trim();
    if (!cropNameClean) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_INPUT", message: "Crop name is required." }
      });
    }

    const projectNameClean = (project_name || "").trim() || `Value Addition Project - ${cropNameClean}`;

    // Numeric Inputs Extraction & Validation
    const numInputs = [
      raw_quantity, raw_unit_price, raw_material_cost,
      processing_cost, labour_cost, packaging_cost,
      transport_cost, other_costs, expected_processed_qty,
      expected_selling_price
    ];

    for (const val of numInputs) {
      const n = Number(val);
      if (isNaN(n) || n < 0) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_INPUT", message: "Quantities, costs, and prices must be non-negative numbers." }
        });
      }
    }

    // Validate value_added_product_id if provided
    let validVapId = null;
    if (value_added_product_id && String(value_added_product_id).trim() !== "") {
      const existingProduct = await query.get(
        `SELECT id FROM crop_value_added_products WHERE id = ?`,
        [value_added_product_id]
      );
      if (!existingProduct) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_PRODUCT", message: "Specified value-added product ID is invalid." }
        });
      }
      validVapId = existingProduct.id;
    }

    // Server-Side Financial Calculations (Authoritative)
    const rawQty = Math.max(0, Number(raw_quantity) || 0);
    const rawUnitPrice = Math.max(0, Number(raw_unit_price) || 0);
    const rawCostInput = Math.max(0, Number(raw_material_cost) || 0);
    const rawMaterialCost = Number((rawCostInput > 0 ? rawCostInput : (rawQty * rawUnitPrice)).toFixed(2));

    const procCost = Number((Math.max(0, Number(processing_cost) || 0)).toFixed(2));
    const labCost = Number((Math.max(0, Number(labour_cost) || 0)).toFixed(2));
    const pkgCost = Number((Math.max(0, Number(packaging_cost) || 0)).toFixed(2));
    const transCost = Number((Math.max(0, Number(transport_cost) || 0)).toFixed(2));
    const othCost = Number((Math.max(0, Number(other_costs) || 0)).toFixed(2));

    const totalCost = Number((rawMaterialCost + procCost + labCost + pkgCost + transCost + othCost).toFixed(2));

    const processedQty = Math.max(0, Number(expected_processed_qty) || 0);
    const processedUnitPrice = Math.max(0, Number(expected_selling_price) || 0);

    const projectedRevenue = Number((processedQty * processedUnitPrice).toFixed(2));
    const projectedProfit = Number((projectedRevenue - totalCost).toFixed(2));
    const roiPercentage = totalCost > 0
      ? Number(((projectedProfit / totalCost) * 100).toFixed(2))
      : (projectedProfit > 0 ? 100.00 : 0.00);

    const projectId = `fpp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    await query.run(
      `INSERT INTO farmer_processing_projects (
        id, farmer_id, value_added_product_id, project_name, crop_name,
        raw_quantity, raw_unit, raw_unit_price, raw_material_cost,
        processing_cost, labour_cost, packaging_cost, transport_cost, other_costs,
        total_cost, expected_processed_qty, processed_unit, expected_selling_price,
        projected_revenue, projected_profit, roi_percentage, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId, farmerId, validVapId, projectNameClean, cropNameClean,
        rawQty, raw_unit || "kg", rawUnitPrice, rawMaterialCost,
        procCost, labCost, pkgCost, transCost, othCost,
        totalCost, processedQty, processed_unit || "kg", processedUnitPrice,
        projectedRevenue, projectedProfit, roiPercentage, status || "SAVED", notes,
        nowIso, nowIso
      ]
    );

    const savedProject = await query.get(
      `SELECT p.*, vap.product_name AS catalog_product_name, vap.value_addition_multiplier
       FROM farmer_processing_projects p
       LEFT JOIN crop_value_added_products vap ON p.value_added_product_id = vap.id
       WHERE p.id = ?`,
      [projectId]
    );

    res.status(201).json({
      success: true,
      data: savedProject
    });
  } catch (err) {
    console.error("Error saving farmer processing project:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to save processing project." }
    });
  }
});

/**
 * GET /api/value-addition/projects
 * List all saved processing projects for the authenticated farmer
 */
router.get("/projects", requireAuth, requireRole("farmer"), async (req, res) => {
  try {
    const farmerId = req.user.id; // Strictly query authenticated user (Prevents IDOR)

    const projects = await query.all(
      `SELECT p.*, vap.product_name AS catalog_product_name, vap.value_addition_multiplier
       FROM farmer_processing_projects p
       LEFT JOIN crop_value_added_products vap ON p.value_added_product_id = vap.id
       WHERE p.farmer_id = ?
       ORDER BY p.created_at DESC`,
      [farmerId]
    );

    res.json({
      success: true,
      data: projects
    });
  } catch (err) {
    console.error("Error listing farmer processing projects:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load processing projects." }
    });
  }
});

/**
 * GET /api/value-addition/projects/:id
 * Retrieve single saved processing project for authenticated farmer
 */
router.get("/projects/:id", requireAuth, requireRole("farmer"), async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user.id;

    const project = await query.get(
      `SELECT p.*, vap.product_name AS catalog_product_name, vap.value_addition_multiplier
       FROM farmer_processing_projects p
       LEFT JOIN crop_value_added_products vap ON p.value_added_product_id = vap.id
       WHERE p.id = ?`,
      [id]
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Saved processing project not found." }
      });
    }

    // Ownership Enforcement (IDOR Protection)
    if (project.farmer_id !== farmerId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to view this project." }
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (err) {
    console.error("Error fetching single processing project:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to load project details." }
    });
  }
});

/**
 * DELETE /api/value-addition/projects/:id
 * Delete a saved processing project owned by authenticated farmer
 */
router.delete("/projects/:id", requireAuth, requireRole("farmer"), async (req, res) => {
  try {
    const { id } = req.params;
    const farmerId = req.user.id;

    const project = await query.get(
      `SELECT * FROM farmer_processing_projects WHERE id = ?`,
      [id]
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Saved processing project not found." }
      });
    }

    // Ownership Enforcement (IDOR Protection)
    if (project.farmer_id !== farmerId) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to delete this project." }
      });
    }

    await query.run(`DELETE FROM farmer_processing_projects WHERE id = ?`, [id]);

    res.json({
      success: true,
      data: { id, message: "Processing project deleted successfully." }
    });
  } catch (err) {
    console.error("Error deleting processing project:", err);
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to delete project." }
    });
  }
});

export default router;

