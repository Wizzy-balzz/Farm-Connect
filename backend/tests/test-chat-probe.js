import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve("./backend/.env") });

import { signJwt } from "../utils/security.js";
import { query, pool, dbInitPromise } from "../database.js";

async function runProbe() {
  if (dbInitPromise) await dbInitPromise;

  console.log("Waiting 35 seconds to ensure Gemini free-tier rate-limit window is completely clear...");
  await new Promise(r => setTimeout(r, 35000));

  console.log("=== RUNNING FULL AI CHAT FLOW PROBE ===");
  const vendor = await query.get("SELECT id, name, role, email FROM users WHERE role = 'vendor' LIMIT 1");
  const farmer = (await query.get("SELECT id, name, role, email FROM users WHERE id = 'f1'")) || (await query.get("SELECT id, name, role, email FROM users WHERE role = 'farmer' LIMIT 1"));

  console.log("Vendor User:", vendor.name, `(${vendor.role})`);
  console.log("Farmer User:", farmer.name, `(${farmer.role})`);

  const vendorToken = signJwt({
    id: vendor.id,
    role: vendor.role,
    name: vendor.name,
    email: vendor.email
  });

  const farmerToken = signJwt({
    id: farmer.id,
    role: farmer.role,
    name: farmer.name,
    email: farmer.email
  });

  // 1. Test Vendor greeting 'hi'
  console.log("\n--- TEST 1: Vendor Greeting ('hi') ---");
  const res1 = await fetch("http://127.0.0.1:5000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost:5173",
      "Cookie": `fc_token=${vendorToken}`
    },
    body: JSON.stringify({ prompt: "hi", lang: "en" })
  });

  console.log("HTTP Status:", res1.status);
  console.log("CORS Origin:", res1.headers.get("access-control-allow-origin"));
  console.log("CORS Credentials:", res1.headers.get("access-control-allow-credentials"));
  const data1 = await res1.json();
  console.log("Success:", data1.success);
  console.log("AI Message:", data1.message?.content);

  // 2. Test Farmer greeting 'hi'
  console.log("\n--- TEST 2: Farmer Greeting ('hi') ---");
  const res2 = await fetch("http://127.0.0.1:5000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost:5173",
      "Cookie": `fc_token=${farmerToken}`
    },
    body: JSON.stringify({ prompt: "hi", lang: "en" })
  });

  console.log("HTTP Status:", res2.status);
  const data2 = await res2.json();
  console.log("Success:", data2.success);
  console.log("AI Message:", data2.message?.content);

  // 3. Test Vendor Tool Calling 'What is the price of tomatoes?'
  console.log("\n--- TEST 3: Vendor Market Tool ('What is the price of tomatoes?') ---");
  const res3 = await fetch("http://127.0.0.1:5000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost:5173",
      "Cookie": `fc_token=${vendorToken}`
    },
    body: JSON.stringify({ prompt: "What is the price of tomatoes?", lang: "en" })
  });

  console.log("HTTP Status:", res3.status);
  const data3 = await res3.json();
  console.log("Success:", data3.success);
  console.log("Tool Called:", data3.message?.toolName);
  console.log("AI Message:", data3.message?.content?.slice(0, 200));

  // 4. Test Farmer Inventory Tool Calling
  console.log("\n--- TEST 4: Farmer Inventory Tool ('Show my tomato inventory') ---");
  const res4 = await fetch("http://127.0.0.1:5000/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost:5173",
      "Cookie": `fc_token=${farmerToken}`
    },
    body: JSON.stringify({ prompt: "Show my tomato inventory", lang: "en" })
  });

  console.log("HTTP Status:", res4.status);
  const data4 = await res4.json();
  console.log("Success:", data4.success);
  console.log("Tool Called:", data4.message?.toolName);
  console.log("AI Message:", data4.message?.content?.slice(0, 200));

  await pool.end();
}

runProbe().catch(console.error);
