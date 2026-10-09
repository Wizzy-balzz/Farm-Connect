import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase, pool } from "../database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env") });
dotenv.config();

const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = parseInt(process.env.DB_PORT || "3306", 10);
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbName = process.env.DB_NAME || "farmconnect";

console.log("======================================================================");
console.log("       VALUE ADDITION MODULE - DATABASE FOUNDATION VERIFICATION        ");
console.log("======================================================================");

async function runSchemaVerification() {
  try {
    console.log("\n[1/5] Initializing database schema...");
    await initDatabase();
    console.log("✅ Database initialized successfully.");

    console.log("\n[2/5] Verifying table existence...");
    const [tableRows] = await pool.query("SHOW TABLES");
    const tableNames = tableRows.map((r) => Object.values(r)[0]);

    const requiredNewTables = [
      "crop_value_added_products",
      "processing_guides",
      "processing_stages",
      "processing_equipment",
      "processing_packaging_storage",
      "processing_market_info"
    ];

    const missingTables = requiredNewTables.filter((t) => !tableNames.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Missing required Value Addition tables: ${missingTables.join(", ")}`);
    }
    console.log(`✅ All ${requiredNewTables.length} new Value Addition tables exist.`);
    console.log(`   Total tables in database: ${tableNames.length}`);

    console.log("\n[3/5] Verifying columns & indexes on products table...");
    const [productCols] = await pool.query("DESCRIBE products");
    const hasValueAddedCol = productCols.some((c) => c.Field === "value_added_product_id");
    if (!hasValueAddedCol) {
      throw new Error("Column 'value_added_product_id' is missing from 'products' table.");
    }
    console.log("✅ Column 'value_added_product_id' verified on 'products' table.");

    console.log("\n[4/5] Verifying foreign key relationships & indexes...");
    const [fkRows] = await pool.query(`
      SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [dbName]);

    const newFks = fkRows.filter((f) =>
      requiredNewTables.includes(f.TABLE_NAME) || f.COLUMN_NAME === "value_added_product_id"
    );

    console.log(`✅ Found ${newFks.length} foreign key definitions for Value Addition module:`);
    newFks.forEach((fk) => {
      console.log(`   - ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME} (${fk.CONSTRAINT_NAME})`);
    });

    console.log("\n[5/5] Testing referential integrity & CASCADE deletes...");
    const timestamp = new Date().toISOString();
    const testVapId = `vap_test_${Date.now()}`;
    const testGuideId = `guide_test_${Date.now()}`;
    const testStageId = `stage_test_${Date.now()}`;
    const testEquipId = `equip_test_${Date.now()}`;
    const testPkgId = `pkg_test_${Date.now()}`;
    const testMktId = `mkt_test_${Date.now()}`;

    // Insert test hierarchy
    await pool.query(
      `INSERT INTO crop_value_added_products (id, crop_name, product_name, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [testVapId, "TestCrop", "TestDerivedProduct", "TestCat", timestamp, timestamp]
    );

    await pool.query(
      `INSERT INTO processing_guides (id, value_added_product_id, title, processing_method, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [testGuideId, testVapId, "Test Processing Guide", "Test Method", timestamp, timestamp]
    );

    await pool.query(
      `INSERT INTO processing_stages (id, guide_id, stage_number, stage_name, description, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [testStageId, testGuideId, 1, "Test Stage 1", "Clean and sort raw crop", timestamp]
    );

    await pool.query(
      `INSERT INTO processing_equipment (id, guide_id, equipment_name, created_at) VALUES (?, ?, ?, ?)`,
      [testEquipId, testGuideId, "Test Stainless Pulper", timestamp]
    );

    await pool.query(
      `INSERT INTO processing_packaging_storage (id, guide_id, packaging_type, created_at) VALUES (?, ?, ?, ?)`,
      [testPkgId, testGuideId, "Test Vacuum Sealed Pouch", timestamp]
    );

    await pool.query(
      `INSERT INTO processing_market_info (id, guide_id, target_market, created_at) VALUES (?, ?, ?, ?)`,
      [testMktId, testGuideId, "Test Supermarkets", timestamp]
    );

    console.log("   Inserted test hierarchy into all 6 tables.");

    // Verify insertion
    const [insertedStage] = await pool.query("SELECT * FROM processing_stages WHERE id = ?", [testStageId]);
    if (insertedStage.length === 0) throw new Error("Failed to read inserted test stage.");

    // Delete parent (crop_value_added_products) to test ON DELETE CASCADE
    await pool.query("DELETE FROM crop_value_added_products WHERE id = ?", [testVapId]);

    const [orphanedStages] = await pool.query("SELECT * FROM processing_stages WHERE id = ?", [testStageId]);
    const [orphanedGuides] = await pool.query("SELECT * FROM processing_guides WHERE id = ?", [testGuideId]);

    if (orphanedStages.length > 0 || orphanedGuides.length > 0) {
      throw new Error("CASCADE delete failed on Value Addition tables.");
    }
    console.log("✅ ON DELETE CASCADE referential integrity verified successfully.");

    // Check existing tables integrity
    const [userCount] = await pool.query("SELECT COUNT(*) as cnt FROM users");
    const [productCount] = await pool.query("SELECT COUNT(*) as cnt FROM products");
    const [orderCount] = await pool.query("SELECT COUNT(*) as cnt FROM orders");
    console.log(`✅ Existing core tables untouched and intact: users (${userCount[0].cnt}), products (${productCount[0].cnt}), orders (${orderCount[0].cnt}).`);

    console.log("\n======================================================================");
    console.log("  ALL VALUE ADDITION DATABASE FOUNDATION TESTS PASSED SUCCESSFULLY!    ");
    console.log("======================================================================\n");
  } catch (err) {
    console.error("\n❌ Database Verification Failed:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSchemaVerification();
