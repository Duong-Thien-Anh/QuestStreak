/**
 * test-demo-login.mjs
 *
 * Quick smoke-test for POST /api/auth/demo endpoint.
 *
 * Usage (Node 18+):
 *   node scripts/test-demo-login.mjs
 *
 * Or with a custom base URL:
 *   BASE_URL=https://your-render-app.onrender.com node scripts/test-demo-login.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/auth/demo`;

const DEMO_USERS = ["demo_dom_1", "demo_sub_1", "demo_admin"];

// ANSI colors
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition, label, detail = "") {
  if (condition) {
    console.log(green("  ✓"), label);
    passed++;
  } else {
    console.log(red("  ✗"), label, detail ? red(`(${detail})`) : "");
    failed++;
  }
}

async function postDemo(username) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  let body;
  try { body = await res.json(); } catch { body = {}; }
  return { status: res.status, headers: res.headers, body };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log(bold(`\n🧪  Demo Login Endpoint Tests`));
console.log(`   Target: ${yellow(ENDPOINT)}\n`);

// ── 1. Happy path: each demo user ────────────────────────────────────────────
for (const username of DEMO_USERS) {
  console.log(bold(`[Test] POST with username="${username}"`));

  const { status, headers, body } = await postDemo(username);

  assert(status === 200,        `HTTP 200 OK`,             `got ${status}`);
  assert(body?.ok === true,     `body.ok === true`,        JSON.stringify(body));
  assert(
    typeof body?.user?.id === "number",
    `body.user.id is a number`,
    JSON.stringify(body?.user),
  );
  assert(
    body?.user?.unionId?.startsWith("demo:"),
    `body.user.unionId starts with "demo:"`,
    body?.user?.unionId,
  );

  // Cookie check
  const setCookieHeader = headers.get("set-cookie") ?? "";
  assert(
    setCookieHeader.includes("kimi_sid"),
    `set-cookie contains "kimi_sid"`,
    setCookieHeader.slice(0, 80),
  );
  assert(
    setCookieHeader.toLowerCase().includes("httponly"),
    `cookie has HttpOnly flag`,
    setCookieHeader.slice(0, 80),
  );

  console.log();
}

// ── 2. 403 when DEMO_MODE is false (simulate by wrong username path) ──────────
// We can't toggle DEMO_MODE from here, so we test the "bad username" 400 path
// and document a manual curl test for the 403 case.
console.log(bold(`[Test] POST with invalid username`));
{
  const { status, body } = await postDemo("not_a_real_user");
  assert(status === 400, `HTTP 400 for unknown username`, `got ${status}`);
  assert(typeof body?.error === "string", `body.error is a string`, JSON.stringify(body));
  console.log();
}

// ── 3. Summary ────────────────────────────────────────────────────────────────
console.log(bold(`Results: ${green(`${passed} passed`)}, ${failed > 0 ? red(`${failed} failed`) : `0 failed`}`));

if (failed > 0) process.exit(1);

// ─── Manual curl commands (print for reference) ───────────────────────────────
console.log(`
${bold("── Manual curl commands ──────────────────────────────────────────")}

# Login as demo_dom_1:
curl -s -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo_dom_1"}' \\
  -c /tmp/demo-cookies.txt | jq .

# Login as demo_sub_1:
curl -s -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo_sub_1"}' \\
  -c /tmp/demo-cookies.txt | jq .

# Login as demo_admin:
curl -s -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo_admin"}' \\
  -c /tmp/demo-cookies.txt | jq .

# Test 403 — DEMO_MODE not enabled (run this with DEMO_MODE unset or false):
curl -s -o /dev/null -w "%{http_code}" -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"username":"demo_dom_1"}'
# Expected output: 403

${bold("── PowerShell equivalents (Windows) ─────────────────────────────")}

# Login as demo_dom_1:
Invoke-RestMethod -Uri "${ENDPOINT}" \`
  -Method POST \`
  -ContentType "application/json" \`
  -Body '{"username":"demo_dom_1"}' \`
  -SessionVariable demoSession

# Test 403 (run without DEMO_MODE=true):
try { Invoke-RestMethod -Uri "${ENDPOINT}" -Method POST \`
  -ContentType "application/json" -Body '{"username":"demo_dom_1"}' }
catch { $_.Exception.Response.StatusCode.value__ }
# Expected output: 403
`);
