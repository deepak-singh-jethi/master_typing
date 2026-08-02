import { readFile } from "node:fs/promises";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
const forbidden = /(^|[^A-Z])(AGPL|GPL)(-|$)/i;
const failures = [];

for (const [packagePath, packageInfo] of Object.entries(lock.packages || {})) {
  if (!packagePath.startsWith("node_modules/")) continue;
  if (packageInfo.dev) continue;
  try {
    const manifest = JSON.parse(await readFile(new URL(`../${packagePath}/package.json`, import.meta.url), "utf8"));
    const license = typeof manifest.license === "string" ? manifest.license : "";
    if (forbidden.test(license) && !/LGPL/i.test(license)) failures.push(`${manifest.name}@${manifest.version}: ${license}`);
  } catch {
    // Optional platform packages may not be installed on this operating system.
  }
}

if (failures.length) {
  console.error(`Forbidden production licenses found:\n${failures.join("\n")}`);
  process.exit(1);
}
console.log("License policy passed: no installed GPL/AGPL production blockers found.");
