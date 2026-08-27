import { query } from "./database.js";
import { hashPassword, verifyPassword, validatePassword, signJwt, verifyJwt } from "./utils/security.js";

async function runTests() {
  console.log("=== RUNNING PHASE 1 VERIFICATION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Password Hashing & Verification Tests
  const plainPwd = "securePassword123";
  const pwdHash = hashPassword(plainPwd);
  assert(pwdHash.startsWith("pbkdf2:sha512:"), "Password is generated as a secure PBKDF2 hash");

  const correctResult = verifyPassword(plainPwd, pwdHash);
  assert(correctResult.verified === true, "Login succeeds with correct password");

  const wrongResult = verifyPassword("wrongPass123", pwdHash);
  assert(wrongResult.verified === false, "Login fails with incorrect password");

  // 2. Password Validation Rules
  assert(validatePassword("").valid === false, "Rejects empty password");
  assert(validatePassword("123").valid === false, "Rejects short password < 6 chars");
  assert(validatePassword("validPass123").valid === true, "Accepts valid password");

  // 3. JWT Signing & Verification
  const token = signJwt({ id: "u123", email: "test@farm.com", role: "farmer" }, "testsecret", 3600);
  const decoded = verifyJwt(token, "testsecret");
  assert(decoded && decoded.id === "u123" && decoded.role === "farmer", "JWT signed and verified accurately");

  const invalidDecoded = verifyJwt(token, "wrongsecret");
  assert(invalidDecoded === null, "JWT with wrong secret signature rejected");

  // 4. Seeded Accounts Password Hash Verification
  const seededAdmin = await query.get("SELECT password FROM users WHERE email = 'admin@farmconnect.com'");
  assert(seededAdmin && seededAdmin.password.startsWith("pbkdf2:sha512:"), "Seeded admin password is securely hashed in SQLite database");

  const adminVerify = verifyPassword("admin123", seededAdmin.password);
  assert(adminVerify.verified === true, "Seeded admin credentials verify cleanly");

  console.log("\n==========================================");
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");
}

runTests().catch(console.error);
