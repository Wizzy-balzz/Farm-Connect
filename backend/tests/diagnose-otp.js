import { query, pool, dbInitPromise } from "../database.js";

async function inspectDb() {
  if (dbInitPromise) await dbInitPromise;
  
  console.log("=== LATEST OTP VERIFICATIONS ===");
  const otpRows = await query.all("SELECT id, contact, purpose, expiresAt, attempts, verifiedAt, createdAt FROM otp_verifications ORDER BY createdAt DESC LIMIT 15");
  console.log(JSON.stringify(otpRows, null, 2));

  console.log("\n=== RECENT USERS ===");
  const users = await query.all("SELECT id, name, email, role, email_verified, createdAt FROM users ORDER BY createdAt DESC LIMIT 10");
  console.log(JSON.stringify(users, null, 2));

  await pool.end();
}

inspectDb().catch(console.error);
