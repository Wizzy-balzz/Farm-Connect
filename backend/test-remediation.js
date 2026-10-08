import { signJwt } from "./utils/security.js";
import { prepareActionProposal, confirmAction } from "./ai/aiActions.js";
import { query } from "./database.js";
import assert from "assert";

async function verifyEdgeCases() {
  console.log("==================================================");
  console.log("   DEEP EDGE-CASE VERIFICATION FOR REMEDIATIONS   ");
  console.log("==================================================\n");

  const farmerId = "f1";
  const otherFarmerId = "f2";
  const farmerToken = signJwt({ id: farmerId, email: "farmer@farmconnect.com", role: "farmer" });
  const otherToken = signJwt({ id: otherFarmerId, email: "satish@farmconnect.com", role: "farmer" });

  // ---------------------------------------------------------------------------
  // DEF-AI-01 VERIFICATIONS
  // ---------------------------------------------------------------------------
  console.log("--- DEF-AI-01: Edge Cases ---");

  // 1. Invalid / Non-existent token -> 404
  const resInvalid = await fetch("http://127.0.0.1:5000/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerToken}` },
    body: JSON.stringify({ confirmationToken: "completely_bogus_token_404" })
  });
  const jsonInvalid = await resInvalid.json();
  assert.strictEqual(resInvalid.status, 404, "Invalid token must return 404");
  assert.strictEqual(jsonInvalid.error?.code, "ACTION_NOT_FOUND");
  console.log("✓ 1. Invalid token returns 404 ACTION_NOT_FOUND");

  // 2. Prepare a valid action proposal for price update
  const prodId = "prod_remediation_test";
  await query.run("DELETE FROM products WHERE id = ?", [prodId]);
  await query.run(
    `INSERT INTO products (id, name, category, price, unit, stock, farmerId, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [prodId, "Remediation Crop", "Vegetables", 50.0, "kg", 100, farmerId, new Date().toISOString()]
  );

  const proposal = await prepareActionProposal(
    { id: farmerId, role: "farmer" },
    "UPDATE_PRODUCT_PRICE",
    { productId: prodId, newPrice: 55.0 }
  );
  assert(proposal.success, "Proposal preparation should succeed");
  const validToken = proposal.action?.confirmationToken || proposal.confirmationToken;
  assert(validToken, "Valid token must be present");

  // 3. Wrong-user attempt to confirm -> 403 OWNERSHIP_VIOLATION
  const resWrongUser = await fetch("http://127.0.0.1:5000/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${otherToken}` },
    body: JSON.stringify({ confirmationToken: validToken })
  });
  const jsonWrongUser = await resWrongUser.json();
  assert.strictEqual(resWrongUser.status, 403, "Wrong user must return 403");
  assert.strictEqual(jsonWrongUser.error?.code, "OWNERSHIP_VIOLATION");
  console.log("✓ 2. Wrong-user confirmation blocked with 403 OWNERSHIP_VIOLATION");

  // 4. Valid confirmation by authorized owner -> 200 SUCCESS
  const resValid = await fetch("http://127.0.0.1:5000/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerToken}` },
    body: JSON.stringify({ confirmationToken: validToken })
  });
  const jsonValid = await resValid.json();
  assert.strictEqual(resValid.status, 200, "Valid confirmation must return 200");
  assert.strictEqual(jsonValid.success, true);
  console.log("✓ 3. Valid confirmation executes successfully (HTTP 200)");

  // Verify DB state updated
  const updatedProd = await query.get("SELECT price FROM products WHERE id = ?", [prodId]);
  assert.strictEqual(parseFloat(updatedProd.price), 55.0, "Product price must be updated in MySQL");

  // 5. Duplicate confirmation / Replay -> 400 ALREADY_PROCESSED
  const resDuplicate = await fetch("http://127.0.0.1:5000/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerToken}` },
    body: JSON.stringify({ confirmationToken: validToken })
  });
  const jsonDuplicate = await resDuplicate.json();
  assert.strictEqual(resDuplicate.status, 400, "Duplicate confirmation must return 400");
  assert.strictEqual(jsonDuplicate.error?.code, "ACTION_ALREADY_PROCESSED");
  console.log("✓ 4. Replay confirmation blocked with 400 ACTION_ALREADY_PROCESSED");

  // 6. Expired token -> 400 ACTION_EXPIRED
  const proposalExpired = await prepareActionProposal(
    { id: farmerId, role: "farmer" },
    "UPDATE_PRODUCT_PRICE",
    { productId: prodId, newPrice: 60.0 }
  );
  const expiredToken = proposalExpired.action?.confirmationToken || proposalExpired.confirmationToken;
  const pendingActionId = proposalExpired.action?.pendingId;
  await query.run("UPDATE ai_pending_actions SET expiresAt = ? WHERE id = ?", [Date.now() - 10000, pendingActionId]);

  const resExpired = await fetch("http://127.0.0.1:5000/api/ai/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${farmerToken}` },
    body: JSON.stringify({ confirmationToken: expiredToken })
  });
  const jsonExpired = await resExpired.json();
  assert.strictEqual(resExpired.status, 400, "Expired token must return 400");
  assert.strictEqual(jsonExpired.error?.code, "ACTION_EXPIRED");
  console.log("✓ 5. Expired token blocked with 400 ACTION_EXPIRED");

  // Clean up fixture
  await query.run("DELETE FROM products WHERE id = ?", [prodId]);

  // ---------------------------------------------------------------------------
  // DEF-AI-02 VERIFICATIONS
  // ---------------------------------------------------------------------------
  console.log("\n--- DEF-AI-02: Edge Cases ---");
  const boundary = "----WebKitFormBoundaryEdgeTest";

  // Helper to send multipart image upload
  async function uploadImage(buffer, mimeType = "image/jpeg", filename = "crop.jpg") {
    let multipart = `--${boundary}\r\n`;
    multipart += `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n`;
    multipart += `Content-Type: ${mimeType}\r\n\r\n`;
    const headerBuf = Buffer.from(multipart, "binary");
    const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`, "binary");
    const fullBody = Buffer.concat([headerBuf, buffer, footerBuf]);

    return fetch("http://127.0.0.1:5000/api/ai/image-analysis", {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        Authorization: `Bearer ${farmerToken}`
      },
      body: fullBody
    });
  }

  // 1. Invalid Magic Bytes (text disguised as JPEG) -> 400 INVALID_IMAGE_DATA
  const fakeBytes = Buffer.from("NOT_JPEG_HEADER_DISGUISED_AS_IMAGE");
  const resBadBytes = await uploadImage(fakeBytes, "image/jpeg", "disguised.jpg");
  const jsonBadBytes = await resBadBytes.json();
  assert.strictEqual(resBadBytes.status, 400, "Corrupted magic bytes must return 400");
  assert.strictEqual(jsonBadBytes.error?.code, "INVALID_IMAGE_DATA");
  console.log("✓ 1. Spoofed magic bytes rejected with 400 INVALID_IMAGE_DATA");

  // 2. Unsupported file type (text/plain) -> 400 UNSUPPORTED_IMAGE_FORMAT
  const resUnsupported = await uploadImage(Buffer.from("Hello world"), "text/plain", "doc.txt");
  const jsonUnsupported = await resUnsupported.json();
  assert.strictEqual(resUnsupported.status, 400, "Unsupported MIME must return 400");
  assert.strictEqual(jsonUnsupported.error?.code, "UNSUPPORTED_IMAGE_FORMAT");
  console.log("✓ 2. Unsupported MIME type rejected with 400 UNSUPPORTED_IMAGE_FORMAT");

  // 3. Oversized file (> 10MB) -> 400 IMAGE_TOO_LARGE
  const oversizedBuf = Buffer.alloc(10 * 1024 * 1024 + 1024, 0); // 10MB + 1KB
  const resOversized = await uploadImage(oversizedBuf, "image/jpeg", "huge.jpg");
  const jsonOversized = await resOversized.json();
  assert.strictEqual(resOversized.status, 400, "Oversized image must return 400");
  assert.strictEqual(jsonOversized.error?.code, "IMAGE_TOO_LARGE");
  console.log("✓ 3. Oversized image (>10MB) rejected with 400 IMAGE_TOO_LARGE");

  // 4. Valid JPEG header (minimal 1x1 pixel JPEG) -> 200 OK
  // Minimal valid 1x1 JPEG: FF D8 FF E0 ... FF D9
  const minimalJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
    0x00, 0xBF, 0x00, 0xFF, 0xD9
  ]);

  const resValidImage = await uploadImage(minimalJpeg, "image/jpeg", "healthy_leaf.jpg");
  const jsonValidImage = await resValidImage.json();
  assert.strictEqual(resValidImage.status, 200, "Valid JPEG must return HTTP 200");
  assert.strictEqual(jsonValidImage.success, true);
  console.log("✓ 4. Valid image passes analysis (HTTP 200 with structured health report)");

  console.log("\n==================================================");
  console.log("   ALL EDGE CASES PASSED VERIFICATION 100%!       ");
  console.log("==================================================");
  process.exit(0);
}

verifyEdgeCases().catch(err => {
  console.error("Edge case verification error:", err);
  process.exit(1);
});
