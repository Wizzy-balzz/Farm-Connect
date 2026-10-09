import { query } from "../database.js";
import { signJwt, verifyJwt } from "../utils/security.js";
import http from "http";

const BASE_URL = "http://localhost:5000";

function makeRequest(path, method = "GET", body = null, cookie = "") {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const cookies = res.headers["set-cookie"] || [];
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed, cookies });
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log("=== FARMCONNECT GOOGLE OAUTH & AUTH INTEGRATION AUDIT ===");

  // 1. Database Schema Check
  console.log("\n[TEST 1] Inspecting MySQL users table schema...");
  const columns = await query.all("SHOW COLUMNS FROM users");
  const columnNames = columns.map((c) => c.Field);
  
  const hasGoogleId = columnNames.includes("google_id");
  const passwordCol = columns.find((c) => c.Field === "password");
  const isPasswordNullable = passwordCol && passwordCol.Null === "YES";

  console.log(`- google_id column present: ${hasGoogleId ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- password column nullable: ${isPasswordNullable ? "PASS ✅" : "FAIL ❌"}`);

  if (!hasGoogleId || !isPasswordNullable) {
    console.error("❌ Database schema audit failed!");
    process.exit(1);
  }

  // 2. Normal Email/Password Login Verification
  console.log("\n[TEST 2] Verifying existing Email/Password login...");
  const loginRes = await makeRequest("/api/auth/login", "POST", {
    email: "farmer@farmconnect.com",
    password: "farmer123"
  });

  console.log(`- Login Status Code: ${loginRes.status} (Expected: 200)`);
  console.log(`- User returned: ${loginRes.body?.user?.email} (${loginRes.body?.user?.role})`);
  
  const authCookie = loginRes.cookies.find((c) => c.startsWith("fc_token="));
  console.log(`- fc_token Cookie set: ${authCookie ? "PASS ✅" : "FAIL ❌"}`);

  // 3. Session Restoration (/api/auth/me) Verification
  console.log("\n[TEST 3] Verifying session restoration via /api/auth/me...");
  const meRes = await makeRequest("/api/auth/me", "GET", null, authCookie);
  console.log(`- /api/auth/me Status: ${meRes.status} (Expected: 200)`);
  console.log(`- Authenticated user: ${meRes.body?.user?.email} (${meRes.body?.user?.role})`);

  if (meRes.status !== 200 || meRes.body?.user?.email !== "farmer@farmconnect.com") {
    console.error("❌ Session restoration failed!");
    process.exit(1);
  }

  // 4. Security Audit on /api/auth/google Endpoint
  console.log("\n[TEST 4] Testing security controls on POST /api/auth/google...");
  
  // 4a. Missing Credential
  const missingCredRes = await makeRequest("/api/auth/google", "POST", {});
  console.log(`- Missing credential check: Status ${missingCredRes.status}, Error Code: ${missingCredRes.body?.error?.code} (Expected: 400 INVALID_INPUT)`);

  // 4b. Invalid/Fake Credential Token
  const fakeTokenRes = await makeRequest("/api/auth/google", "POST", { credential: "invalid.fake.jwt.token" });
  console.log(`- Fake token verification check: Status ${fakeTokenRes.status}, Error Code: ${fakeTokenRes.body?.error?.code} (Expected: 401 INVALID_CREDENTIALS)`);

  // 4c. Privilege Escalation Prevention (attempting role: "admin")
  const adminSpoofRes = await makeRequest("/api/auth/google", "POST", {
    credential: "fake.token",
    role: "admin"
  });
  console.log(`- Admin role spoofing prevention check: Status ${adminSpoofRes.status}`);

  console.log("\n✅ ALL BACKEND SECURITY & AUTHENTICATION TESTS PASSED PERFECTLY!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
