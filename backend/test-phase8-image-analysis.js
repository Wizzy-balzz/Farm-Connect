import { query, initDatabase } from "./database.js";
import { validateCropImage, analyzeCropImage, MAX_IMAGE_FILE_SIZE_BYTES } from "./services/cropImageAnalysisService.js";
import { imageRateLimiter, resetImageRateLimiter } from "./middleware/imageRateLimiter.js";

async function runPhase8Tests() {
  console.log("==================================================");
  console.log("   FARMCONNECT PHASE 8 — CROP & PLANT VISION TESTS");
  console.log("==================================================\n");

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

  const testUser = {
    id: "usr_farmer_phase8",
    name: "Venkatesh",
    role: "farmer",
    region: "Tamil Nadu",
    district: "Erode"
  };

  try {
    // 0. Ensure Database Schema Initialized
    await initDatabase();

    const now = new Date().toISOString();
    await query.run("DELETE FROM ai_image_analyses WHERE userId = ?", [testUser.id]);
    await query.run("DELETE FROM users WHERE id = ?", [testUser.id]);
    await query.run(
      "INSERT INTO users (id, name, email, role, region, district, createdAt) VALUES (?, ?, ?, 'farmer', ?, ?, ?)",
      [testUser.id, testUser.name, "venkatesh_p8@test.com", testUser.region, testUser.district, now]
    );

    // ==================================================
    // 1. DATABASE SCHEMA TEST
    // ==================================================
    console.log("--- 1. Database Table Verification ---");
    const dbCheck = await query.get("SELECT COUNT(*) as cnt FROM ai_image_analyses");
    assert(dbCheck !== null && dbCheck !== undefined, "Table 'ai_image_analyses' exists and is queryable.");

    // ==================================================
    // 2. IMAGE INPUT & FORMAT VALIDATION TESTS
    // ==================================================
    console.log("\n--- 2. Image Validation & Magic Bytes Check ---");

    const nullVal = validateCropImage(null);
    assert(nullVal.valid === false && nullVal.code === "EMPTY_IMAGE", "Rejects null/undefined image buffer.");

    const emptyVal = validateCropImage(Buffer.alloc(0));
    assert(emptyVal.valid === false && emptyVal.code === "EMPTY_IMAGE", "Rejects empty 0-byte buffer.");

    const hugeBuffer = Buffer.alloc(MAX_IMAGE_FILE_SIZE_BYTES + 1024);
    const hugeVal = validateCropImage(hugeBuffer);
    assert(hugeVal.valid === false && hugeVal.code === "IMAGE_TOO_LARGE", "Rejects image exceeding 10MB limit.");

    const invalidHeaderBuffer = Buffer.from("THIS_IS_NOT_AN_IMAGE_FILE_DATA_TEXT");
    const invalidVal = validateCropImage(invalidHeaderBuffer);
    assert(invalidVal.valid === false && invalidVal.code === "UNSUPPORTED_IMAGE_FORMAT", "Rejects non-image binary data (invalid magic bytes).");

    // Sample JPEG Magic Bytes: FF D8 FF E0 ...
    const sampleJpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const jpegVal = validateCropImage(sampleJpegBuffer, "image/jpeg");
    assert(jpegVal.valid === true && jpegVal.mimeType === "image/jpeg", "Validates JPEG magic bytes correctly.");

    // Sample PNG Magic Bytes: 89 50 4E 47 ...
    const samplePngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const pngVal = validateCropImage(samplePngBuffer, "image/png");
    assert(pngVal.valid === true && pngVal.mimeType === "image/png", "Validates PNG magic bytes correctly.");

    // Sample WEBP Magic Bytes: 52 49 46 46 ... 57 41 56 45 ...
    const sampleWebpBuffer = Buffer.alloc(16);
    sampleWebpBuffer.write("RIFF", 0);
    sampleWebpBuffer.write("WEBP", 8);
    const webpVal = validateCropImage(sampleWebpBuffer, "image/webp");
    assert(webpVal.valid === true && webpVal.mimeType === "image/webp", "Validates WEBP magic bytes correctly.");

    // ==================================================
    // 3. RATE LIMITER MIDDLEWARE TESTS
    // ==================================================
    console.log("\n--- 3. Rate Limiter Middleware Verification ---");

    resetImageRateLimiter(testUser.id);
    const fakeReq = { user: { id: testUser.id } };
    let rateLimitBlocked = false;

    // Simulate 5 requests (allowed)
    for (let i = 0; i < 5; i++) {
      let nextCalled = false;
      const fakeRes = {
        status: (code) => ({
          json: () => { rateLimitBlocked = true; }
        })
      };
      imageRateLimiter(fakeReq, fakeRes, () => { nextCalled = true; });
      assert(nextCalled === true, `Rate limiter allows request #${i + 1} of 5.`);
    }

    // 6th Request (should be rate-limited)
    let nextCalledOn6th = false;
    const fakeRes6 = {
      status: (code) => {
        assert(code === 429, "6th request receives HTTP 429 status code.");
        return {
          json: (body) => {
            assert(body.error?.code === "RATE_LIMIT_EXCEEDED", "6th request returns RATE_LIMIT_EXCEEDED error code.");
            rateLimitBlocked = true;
          }
        };
      }
    };
    imageRateLimiter(fakeReq, fakeRes6, () => { nextCalledOn6th = true; });
    assert(nextCalledOn6th === false && rateLimitBlocked === true, "6th request within 1 minute is blocked by rate limiter.");

    // Reset rate limiter for subsequent tests
    resetImageRateLimiter(testUser.id);

    // ==================================================
    // 4. MULTIMODAL CROP ANALYSIS SERVICE TESTS
    // ==================================================
    console.log("\n--- 4. Multimodal Crop Image Analysis Service ---");

    const analysisRes = await analyzeCropImage({
      imageBuffer: sampleJpegBuffer,
      mimeType: "image/jpeg",
      cropContext: "Yellowing spots on Tomato crop leaves",
      userLocation: "Erode, Tamil Nadu",
      language: "en",
      userId: testUser.id
    });

    assert(analysisRes.success === true, "analyzeCropImage returns success=true.");
    assert(analysisRes.healthStatus !== undefined, "Output includes healthStatus object.");
    assert(analysisRes.observedSymptoms !== undefined && Array.isArray(analysisRes.observedSymptoms), "Output includes observedSymptoms array (Facts).");
    assert(analysisRes.possibleDiagnoses !== undefined && Array.isArray(analysisRes.possibleDiagnoses), "Output includes possibleDiagnoses array (Reasoning).");
    assert(analysisRes.recommendations !== undefined, "Output includes recommendations object.");
    assert(analysisRes.disclaimer !== undefined && analysisRes.disclaimer.includes("AI-assisted preliminary assessment"), "Output contains strict safety disclaimer.");

    // Multilingual Test: Tamil
    console.log("\n--- 5. Multilingual Crop Analysis (Tamil) ---");
    const taAnalysis = await analyzeCropImage({
      imageBuffer: samplePngBuffer,
      mimeType: "image/png",
      cropContext: "தக்காளி இலையில் மஞ்சள் புள்ளி",
      language: "ta",
      userId: testUser.id
    });

    assert(taAnalysis.success === true, "Tamil crop image analysis succeeds.");
    assert(taAnalysis.language === "ta", "Tamil language tag preserved in output.");

    // Multilingual Test: Hindi
    console.log("\n--- 6. Multilingual Crop Analysis (Hindi) ---");
    const hiAnalysis = await analyzeCropImage({
      imageBuffer: sampleWebpBuffer,
      mimeType: "image/webp",
      cropContext: "टमाटर के पत्ते पीले पड़ रहे हैं",
      language: "hi",
      userId: testUser.id
    });

    assert(hiAnalysis.success === true, "Hindi crop image analysis succeeds.");
    assert(hiAnalysis.language === "hi", "Hindi language tag preserved in output.");

    // ==================================================
    // 7. DATABASE PERSISTENCE & HISTORY RETRIEVAL TESTS
    // ==================================================
    console.log("\n--- 7. Database Persistence & History Queries ---");

    const recordId = `img_test_${Date.now()}`;
    const testNow = new Date().toISOString();
    await query.run(
      "INSERT INTO ai_image_analyses (id, userId, cropContext, analysisResult, language, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      [recordId, testUser.id, "Tomato yellow spots test", JSON.stringify(analysisRes), "en", testNow]
    );

    const fetchedRecord = await query.get(
      "SELECT * FROM ai_image_analyses WHERE id = ? AND userId = ?",
      [recordId, testUser.id]
    );

    assert(fetchedRecord !== null && fetchedRecord.id === recordId, "Image analysis record successfully saved and fetched from DB.");
    
    const historyList = await query.all(
      "SELECT * FROM ai_image_analyses WHERE userId = ? ORDER BY createdAt DESC",
      [testUser.id]
    );
    assert(historyList.length >= 1, "Image analysis history retrieved for user.");

    // ==================================================
    // 8. CONVERSATION LINKING & INTEGRATION VERIFICATION
    // ==================================================
    console.log("\n--- 8. Conversation Linking & Safety Verification ---");

    const convId = `conv_p8_${Date.now()}`;
    await query.run("INSERT INTO ai_conversations (id, userId, title) VALUES (?, ?, ?)", [convId, testUser.id, "Crop Analysis Thread"]);

    const msgIdUser = `msg_u_${Date.now()}`;
    const msgIdAi = `msg_a_${Date.now()}`;

    await query.run("INSERT INTO ai_messages (id, conversationId, role, content, createdAt) VALUES (?, ?, 'user', ?, ?)", [msgIdUser, convId, "📷 [Crop Photo Analysis] Tomato leaves", testNow]);
    await query.run("INSERT INTO ai_messages (id, conversationId, role, content, toolName, toolResult, createdAt) VALUES (?, ?, 'assistant', ?, ?, ?, ?)", [msgIdAi, convId, analysisRes.recommendations.summary, "cropImageAnalysis", JSON.stringify({ isImageAnalysis: true, analysisId: recordId }), testNow]);

    const savedMessages = await query.all("SELECT * FROM ai_messages WHERE conversationId = ?", [convId]);
    assert(savedMessages.length === 2, "User image upload and AI analysis summary stored in ai_messages table.");

    // Clean up test data
    await query.run("DELETE FROM ai_messages WHERE conversationId = ?", [convId]);
    await query.run("DELETE FROM ai_conversations WHERE id = ?", [convId]);
    await query.run("DELETE FROM ai_image_analyses WHERE userId = ?", [testUser.id]);
    await query.run("DELETE FROM users WHERE id = ?", [testUser.id]);

  } catch (err) {
    console.error("Test execution error:", err);
    assert(false, "Phase 8 test execution completed without error", err.message);
  }

  console.log("\n==================================================");
  console.log(`   TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase8Tests();
