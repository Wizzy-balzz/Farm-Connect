/**
 * FarmConnect — Clear All Application Data
 * Run from: d:\MWTEL\myi-react-app\backend\
 * Command:  node clear_farmconnect_data.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();   // loads .env from CWD (backend/)

const config = {
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'farmconnect',
  multipleStatements: true
};

// Deletion order: children before parents (FK-safe)
const TABLES_IN_DELETE_ORDER = [
  'ai_followups',
  'ai_farming_goals',
  'ai_user_memory',
  'ai_action_audit',
  'ai_pending_actions',
  'ai_image_analyses',
  'ai_proactive_insights',
  'ai_messages',
  'ai_conversations',
  'ai_insights',
  'message_reports',
  'messages',
  'conversations',
  'blocked_users',
  'notifications',
  'real_time_events',
  'reviews',
  'order_items',
  'payments',
  'orders',
  'otp_verifications',
  'saved_searches',
  'products',
  'delivery_pricing_rules',
  'users',
];

// Default seed rows for delivery_pricing_rules (restored after clear)
const SEED_DELIVERY_RULES = `
INSERT INTO delivery_pricing_rules
  (id, minDistanceKm, maxDistanceKm, baseCharge, perKmCharge, active, createdAt, updatedAt)
VALUES
  ('rule_1', 0,  5,      30.00, 0.00, 1, NOW(), NOW()),
  ('rule_2', 5,  15,     50.00, 2.00, 1, NOW(), NOW()),
  ('rule_3', 15, 50,     80.00, 3.00, 1, NOW(), NOW()),
  ('rule_4', 50, 999999,150.00, 4.00, 1, NOW(), NOW());
`;

async function clearDatabase() {
  const conn = await mysql.createConnection(config);
  console.log(`\nConnected to MySQL: ${config.host}:${config.port} → database '${config.database}'\n`);

  try {
    // Disable FK checks so we can delete in any order
    await conn.query('SET FOREIGN_KEY_CHECKS = 0;');

    const results = [];

    for (const table of TABLES_IN_DELETE_ORDER) {
      try {
        await conn.query(`DELETE FROM \`${table}\``);
        // Reset AUTO_INCREMENT if applicable (no-op if PK is VARCHAR)
        try { await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = 1`); } catch (_) {}
        const [[{ cnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
        results.push({ table, rows: cnt, ok: true });
      } catch (err) {
        results.push({ table, rows: '?', ok: false, err: err.message });
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1;');

    // Re-seed delivery pricing defaults
    await conn.query(SEED_DELIVERY_RULES);
    const [[{ cnt: deliveryCnt }]] = await conn.query(`SELECT COUNT(*) AS cnt FROM delivery_pricing_rules`);

    console.log('='.repeat(62));
    console.log(' TABLE                              | ROWS AFTER CLEAR');
    console.log('='.repeat(62));
    for (const r of results) {
      if (!r.ok) {
        console.log(` ${r.table.padEnd(34)} | ⚠️  ERROR: ${r.err}`);
      } else {
        const status = r.rows === 0 ? '✅ 0' : `❌ ${r.rows} (NOT EMPTY!)`;
        console.log(` ${r.table.padEnd(34)} | ${status}`);
      }
    }
    console.log('='.repeat(62));
    console.log(`\n delivery_pricing_rules (re-seeded)  → ${deliveryCnt} default pricing rule(s)\n`);

    const allClear = results.every(r => r.ok && r.rows === 0);
    if (allClear) {
      console.log('✅  ALL tables cleared. Database is empty (except delivery_pricing_rules defaults).\n');
    } else {
      console.log('⚠️  One or more tables still have rows or had errors. Review output above.\n');
      process.exit(1);
    }
  } finally {
    await conn.end();
  }
}

clearDatabase().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
