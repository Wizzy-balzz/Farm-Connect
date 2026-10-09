import { spawnSync } from "child_process";

const suites = [
  { name: "Phase 1 — Core AI Agent", script: "backend/tests/test-phase1-agent.js" },
  { name: "Phase 2 — Agricultural Intelligence", script: "backend/tests/test-phase2-agent.js" },
  { name: "Phase 3 — Multilingual AI", script: "backend/tests/test-phase3-agent.js" },
  { name: "Phase 4 — Voice STT", script: "backend/tests/test-phase4-agent.js" },
  { name: "Phase 5 — Voice TTS", script: "backend/tests/test-phase5-agent.js" },
  { name: "Phase 6 — Action Proposal & Confirmation", script: "backend/tests/test-phase6-agent.js" },
  { name: "Phase 7 — Proactive Agricultural Insights", script: "backend/tests/test-phase7-agent.js" },
  { name: "Phase 8 — Crop Image & Plant Vision", script: "backend/tests/test-phase8-image-analysis.js" },
  { name: "Phase 9 — Marketplace & Selling Agent", script: "backend/tests/test-phase9-marketplace-agent.js" },
  { name: "Phase 10 — AI Reports & Advanced Analytics", script: "backend/tests/test-phase10-analytics.js" },
  { name: "Phase 11 — Personal Copilot & Agentic Workflows", script: "backend/tests/test-phase11-agent.js" },
  { name: "Phase 12 — Production Hardening & Security", script: "backend/tests/test-phase12-production.js" }
];

console.log("================================================================================");
console.log("             FARMCONNECT COMPLETE REGRESSION SUITE (PHASES 1 - 12)              ");
console.log("================================================================================\n");

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  process.stdout.write(`▶ Running ${suite.name} (${suite.script})... `);
  const start = Date.now();
  const res = spawnSync("node", [suite.script], {
    stdio: "pipe",
    encoding: "utf-8",
    env: process.env
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const out = (res.stdout || "") + "\n" + (res.stderr || "");

  // Match pass/fail patterns across varied test reporting styles
  const passMatch = out.match(/Passed:\s*(\d+)/i) || out.match(/(\d+)\s*(?:tests?\s*)?passed/i);
  const failMatch = out.match(/Failed:\s*(\d+)/i) || out.match(/(\d+)\s*(?:tests?\s*)?failed/i);

  const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
  let failed = failMatch ? parseInt(failMatch[1], 10) : (res.status !== 0 ? 1 : 0);

  // If process exited with non-zero status and failed count wasn't extracted, record failure
  if (res.status !== 0 && failed === 0) {
    failed = 1;
  }

  // Detect AI engine status (local Python NLP vs fallback)
  let apiStatus = "LOCAL_FALLBACK";
  if (out.includes("LIVE API ACTIVE") || out.includes("LOCAL_PYTHON_NLP") || out.includes("NLP_ONLINE")) {
    apiStatus = "LOCAL NLP ACTIVE";
  } else if (out.includes("FALLBACK USED") || out.includes("FALLBACK") || out.includes("PERMISSION_DENIED")) {
    apiStatus = "FALLBACK USED";
  }

  totalPassed += passed;
  totalFailed += failed;

  const statusNote = apiStatus !== "OFFLINE/MOCK" ? ` [${apiStatus}]` : "";

  if (failed === 0 && passed > 0) {
    console.log(`✅ [PASS] (${passed} passed in ${elapsed}s)${statusNote}`);
    results.push({ name: suite.name, status: "PASS", passed, failed, elapsed, apiStatus });
  } else {
    console.log(`❌ [FAIL] (${passed} passed, ${failed} failed in ${elapsed}s)${statusNote}`);
    results.push({ name: suite.name, status: "FAIL", passed, failed, elapsed, apiStatus });
    console.error(`\n--- Error log for ${suite.name} ---`);
    console.error(out.slice(-800));
    console.error(`----------------------------------\n`);
  }
}

console.log("\n=========================================================================================================");
console.log("                                    REGRESSION SUITE SUMMARY TABLE                                       ");
console.log("=========================================================================================================");
console.log("| Suite Name                                    | Status | Passed | Failed | Time  | AI Engine Status            |");
console.log("|-----------------------------------------------|--------|--------|--------|-------|-----------------------------|");
for (const r of results) {
  const nameCol = r.name.padEnd(45, " ");
  const statusCol = r.status.padEnd(6, " ");
  const passCol = String(r.passed).padStart(6, " ");
  const failCol = String(r.failed).padStart(6, " ");
  const timeCol = `${r.elapsed}s`.padStart(5, " ");
  const apiCol = (r.apiStatus || "N/A").padEnd(27, " ");
  console.log(`| ${nameCol} | ${statusCol} | ${passCol} | ${failCol} | ${timeCol} | ${apiCol} |`);
}
console.log("=========================================================================================================");
console.log(`TOTALS:  ✅ ${totalPassed} Passed  |  ❌ ${totalFailed} Failed  |  📊 ${totalPassed + totalFailed} Total Tests`);
console.log("=========================================================================================================\n");

if (totalFailed > 0) {
  console.error(`⚠️ Regression failed with ${totalFailed} failure(s).`);
  process.exit(1);
} else {
  console.log("🎉 ALL REGRESSION TESTS PASSED 100% CLEANLY!\n");
  process.exit(0);
}
