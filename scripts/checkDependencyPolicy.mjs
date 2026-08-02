import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const exception = {
  advisory: "GHSA-qwww-vcr4-c8h2",
  packages: new Set(["react-router", "react-router-dom"]),
  exactVersion: "7.18.2",
  expires: "2026-09-01",
};

const result = spawnSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8" });
let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error("Dependency audit did not return valid JSON.");
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const routerVersionMatches = manifest.dependencies?.["react-router-dom"] === exception.exactVersion;
const violations = [];
for (const [name, finding] of Object.entries(report.vulnerabilities || {})) {
  if (!["high", "critical"].includes(finding.severity)) continue;
  const advisories = (finding.via || []).filter((item) => typeof item === "object");
  const inheritedRouterFinding = name === "react-router-dom" && (finding.via || []).every((item) => item === "react-router");
  const allowed = routerVersionMatches
    && exception.packages.has(name)
    && (inheritedRouterFinding || (advisories.length > 0
      && advisories.every((item) => String(item.url || "").endsWith(exception.advisory))))
    && today <= exception.expires;
  if (!allowed) violations.push(`${name}: ${finding.severity}`);
}

const installed = report.metadata?.dependencies ? true : false;
if (!installed) violations.push("audit metadata missing");
if (violations.length) {
  console.error(`Unapproved dependency findings: ${violations.join(", ")}`);
  process.exit(1);
}

console.log(`Dependency policy passed. Temporary ${exception.advisory} exception expires ${exception.expires}.`);
