import sqlite3 from "sqlite3";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initDatabase, pool } from "./database.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sqlitePath = join(__dirname, "database.sqlite");

console.log("=== FARMCONNECT — MIGRATING SQLITE TO MYSQL ===");
console.log(`SQLite Source: ${sqlitePath}`);

function readSqliteTable(db, table) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${table}`, [], (err, rows) => {
      if (err) {
        if (err.message.includes("no such table")) {
          resolve([]);
        } else {
          reject(err);
        }
      } else {
        resolve(rows || []);
      }
    });
  });
}

async function runMigration() {
  // Wait for MySQL schema initialization
  await initDatabase();

  const sqliteDb = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error("Could not open source SQLite database:", err.message);
      process.exit(1);
    }
  });

  const tables = [
    "users",
    "products",
    "orders",
    "order_items",
    "notifications",
    "reviews",
    "saved_searches",
    "ai_conversations",
    "ai_messages",
    "ai_insights",
    "real_time_events",
    "conversations",
    "messages",
    "blocked_users",
    "message_reports",
    "otp_verifications",
    "payments",
    "delivery_pricing_rules"
  ];

  const migrationSummary = {};

  for (const table of tables) {
    const rows = await readSqliteTable(sqliteDb, table);
    let insertedCount = 0;

    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      // Escape column names like `read` which is a MySQL reserved keyword
      const escapedColumns = columns.map(c => `\`${c}\``).join(", ");
      const placeholders = columns.map(() => "?").join(", ");
      const sql = `INSERT IGNORE INTO \`${table}\` (${escapedColumns}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        try {
          const [result] = await pool.query(sql, values);
          if (result.affectedRows > 0) {
            insertedCount++;
          }
        } catch (err) {
          console.error(`Error migrating row in table ${table}:`, err.message);
        }
      }
    }

    migrationSummary[table] = {
      sourceCount: rows.length,
      migratedCount: insertedCount
    };
    console.log(`Table "${table}": ${insertedCount}/${rows.length} rows inserted into MySQL.`);
  }

  console.log("\n============================================================");
  console.log("MIGRATION COMPLETE SUMMARY:");
  console.log("============================================================");
  console.table(migrationSummary);

  sqliteDb.close();
  await pool.end();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
