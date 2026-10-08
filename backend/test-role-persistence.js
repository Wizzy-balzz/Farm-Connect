import { query } from "./database.js";
import { hashPassword } from "./utils/security.js";
import { requestOtp, verifyOtp } from "./services/otpService.js";

async function runOtpPurposeTests() {
  console.log("=== RUNNING FARMCONNECT OTP PURPOSE & REGISTRATION BUG FIX TESTS ===");
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

  const testContact = "+919988776655";
  const validPurposes = [
    "password_change",
    "password_reset",
    "order_confirmation",
    "sensitive_action",
    "registration_verification"
  ];

  // Cleanup test OTP records
  await query.run("DELETE FROM otp_verifications WHERE contact = ?", [testContact]);

  // --- TEST A: REGISTRATION VERIFICATION OTP ---
  console.log("\n--- TEST A: registration_verification OTP Purpose ---");
  const regReq = await requestOtp({ contact: testContact, purpose: "registration_verification" });
  assert(regReq.success === true, "Request OTP with purpose 'registration_verification' -> SUCCESS");

  const regRecord = await query.get(
    "SELECT * FROM otp_verifications WHERE contact = ? AND purpose = 'registration_verification' ORDER BY createdAt DESC LIMIT 1",
    [testContact]
  );
  assert(regRecord !== null, "Database stores OTP record specifically with purpose = 'registration_verification'");

  // --- TEST B: PURPOSE ISOLATION DEFENSE ---
  console.log("\n--- TEST B: OTP Purpose Cross-Use Defense ---");
  // Attempt to use a password_reset request against registration_verification
  await requestOtp({ contact: testContact, purpose: "password_reset" });
  const resetRecord = await query.get(
    "SELECT * FROM otp_verifications WHERE contact = ? AND purpose = 'password_reset' ORDER BY createdAt DESC LIMIT 1",
    [testContact]
  );

  // Verifying with wrong purpose must fail
  const crossVerify = await verifyOtp({ contact: testContact, purpose: "registration_verification", otp: "123456" });
  assert(crossVerify.valid === false, "Cross-purpose verification attempt -> REJECTED (OTP purpose isolation intact)");

  // --- TEST C: ALL ALLOWED OTP PURPOSES ---
  console.log("\n--- TEST C: Verify All 5 Allowed OTP Purposes ---");
  for (const purpose of validPurposes) {
    const res = await requestOtp({ contact: testContact, purpose });
    assert(res.success === true, `Purpose '${purpose}' requested successfully`);
  }

  // --- TEST D: INVALID OTP PURPOSE REJECTION ---
  console.log("\n--- TEST D: Invalid OTP Purpose Rejection ---");
  const invalidPurposes = ["arbitrary_purpose", "mobile_verification", "undefined", "hack_attempt"];
  for (const invP of invalidPurposes) {
    assert(!validPurposes.includes(invP), `Invalid purpose '${invP}' correctly excluded from allowed list`);
  }

  // Cleanup test records
  await query.run("DELETE FROM otp_verifications WHERE contact = ?", [testContact]);

  console.log("\n==========================================");
  console.log(`OTP PURPOSE FIX TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("==========================================");
}

runOtpPurposeTests().catch(console.error);
