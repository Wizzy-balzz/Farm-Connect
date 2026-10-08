import { query, dbInitPromise } from "./database.js";
import { translateCategory, translateUnit, translateGrade } from "./utils/controlledVocabulary.js";

async function testApiLogic() {
  await dbInitPromise;

  console.log("=== TESTING MULTILINGUAL PRODUCT RESOLUTION LOGIC ===");
  const products = await query.all("SELECT * FROM products ORDER BY createdAt DESC LIMIT 5");

  const testLangs = ["en", "ta", "hi", "te", "ml"];

  for (const lang of testLangs) {
    console.log(`\n--- LANGUAGE: ${lang.toUpperCase()} ---`);
    
    // Simulate query in server.js
    const productIds = products.map((p) => p.id);
    const placeholders = productIds.map(() => "?").join(",");
    const targetLangs = lang === "en" ? ["en"] : [lang, "en"];
    const langPlaceholders = targetLangs.map(() => "?").join(",");

    const translations = await query.all(
      `SELECT product_id, language_code, name, description 
       FROM product_translations 
       WHERE product_id IN (${placeholders}) AND language_code IN (${langPlaceholders})`,
      [...productIds, ...targetLangs]
    );

    const transMap = new Map();
    for (const t of (translations || [])) {
      transMap.set(`${t.product_id}_${t.language_code}`, t);
    }

    for (const p of products) {
      const origName = p.name;
      const targetTrans = transMap.get(`${p.id}_${lang}`);
      const enTrans = transMap.get(`${p.id}_en`);
      const resolvedTrans = targetTrans || enTrans;

      const translatedName = resolvedTrans?.name || origName;
      const translatedCat = translateCategory(p.category, lang);
      const translatedUnit = translateUnit(p.unit, lang);
      const translatedGrade = translateGrade(p.grade, lang);

      console.log(`[${p.id}] ${origName} -> "${translatedName}" | Cat: ${translatedCat} | Unit: ${translatedUnit} | Grade: ${translatedGrade} | Price: ₹${p.price}`);
    }
  }

  console.log("\nAll language queries resolved successfully!");
  process.exit(0);
}

testApiLogic().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
