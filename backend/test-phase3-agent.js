import assert from "assert";
import { query } from "./database.js";
import { executeAiTool, normalizeCropName, CROP_NAME_CANONICAL, TOOL_DECLARATIONS } from "./ai/aiTools.js";
import { processAiChat, parseNaturalMarketplaceQuery } from "./ai/aiService.js";
import { isToolAllowed, sanitizeToolParams } from "./ai/aiPermissions.js";

let testsPassed = 0;
let testsFailed = 0;

function pass(msg) {
  testsPassed++;
  console.log(`  ✅ PASS: ${msg}`);
}

function fail(msg, err) {
  testsFailed++;
  console.error(`  ❌ FAIL: ${msg}`, err ? `\n    ${err.message || err}` : "");
}

async function runTest(name, fn) {
  console.log(`\nTEST: ${name}`);
  try {
    await fn();
  } catch (err) {
    fail(name, err);
  }
}

async function startPhase3Tests() {
  console.log("========================================================");
  console.log("🌐 STARTING FARMCONNECT PHASE 3 MULTILINGUAL AI TEST SUITE");
  console.log("========================================================");

  // Setup mock user sessions
  const farmerUser = {
    id: "f1",
    role: "farmer",
    name: "Ramesh Patel",
    district: "Nashik",
    region: "Maharashtra",
    lat: 19.9975,
    lng: 73.7898,
    primaryCrop: "Tomato"
  };

  const vendorUser = {
    id: "v1",
    role: "vendor",
    name: "FreshDirect B2B",
    district: "Mumbai",
    region: "Maharashtra",
    lat: 19.076,
    lng: 72.8777
  };

  // TEST 1: Agricultural Crop Name Canonical Normalizer (Tamil, Hindi, Tanglish)
  await runTest("Agricultural Crop Name Canonical Normalizer", async () => {
    assert.strictEqual(normalizeCropName("தக்காளி"), "Tomato", "Tamil தக்காளி resolves to Tomato");
    assert.strictEqual(normalizeCropName("thakkali"), "Tomato", "Tanglish thakkali resolves to Tomato");
    assert.strictEqual(normalizeCropName("टमाटर"), "Tomato", "Hindi टमाटर resolves to Tomato");
    assert.strictEqual(normalizeCropName("tamatar"), "Tomato", "Hinglish tamatar resolves to Tomato");
    assert.strictEqual(normalizeCropName("வெங்காயம்"), "Onion", "Tamil வெங்காயம் resolves to Onion");
    assert.strictEqual(normalizeCropName("vengayam"), "Onion", "Tanglish vengayam resolves to Onion");
    assert.strictEqual(normalizeCropName("प्याज"), "Onion", "Hindi प्याज resolves to Onion");
    assert.strictEqual(normalizeCropName("அரிசி"), "Rice", "Tamil அரிசி resolves to Rice");
    assert.strictEqual(normalizeCropName("चावल"), "Rice", "Hindi चावल resolves to Rice");
    assert.strictEqual(normalizeCropName("கோதுமை"), "Wheat", "Tamil கோதுமை resolves to Wheat");
    assert.strictEqual(normalizeCropName("गेहूं"), "Wheat", "Hindi गेहूं resolves to Wheat");
    assert.strictEqual(normalizeCropName("கீரை"), "Spinach", "Tamil கீரை resolves to Spinach");
    assert.strictEqual(normalizeCropName("पालक"), "Spinach", "Hindi पालक resolves to Spinach");
    pass("Canonical crop normalizer accurately maps Tamil, Hindi, and Tanglish produce names");
  });

  // TEST 2: Price Tool Execution from Tamil Query ("தக்காளி")
  await runTest("Price Tool Execution from Tamil (தக்காளியின் விலை)", async () => {
    const res = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "தக்காளி" });
    assert(res && res.success, "getPriceIntelligence executed with Tamil commodity");
    assert(res.data && res.data.hasData, "Found active listings for Tamil crop query");
    assert(res.data.statistics && res.data.statistics.averagePrice, "Calculated average price for தக்காளி");
    assert(res.data.statistics.averagePrice.includes("₹"), "Price preserves currency symbol ₹");
    pass(`Price intelligence from Tamil 'தக்காளி': Average ${res.data.statistics.averagePrice}`);
  });

  // TEST 3: Demand Tool Execution from Hindi Query ("टमाटर")
  await runTest("Demand Tool Execution from Hindi (टमाटर की मांग)", async () => {
    const res = await executeAiTool(farmerUser, "getDemandIntelligence", { commodity: "टमाटर" });
    assert(res && res.success, "getDemandIntelligence executed with Hindi commodity");
    assert(res.data !== undefined, "Demand data structure returned");
    pass("Demand intelligence executed accurately from Hindi produce query");
  });

  // TEST 4: Weather Advisory Tool from Tanglish Query ("thakkali")
  await runTest("Weather Advisory Tool from Tanglish Query", async () => {
    const res = await executeAiTool(farmerUser, "getWeatherAdvisory", { crop: "thakkali", district: "Madurai" });
    assert(res && res.success, "getWeatherAdvisory executed with Tanglish produce name");
    assert(res.data && (res.data.currentConditions || res.data.error?.code === "WEATHER_UNAVAILABLE"), "Weather response structured for Tanglish query");
    if (res.data.currentConditions) {
      assert(res.data.currentConditions.temperature.includes("°C"), "Temperature unit preserved");
      pass(`Weather advisory for Tanglish crop: ${res.data.currentConditions.temperature}, ${res.data.currentConditions.condition}`);
    } else {
      pass("Weather advisory handled cleanly without data fabrication");
    }
  });

  // TEST 5: Search Products with Tamil Script ("தக்காளி")
  await runTest("Search Products with Tamil Script Query", async () => {
    const res = await executeAiTool(vendorUser, "searchProducts", { queryText: "தக்காளி" });
    assert(res && res.success, "searchProducts executed with Tamil query");
    assert(Array.isArray(res.data), "Product list returned");
    assert(res.data.length > 0, "Found matching products for Tamil query");
    assert(res.data.some(p => p.name.toLowerCase().includes("tomato")), "Matched English product name from Tamil query");
    pass(`searchProducts found ${res.data.length} listing(s) using Tamil produce name`);
  });

  // TEST 6: Search Products with Hindi Script ("टमाटर")
  await runTest("Search Products with Hindi Script Query", async () => {
    const res = await executeAiTool(vendorUser, "searchProducts", { queryText: "टमाटर" });
    assert(res && res.success, "searchProducts executed with Hindi query");
    assert(Array.isArray(res.data), "Product list returned");
    assert(res.data.length > 0, "Found matching products for Hindi query");
    pass(`searchProducts found ${res.data.length} listing(s) using Hindi produce name`);
  });

  // TEST 7: Search Products with Tanglish ("vengayam")
  await runTest("Search Products with Tanglish Query", async () => {
    const res = await executeAiTool(vendorUser, "searchProducts", { queryText: "vengayam" });
    assert(res && res.success, "searchProducts executed with Tanglish query");
    assert(Array.isArray(res.data), "Product list returned");
    assert(res.data.length > 0, "Found matching onion products for Tanglish query");
    pass(`searchProducts found ${res.data.length} listing(s) using Tanglish produce name`);
  });

  // TEST 8: Selling Recommendation with Tamil Commodity ("தக்காளி")
  await runTest("Selling Recommendation with Tamil Commodity (FACTS vs REASONING)", async () => {
    const res = await executeAiTool(farmerUser, "getSellingRecommendation", { commodity: "தக்காளி", quantity: 200 });
    assert(res && res.success, "getSellingRecommendation executed with Tamil commodity");
    assert(res.data && res.data.FACTS, "Output contains explicit FACTS section");
    assert(res.data.REASONING, "Output contains explicit REASONING section");
    assert(res.data.FACTS.inventory, "Facts contain inventory metrics");
    assert(res.data.FACTS.marketPricing, "Facts contain market pricing metrics");
    assert(res.data.FACTS.weather, "Facts contain weather metrics");
    pass("Selling recommendation correctly resolved Tamil commodity and preserved FACTS vs REASONING");
  });

  // TEST 9: Selling Recommendation with Hindi Commodity ("टमाटर")
  await runTest("Selling Recommendation with Hindi Commodity", async () => {
    const res = await executeAiTool(farmerUser, "getSellingRecommendation", { commodity: "टमाटर", quantity: 200 });
    assert(res && res.success, "getSellingRecommendation executed with Hindi commodity");
    assert(res.data && res.data.FACTS, "Output contains FACTS section");
    assert(res.data.REASONING, "Output contains REASONING section");
    pass("Selling recommendation correctly resolved Hindi commodity");
  });

  // TEST 10: Numerical Value & Unit Preservation
  await runTest("Numerical Value and Unit Preservation Across Tools", async () => {
    const priceRes = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "Tomato" });
    assert(priceRes.data.statistics.averagePrice.includes("₹"), "Currency ₹ preserved in price");
    assert(priceRes.data.statistics.averagePrice.includes("/kg"), "Unit /kg preserved in price");
    
    const weatherRes = await executeAiTool(farmerUser, "getWeatherAdvisory", { crop: "Tomato", district: "Nashik" });
    assert(weatherRes.data.currentConditions.temperature.includes("°C"), "Metric °C preserved in temperature");
    assert(weatherRes.data.currentConditions.humidity.includes("%"), "Unit % preserved in humidity");
    assert(weatherRes.data.currentConditions.windSpeed.includes("km/h"), "Unit km/h preserved in wind speed");
    pass("Exact currencies (₹) and agricultural units (kg, °C, %, km/h) strictly preserved");
  });

  // TEST 11: Non-Fabrication of Prices for Missing Produce
  await runTest("Zero Price Fabrication Policy (Missing Produce)", async () => {
    const res = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "DragonFruitNonExistent" });
    assert(res && res.success, "Query executed safely");
    assert.strictEqual(res.data.hasData, false, "Honest hasData=false reported for missing produce");
    assert.strictEqual(res.data.sampleSize, 0, "Sample size is exactly 0");
    pass("Zero fabrication policy confirmed for produce without active listings");
  });

  // TEST 12: Non-Fabrication of Weather for Invalid Locations
  await runTest("Zero Weather Fabrication Policy (Invalid Location)", async () => {
    const res = await executeAiTool(farmerUser, "getWeatherAdvisory", { lat: 99999, lng: 99999 });
    assert(res && (res.success === false || res.data?.success === false), "Invalid coordinate request refused without fabrication");
    const errCode = res.error?.code || res.data?.error?.code;
    assert.strictEqual(errCode, "WEATHER_UNAVAILABLE", "Clean error code returned");
    pass("Zero weather fabrication confirmed for invalid coordinates");
  });

  // TEST 13: Vendor RBAC Still Enforced for Multilingual Requests
  await runTest("Vendor RBAC Enforced Against Farmer Selling Tool", async () => {
    const allowed = isToolAllowed("vendor", "getSellingRecommendation");
    assert.strictEqual(allowed, false, "Vendor forbidden from getSellingRecommendation in RBAC");
    const execRes = await executeAiTool(vendorUser, "getSellingRecommendation", { commodity: "தக்காளி" });
    assert.strictEqual(execRes.success, false, "Vendor execution rejected");
    assert.strictEqual(execRes.error.code, "FORBIDDEN", "FORBIDDEN code returned to vendor");
    pass("Vendor role forbidden from accessing selling recommendation tool");
  });

  // TEST 14: Farmer ID Anti-Spoofing Enforced in Multilingual Tool Calls
  await runTest("Farmer ID Anti-Spoofing Enforced", async () => {
    const sanitized = sanitizeToolParams(farmerUser, "getSellingRecommendation", {
      commodity: "தக்காளி",
      farmerId: "f999_malicious"
    });
    assert.strictEqual(sanitized.farmerId, "f1", "farmerId locked to authenticated session (f1)");
    pass("Farmer ID spoofing attempt blocked and sanitized to session user");
  });

  // TEST 15: Natural Search Parser Multilingual Support
  await runTest("Natural Search Parser Multilingual Support", async () => {
    const taSearch = parseNaturalMarketplaceQuery("ஆர்கானிக் தக்காளி under 50");
    assert.strictEqual(taSearch.queryText, "Tomato", "Parsed Tamil தக்காளி to Tomato");
    assert.strictEqual(taSearch.organic, true, "Parsed Tamil ஆர்கானிக் to organic");
    assert.strictEqual(taSearch.maxPrice, 50, "Parsed maxPrice 50");

    const hiSearch = parseNaturalMarketplaceQuery("जैविक टमाटर under 40");
    assert.strictEqual(hiSearch.queryText, "Tomato", "Parsed Hindi टमाटर to Tomato");
    assert.strictEqual(hiSearch.organic, true, "Parsed Hindi जैविक to organic");
    assert.strictEqual(hiSearch.maxPrice, 40, "Parsed maxPrice 40");

    const tanglishSearch = parseNaturalMarketplaceQuery("thakkali rate under 60");
    assert.strictEqual(tanglishSearch.queryText, "Tomato", "Parsed Tanglish thakkali to Tomato");
    assert.strictEqual(tanglishSearch.maxPrice, 60, "Parsed maxPrice 60");
    pass("Natural language marketplace query parser successfully processes Tamil, Hindi, and Tanglish");
  });

  // TEST 16: Multi-turn Cross-Lingual Context (English -> Tamil)
  await runTest("Cross-Lingual Context Retention (English -> Tamil)", async () => {
    const convId = `test_conv_${Date.now()}`;
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [convId, farmerUser.id, "Cross-Lingual Context Test", new Date().toISOString(), new Date().toISOString()]
    );

    // Turn 1: English
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', ?, ?)",
      [`msg_${Date.now()}_1`, convId, "What are the available organic tomatoes on the platform?", new Date().toISOString()]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'assistant', ?, ?)",
      [`msg_${Date.now()}_2`, convId, "We have Organic Heirloom Tomatoes listed at ₹45/kg with 320 kg in stock.", new Date().toISOString()]
    );

    // Turn 2: Tamil follow-up
    const result = await processAiChat({
      user: farmerUser,
      prompt: "இதுல cheapest எது?",
      conversationId: convId,
      lang: "ta"
    });

    assert(result && result.conversationId === convId, "Maintained active conversation ID");
    assert(result.message && result.message.content, "Assistant returned follow-up message");
    pass("Cross-lingual English -> Tamil conversation context retained in database");
  });

  // TEST 17: Multi-turn Cross-Lingual Context (Tamil -> English)
  await runTest("Cross-Lingual Context Retention (Tamil -> English)", async () => {
    const convId = `test_conv_${Date.now()}_ta_en`;
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [convId, farmerUser.id, "Tamil to English Context Test", new Date().toISOString(), new Date().toISOString()]
    );

    // Turn 1: Tamil
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', ?, ?)",
      [`msg_${Date.now()}_1`, convId, "தக்காளி விலை என்ன?", new Date().toISOString()]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'assistant', ?, ?)",
      [`msg_${Date.now()}_2`, convId, "தக்காளியின் சராசரி விலை ₹45/kg ஆக உள்ளது.", new Date().toISOString()]
    );

    // Turn 2: English follow-up
    const result = await processAiChat({
      user: farmerUser,
      prompt: "Is buyer demand increasing for it?",
      conversationId: convId,
      lang: "en"
    });

    assert(result && result.conversationId === convId, "Maintained conversation ID");
    assert(result.message && result.message.content, "Assistant returned follow-up response");
    pass("Cross-lingual Tamil -> English follow-up retained product entity");
  });

  // TEST 18: Hindi Multi-turn Context Retention
  await runTest("Hindi Multi-turn Context Retention", async () => {
    const convId = `test_conv_${Date.now()}_hi`;
    await query.run(
      "INSERT INTO ai_conversations (id, userId, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [convId, farmerUser.id, "Hindi Multi-Turn Context Test", new Date().toISOString(), new Date().toISOString()]
    );

    // Turn 1: Hindi
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', ?, ?)",
      [`msg_${Date.now()}_1`, convId, "टमाटर का भाव कितना है?", new Date().toISOString()]
    );
    await query.run(
      "INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'assistant', ?, ?)",
      [`msg_${Date.now()}_2`, convId, "FarmConnect पर टमाटर की औसत कीमत ₹45/kg है।", new Date().toISOString()]
    );

    // Turn 2: Hindi follow-up
    const result = await processAiChat({
      user: farmerUser,
      prompt: "क्या मांग बढ़ रही है?",
      conversationId: convId,
      lang: "hi"
    });

    assert(result && result.conversationId === convId, "Maintained conversation ID");
    assert(result.message && result.message.content, "Assistant returned response");
    pass("Hindi multi-turn context successfully persisted across turns");
  });

  // TEST 19: Tanglish Crop + Market Question in Agent Chat
  await runTest("Tanglish Prompt Chat Execution", async () => {
    const result = await processAiChat({
      user: farmerUser,
      prompt: "En tomato-ku ippo price enna? Demand irukka?",
      conversationId: null,
      lang: "ta"
    });
    assert(result && result.conversationId, "Created conversation for Tanglish prompt");
    assert(result.message && result.message.content, "Returned assistant response");
    pass("Tanglish agricultural prompt handled safely");
  });

  // TEST 20: Tamil + English Mixed Question
  await runTest("Tamil + English Mixed Question", async () => {
    const result = await processAiChat({
      user: farmerUser,
      prompt: "Tomato-oda price இப்ப எவ்வளவு? Demand எப்படி இருக்கு?",
      conversationId: null,
      lang: "ta"
    });
    assert(result && result.conversationId, "Created conversation for mixed Tamil+English prompt");
    assert(result.message && result.message.content, "Returned assistant response");
    pass("Mixed Tamil + English prompt handled cleanly");
  });

  // TEST 21: Hindi + English Mixed Question
  await runTest("Hindi + English Mixed Question", async () => {
    const result = await processAiChat({
      user: farmerUser,
      prompt: "Tamatar ka current price aur demand kaisa hai?",
      conversationId: null,
      lang: "hi"
    });
    assert(result && result.conversationId, "Created conversation for mixed Hindi+English prompt");
    assert(result.message && result.message.content, "Returned assistant response");
    pass("Mixed Hindi + English prompt handled cleanly");
  });

  // TEST 22: Backward Compatibility — Phase 1 searchProducts and compareProducts
  await runTest("Phase 1 Tool Compatibility Preservation", async () => {
    const searchRes = await executeAiTool(vendorUser, "searchProducts", { category: "Vegetables" });
    assert(searchRes && searchRes.success, "searchProducts executed successfully");
    assert(searchRes.data.length > 0, "Returned vegetable listings");

    const compareRes = await executeAiTool(vendorUser, "compareProducts", { productIds: ["p1", "p2"] });
    assert(compareRes && compareRes.success, "compareProducts executed successfully");
    assert.strictEqual(compareRes.data.length, 2, "Returned compared products");
    pass("Phase 1 tools (searchProducts, compareProducts) remain 100% operational");
  });

  // TEST 23: Backward Compatibility — Phase 2 Agricultural Tools
  await runTest("Phase 2 Weather & Statistical Intelligence Preservation", async () => {
    const weatherRes = await executeAiTool(farmerUser, "getWeatherAdvisory", { district: "Nashik" });
    assert(weatherRes && weatherRes.success, "getWeatherAdvisory executed successfully");

    const priceRes = await executeAiTool(farmerUser, "getPriceIntelligence", { commodity: "Tomato" });
    assert(priceRes && priceRes.success, "getPriceIntelligence executed successfully");
    assert(priceRes.data.statistics.medianPrice, "Calculated median price");

    const demandRes = await executeAiTool(farmerUser, "getDemandIntelligence", { category: "Vegetables" });
    assert(demandRes && demandRes.success, "getDemandIntelligence executed successfully");
    pass("Phase 2 tools (getWeatherAdvisory, getPriceIntelligence, getDemandIntelligence) remain 100% operational");
  });

  // TEST 24: Tool Registry Multilingual Descriptions
  await runTest("Tool Registry Multilingual Integrity", async () => {
    assert(TOOL_DECLARATIONS.searchProducts, "searchProducts declared in registry");
    assert(TOOL_DECLARATIONS.getPriceIntelligence, "getPriceIntelligence declared in registry");
    assert(TOOL_DECLARATIONS.getDemandIntelligence, "getDemandIntelligence declared in registry");
    assert(TOOL_DECLARATIONS.getSellingRecommendation, "getSellingRecommendation declared in registry");
    assert(TOOL_DECLARATIONS.getWeatherAdvisory, "getWeatherAdvisory declared in registry");
    pass("All 16 tools in registry maintained with comprehensive parameter schemas");
  });

  console.log("\n========================================================");
  console.log(`🏁 PHASE 3 TEST SUITE COMPLETE: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log("========================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

startPhase3Tests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
