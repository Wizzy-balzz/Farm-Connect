import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool, initDatabase } from "./database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config();

console.log("======================================================================");
console.log("    VALUE ADDITION KNOWLEDGE DATASET VERIFICATION & INTEGRITY TEST    ");
console.log("======================================================================");

async function runDatasetValidation() {
  try {
    await initDatabase();

    console.log("\n[1/5] Validating exact dataset statistics from MySQL database...");
    const [cropsRes] = await pool.query("SELECT COUNT(DISTINCT crop_name) AS crop_count FROM crop_value_added_products");
    const [vapRes] = await pool.query("SELECT COUNT(*) AS vap_count FROM crop_value_added_products");
    const [methodsRes] = await pool.query("SELECT COUNT(DISTINCT processing_method) AS method_count FROM processing_guides");
    const [guidesRes] = await pool.query("SELECT COUNT(*) AS guide_count FROM processing_guides");
    const [stagesRes] = await pool.query("SELECT COUNT(*) AS stage_count FROM processing_stages");
    const [equipmentRes] = await pool.query("SELECT COUNT(*) AS equipment_count FROM processing_equipment");
    const [packagingRes] = await pool.query("SELECT COUNT(*) AS packaging_count FROM processing_packaging_storage");
    const [marketRes] = await pool.query("SELECT COUNT(*) AS market_count FROM processing_market_info");

    const stats = {
      crops: cropsRes[0].crop_count,
      products: vapRes[0].vap_count,
      methods: methodsRes[0].method_count,
      guides: guidesRes[0].guide_count,
      stages: stagesRes[0].stage_count,
      equipment: equipmentRes[0].equipment_count,
      packaging: packagingRes[0].packaging_count,
      market: marketRes[0].market_count
    };

    console.log(`- Crops Count:               ${stats.crops}`);
    console.log(`- Value-Added Products:     ${stats.products}`);
    console.log(`- Processing Methods:       ${stats.methods}`);
    console.log(`- Processing Guides:        ${stats.guides}`);
    console.log(`- Processing Stages:        ${stats.stages}`);
    console.log(`- Equipment Records:        ${stats.equipment}`);
    console.log(`- Packaging/Storage Recs:   ${stats.packaging}`);
    console.log(`- Market/Use Info Recs:     ${stats.market}`);

    if (stats.crops < 16) {
      throw new Error(`Expected at least 16 crops, found ${stats.crops}`);
    }

    console.log("\n[2/5] Checking foreign-key integrity across all 6 tables...");
    const [orphanedGuides] = await pool.query(
      `SELECT g.id FROM processing_guides g LEFT JOIN crop_value_added_products p ON g.value_added_product_id = p.id WHERE p.id IS NULL`
    );
    const [orphanedStages] = await pool.query(
      `SELECT s.id FROM processing_stages s LEFT JOIN processing_guides g ON s.guide_id = g.id WHERE g.id IS NULL`
    );
    const [orphanedEquip] = await pool.query(
      `SELECT e.id FROM processing_equipment e LEFT JOIN processing_guides g ON e.guide_id = g.id WHERE g.id IS NULL`
    );
    const [orphanedPkg] = await pool.query(
      `SELECT p.id FROM processing_packaging_storage p LEFT JOIN processing_guides g ON p.guide_id = g.id WHERE g.id IS NULL`
    );
    const [orphanedMkt] = await pool.query(
      `SELECT m.id FROM processing_market_info m LEFT JOIN processing_guides g ON m.guide_id = g.id WHERE g.id IS NULL`
    );

    const totalOrphans = orphanedGuides.length + orphanedStages.length + orphanedEquip.length + orphanedPkg.length + orphanedMkt.length;
    if (totalOrphans > 0) {
      throw new Error(`Foreign key integrity violation: Found ${totalOrphans} orphaned records across tables.`);
    }
    console.log("✅ Zero orphaned records. Foreign-key integrity is 100% intact.");

    console.log("\n[3/5] Checking duplicate records & unique constraints...");
    const [dupProducts] = await pool.query(
      `SELECT crop_name, product_name, COUNT(*) as cnt FROM crop_value_added_products GROUP BY crop_name, product_name HAVING cnt > 1`
    );
    const [dupStages] = await pool.query(
      `SELECT guide_id, stage_number, COUNT(*) as cnt FROM processing_stages GROUP BY guide_id, stage_number HAVING cnt > 1`
    );

    if (dupProducts.length > 0 || dupStages.length > 0) {
      throw new Error("Duplicate records detected violating unique constraints.");
    }
    console.log("✅ Zero duplicate crop/product or guide/stage records detected.");

    console.log("\n[4/5] Checking required structured fields & metadata...");
    const [nullFields] = await pool.query(
      `SELECT id FROM processing_guides WHERE title IS NULL OR processing_method IS NULL OR source_reference IS NULL`
    );
    if (nullFields.length > 0) {
      throw new Error(`Found ${nullFields.length} processing guides with missing required structured fields.`);
    }
    console.log("✅ All processing guides contain structured titles, methods, and authoritative source references.");

    console.log("\n[5/5] Checking backward compatibility with existing core tables...");
    const [usersCount] = await pool.query("SELECT COUNT(*) as cnt FROM users");
    const [productsCount] = await pool.query("SELECT COUNT(*) as cnt FROM products");
    const [ordersCount] = await pool.query("SELECT COUNT(*) as cnt FROM orders");
    console.log(`✅ Core tables preserved: users (${usersCount[0].cnt}), products (${productsCount[0].cnt}), orders (${ordersCount[0].cnt}).`);

    console.log("\n======================================================================");
    console.log("     ALL VALUE ADDITION DATASET INTEGRITY CHECKS PASSED 100%!         ");
    console.log("======================================================================\n");
  } catch (err) {
    console.error("\n❌ Dataset Validation Failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runDatasetValidation();
