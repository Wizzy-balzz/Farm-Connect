import fs from "fs";
import { getOrderStatusLabel, getUnitLabel, ORDER_STATUS_VOCABULARY, UNIT_VOCABULARY } from "../../frontend/src/utils/controlledVocabulary.js";

async function runOrderTrackingLangTests() {
  console.log("================================================================================");
  console.log("     FARMCONNECT — ORDER TRACKING `lang` & MULTILINGUAL TARGETED TEST SUITE    ");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = "") {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ""}`);
      failed++;
    }
  }

  // 1. Static Contract Test: OrderTracking.jsx destructures `lang` from useLanguage()
  const orderTrackingSrc = fs.readFileSync("frontend/src/pages/vendor/OrderTracking.jsx", "utf-8");

  const baseMatches = orderTrackingSrc.match(/function OrderTrackingBase\(\)\s*\{[\s\S]*?const\s*\{([^}]+)\}\s*=\s*useLanguage\(\);/);
  assert(
    baseMatches !== null,
    "1. OrderTrackingBase calls useLanguage() hook"
  );

  const destructuredFields = baseMatches ? baseMatches[1].split(",").map((s) => s.trim()) : [];
  assert(
    destructuredFields.includes("lang"),
    "2. OrderTrackingBase explicitly destructures 'lang' from useLanguage()",
    `Found fields: ${destructuredFields.join(", ")}`
  );
  assert(
    destructuredFields.includes("t"),
    "3. OrderTrackingBase explicitly destructures 't' from useLanguage()",
    `Found fields: ${destructuredFields.join(", ")}`
  );

  // 2. Static Contract Test: No undeclared references to lang
  const stepperMatches = orderTrackingSrc.match(/function TrackingStepper\(\s*\{[^}]*\}\s*\)\s*\{[\s\S]*?const\s*\{([^}]+)\}\s*=\s*useLanguage\(\);/);
  assert(
    stepperMatches !== null && stepperMatches[1].includes("lang"),
    "4. TrackingStepper explicitly destructures 'lang' from useLanguage()"
  );

  // 3. Controlled Vocabulary Translations: getOrderStatusLabel & getUnitLabel
  console.log("\n--- Testing Controlled Vocabulary Multilingual Resolution ---");
  const testLanguages = [
    { code: "en", expectedConfirmed: "Confirmed", expectedKg: "kg" },
    { code: "ta", expectedConfirmed: "உறுதிப்படுத்தப்பட்டது", expectedKg: "கிலோ" },
    { code: "hi", expectedConfirmed: "पुष्टि की गई", expectedKg: "किग्रा" },
    { code: "te", expectedConfirmed: "ధృవీకరించబడింది", expectedKg: "కిలో" },
    { code: "kn", expectedConfirmed: "ದೃಢೀಕರಿಸಲಾಗಿದೆ", expectedKg: "ಕೆಜಿ" }
  ];

  for (const tl of testLanguages) {
    const statusLabel = getOrderStatusLabel("Confirmed", tl.code);
    assert(
      statusLabel === tl.expectedConfirmed,
      `5. getOrderStatusLabel('Confirmed', '${tl.code}') returns correct translation`,
      `Expected '${tl.expectedConfirmed}', got '${statusLabel}'`
    );

    const unitLabel = getUnitLabel("kg", tl.code);
    assert(
      unitLabel === tl.expectedKg,
      `6. getUnitLabel('kg', '${tl.code}') returns correct translation`,
      `Expected '${tl.expectedKg}', got '${unitLabel}'`
    );
  }

  // 4. Default Fallbacks: When lang is undefined or unknown
  console.log("\n--- Testing Fallback Handling ---");
  const fallbackStatus = getOrderStatusLabel("Confirmed", undefined);
  assert(
    fallbackStatus === "Confirmed",
    "7. getOrderStatusLabel with undefined lang safely falls back to English ('Confirmed')"
  );

  const fallbackUnit = getUnitLabel("kg", undefined);
  assert(
    fallbackUnit === "kg",
    "8. getUnitLabel with undefined lang safely falls back to English ('kg')"
  );

  const unknownStatus = getOrderStatusLabel("UnknownStatus123", "en");
  assert(
    unknownStatus === "UnknownStatus123",
    "9. getOrderStatusLabel preserves unknown status without throwing error"
  );

  const unknownUnit = getUnitLabel("unknown_unit_xyz", "en");
  assert(
    unknownUnit === "unknown_unit_xyz",
    "10. getUnitLabel preserves unknown unit without throwing error"
  );

  console.log("\n================================================================================");
  console.log(`ORDER TRACKING LANG TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================\n");

  process.exit(failed > 0 ? 1 : 0);
}

runOrderTrackingLangTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
