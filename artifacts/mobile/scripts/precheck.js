#!/usr/bin/env node
/**
 * Pre-build sanity check for EAS / local builds.
 *
 * Runs before the bundler touches any source so bad code is caught
 * immediately instead of at APK install time.
 *
 * Checks performed (in order):
 *  1. TypeScript compilation  — catches type errors AND syntax errors that
 *     Babel/Metro silently skips (e.g. `}ner.current?.remove();` at module scope)
 *  2. Default-export scan     — every file used as an Expo Router route or
 *     layout must export a React component as default
 *  3. Provider-order scan     — QueryClientProvider must not be nested inside
 *     a component that itself calls React Query hooks
 *  4. Hook integrity scan     — every `export function use*` must have
 *     balanced braces and end with `}` at column 0
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const HOOKS_DIR = path.join(ROOT, "hooks");
const CONTEXTS_DIR = path.join(ROOT, "contexts");

let passed = 0;
let failed = 0;

function pass(label) {
  console.log(`  \x1b[32m✓\x1b[0m  ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  \x1b[31m✗\x1b[0m  ${label}`);
  if (detail) console.error(`       ${detail.split("\n").join("\n       ")}`);
  failed++;
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TypeScript compilation
// ─────────────────────────────────────────────────────────────────────────────
section("1/4  TypeScript");

// Build workspace lib declarations first so the mobile tsconfig can resolve them.
// On EAS cloud this step is skipped gracefully if the workspace root isn't present.
const workspaceRoot = path.resolve(ROOT, "../..");
const libPath = path.resolve(workspaceRoot, "lib/api-client-react");
if (fs.existsSync(libPath) && fs.existsSync(path.join(workspaceRoot, "tsconfig.json"))) {
  const libResult = spawnSync("pnpm", ["run", "typecheck:libs"], {
    cwd: workspaceRoot,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (libResult.status !== 0) {
    fail("api-client-react lib declarations", libResult.stderr || libResult.stdout);
  } else {
    pass("api-client-react lib declarations up to date");
  }
} else {
  console.log("  ⚠  workspace root not found — skipping lib build (EAS cloud)");
}

const tscResult = spawnSync(
  "pnpm",
  ["exec", "tsc", "-p", "tsconfig.json", "--noEmit", "--pretty"],
  { cwd: ROOT, stdio: "pipe", encoding: "utf8" }
);

if (tscResult.status !== 0) {
  const output = (tscResult.stdout + tscResult.stderr).trim();
  // Count errors
  const errorCount = (output.match(/error TS/g) || []).length;
  fail(
    `TypeScript — ${errorCount} error${errorCount !== 1 ? "s" : ""}`,
    output.slice(0, 2000) + (output.length > 2000 ? "\n… (truncated)" : "")
  );
} else {
  pass("TypeScript — no errors");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Default-export scan (Expo Router routes & layouts)
// ─────────────────────────────────────────────────────────────────────────────
section("2/4  Default exports (Expo Router)");

function collectFiles(dir, exts = [".tsx", ".ts"]) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = collectFiles(APP_DIR, [".tsx", ".ts"]);
let missingDefaults = 0;

for (const file of routeFiles) {
  const source = fs.readFileSync(file, "utf8");
  // Must have a default export somewhere in the file
  const hasDefault =
    /export\s+default\s+(function|class|const|let|var|\(|[A-Z])/.test(source) ||
    /export\s+\{[^}]*\bdefault\b[^}]*\}/.test(source) ||
    /module\.exports\s*=/.test(source);

  if (!hasDefault) {
    fail(
      `Missing default export: ${path.relative(ROOT, file)}`,
      "Expo Router requires every route/layout file to have a default export."
    );
    missingDefaults++;
  }
}

if (missingDefaults === 0) {
  pass(`All ${routeFiles.length} route/layout files have default exports`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Provider order — detect QueryClient usage outside QueryClientProvider
// ─────────────────────────────────────────────────────────────────────────────
section("3/4  QueryClientProvider nesting");

const layoutFile = path.join(APP_DIR, "_layout.tsx");
if (fs.existsSync(layoutFile)) {
  const src = fs.readFileSync(layoutFile, "utf8");

  // Find the line where QueryClientProvider opens
  const lines = src.split("\n");
  const qcpLine = lines.findIndex((l) =>
    l.includes("<QueryClientProvider")
  );
  // Find any context providers that appear BEFORE it
  const suspectProviders = [];
  for (let i = 0; i < qcpLine; i++) {
    const m = lines[i].match(/<([A-Z][A-Za-z]+Provider)/);
    if (m && m[1] !== "SafeAreaProvider" && m[1] !== "ErrorBoundary") {
      // Check if that provider's implementation uses React Query hooks
      const providerName = m[1]; // e.g. "ConfigProvider"
      const providerFiles = [
        ...collectFiles(CONTEXTS_DIR),
        ...collectFiles(path.join(ROOT, "providers"), [".tsx", ".ts"]).catch
          ? []
          : collectFiles(path.join(ROOT, "providers")),
      ];
      for (const pf of providerFiles) {
        const pfSrc = fs.readFileSync(pf, "utf8");
        if (
          pfSrc.includes(`function ${providerName}`) &&
          (pfSrc.includes("useQuery") ||
            pfSrc.includes("useMutation") ||
            pfSrc.includes("useInfiniteQuery"))
        ) {
          suspectProviders.push(
            `${providerName} (${path.relative(ROOT, pf)}) uses React Query hooks but is rendered OUTSIDE <QueryClientProvider>`
          );
        }
      }
    }
  }

  if (suspectProviders.length > 0) {
    for (const s of suspectProviders) fail("Provider order issue", s);
  } else {
    pass("No React Query hooks used outside <QueryClientProvider>");
  }
} else {
  console.log("  ⚠  _layout.tsx not found — skipping provider order check");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hook file integrity — brace balance + no top-level statements after export
// ─────────────────────────────────────────────────────────────────────────────
section("4/4  Hook file integrity");

const hookFiles = [
  ...collectFiles(HOOKS_DIR),
  ...collectFiles(CONTEXTS_DIR),
];

let hookIssues = 0;

for (const file of hookFiles) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);

  // Check brace balance
  let depth = 0;
  let inString = false;
  let stringChar = "";
  for (let ci = 0; ci < source.length; ci++) {
    const ch = source[ci];
    if (inString) {
      if (ch === stringChar && source[ci - 1] !== "\\") inString = false;
    } else if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
    } else if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
    }
  }

  if (depth !== 0) {
    fail(
      `Unbalanced braces in ${rel}`,
      `Net brace depth at end of file: ${depth > 0 ? "+" : ""}${depth} (should be 0)`
    );
    hookIssues++;
    continue;
  }

  // Check for statements appearing after the last closing `}` at column 0
  // (i.e., code that runs at module scope after all exports are closed)
  const afterLastExport = source.replace(
    /^(import|export|const|let|var|type|interface|\/\/|\/\*|\s*$)/gm,
    ""
  );
  // Look for identifiers followed by `.` at the start of a line — these are
  // likely dangling property access statements at module scope
  const danglingMatch = source.match(/^[a-z][A-Za-z]+\.[a-z]/m);
  if (danglingMatch) {
    fail(
      `Possible dangling statement at module scope in ${rel}`,
      `Found: \`${danglingMatch[0].trim()}…\` — this runs at import time and will crash.`
    );
    hookIssues++;
  } else {
    pass(`${rel}`);
  }
}

if (hookIssues === 0 && hookFiles.length > 0) {
  // Already printed individual passes above
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(
  `\n${"─".repeat(50)}\n` +
  `  Pre-check complete: \x1b[32m${passed} passed\x1b[0m` +
  (failed > 0 ? `, \x1b[31m${failed} failed\x1b[0m` : "") +
  "\n"
);

if (failed > 0) {
  console.error(
    "\x1b[31mBuild aborted.\x1b[0m Fix the issues above before triggering an EAS build.\n"
  );
  process.exit(1);
}

console.log("\x1b[32mAll checks passed — safe to build.\x1b[0m\n");
process.exit(0);
