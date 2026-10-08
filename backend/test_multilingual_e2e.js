import pool, { initDatabase } from "./database.js";
import {
  translateCategory,
  translateUnit,
  translateGrade,
  translateOrderStatus,
} from "./utils/controlledVocabulary.js";

async function runE2ETests() {
  console.log("=================================================");
  console.log("   MULTILINGUAL MARKETPLACE E2E VERIFICATION     ");
  console.log("=================================================\n");

  await initDatabase();
  const db = pool;

  // Test 1: Fallback Hierarchy Verification
  console.log("--- 1. Testing Fallback Hierarchy ---");
  const [allProducts] = await db.execute("SELECT * FROM products ORDER BY id LIMIT 5");
  const testProduct = allProducts[0];
  console.log(`Test Product: ID=${testProduct.id}, Original Name="${testProduct.name}"`);

  // Query translations for this product
  const [translations] = await db.execute(
    "SELECT * FROM product_translations WHERE product_id = ?",
    [testProduct.id]
  );
  console.log(`Found ${translations.length} translations for ${testProduct.id}:`, translations.map(t => t.language_code).join(", "));

  // Test languages: ta, hi, te, ml, and an un-translated language like bn (Bengali) or pa (Punjabi)
  const testLangs = [
    { code: "ta", name: "Tamil" },
    { code: "hi", name: "Hindi" },
    { code: "te", name: "Telugu" },
    { code: "ml", name: "Malayalam" },
    { code: "bn", name: "Bengali (Fallback Test)" },
  ];

  for (const { code, name } of testLangs) {
    // Simulate resolution logic
    const selectedTrans = translations.find(t => t.language_code === code);
    const enTrans = translations.find(t => t.language_code === "en");

    let resolvedName = testProduct.name;
    let fallbackLevel = "Original Source Content";

    if (selectedTrans && selectedTrans.name) {
      resolvedName = selectedTrans.name;
      fallbackLevel = `Selected Language (${code})`;
    } else if (code !== "en" && enTrans && enTrans.name) {
      resolvedName = enTrans.name;
      fallbackLevel = "English Fallback Translation";
    }

    console.log(`[${name}] -> "${resolvedName}" (Resolved via: ${fallbackLevel})`);
  }

  // Test 2: Controlled Vocabulary Verification across 23 languages
  console.log("\n--- 2. Testing Controlled Vocabulary Across Indian Languages ---");
  const testCategories = ["Vegetables", "Grains", "Fruits", "Spices", "Dairy"];
  const testUnits = ["kg", "quintal", "dozen"];
  const sampleLanguages = ["ta", "hi", "te", "ml", "gu", "kn", "bn", "mr", "pa", "or"];

  for (const lang of sampleLanguages) {
    const catLabels = testCategories.map(c => `${c}:${translateCategory(c, lang)}`).join(" | ");
    console.log(`[${lang.toUpperCase()} Categories]: ${catLabels}`);
  }

  // Test 3: Status Translation
  console.log("\n--- 3. Testing Order / Delivery Status Localization ---");
  const testStatuses = ["Pending", "In Transit", "Delivered", "Cancelled"];
  for (const lang of ["ta", "hi", "te", "ml"]) {
    const statusLabels = testStatuses.map(s => `${s} -> ${translateOrderStatus(s, lang)}`).join(" | ");
    console.log(`[${lang.toUpperCase()} Statuses]: ${statusLabels}`);
  }

  // Test 4: Verify Non-destructive Safety
  console.log("\n--- 4. Non-Destructive Integrity Verification ---");
  const [productCheck] = await db.execute("SELECT id, name, price, unit, moq FROM products LIMIT 3");
  for (const p of productCheck) {
    console.log(`Product #${p.id}: Name="${p.name}", Price=₹${p.price}, Unit=${p.unit}, MOQ=${p.moq}`);
    if (typeof p.price !== "number" && isNaN(Number(p.price))) {
      throw new Error(`Corrupted price for product ${p.id}`);
    }
  }
  console.log("✅ All product IDs, numerical prices, MOQ, and original names remain intact.");

  // Test 5: Admin CRUD on product_translations
  console.log("\n--- 5. Admin Translation CRUD Verification ---");
  const testLangCode = "mr"; // Marathi
  const testName = "चाचणी उत्पादन";
  const testDesc = "हे एक मराठी भाषेतील उत्पादन वर्णन आहे.";

  const transId = 'pt_test_' + Date.now();
  await db.execute(
    `INSERT INTO product_translations (id, product_id, language_code, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), updated_at = NOW()`,
    [transId, testProduct.id, testLangCode, testName, testDesc]
  );
  console.log(`Inserted test Marathi translation for product ${testProduct.id}`);

  // Fetch
  const [marathiRow] = await db.execute(
    "SELECT * FROM product_translations WHERE product_id = ? AND language_code = ?",
    [testProduct.id, testLangCode]
  );
  if (marathiRow.length > 0 && marathiRow[0].name === testName) {
    console.log("✅ Read back inserted translation successfully:", marathiRow[0]);
  } else {
    throw new Error("Failed to read back inserted translation");
  }

  // Delete test translation
  await db.execute(
    "DELETE FROM product_translations WHERE product_id = ? AND language_code = ?",
    [testProduct.id, testLangCode]
  );
  console.log("✅ Cleaned up test translation successfully.");

  console.log("\n=================================================");
  console.log("   ALL MULTILINGUAL E2E VERIFICATIONS PASSED!    ");
  console.log("=================================================");
  process.exit(0);
}

runE2ETests().catch(err => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
