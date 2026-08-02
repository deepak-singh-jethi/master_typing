import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

function versionParts(version) {
  return String(version)
    .replace(/^[^0-9]*/, "")
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isAtLeast(actual, minimum) {
  const actualParts = versionParts(actual);
  const minimumParts = versionParts(minimum);

  for (let index = 0; index < 3; index += 1) {
    if (actualParts[index] > minimumParts[index]) return true;
    if (actualParts[index] < minimumParts[index]) return false;
  }

  return true;
}

test("React Router stays on the reviewed temporary-exception baseline", () => {
  const version = packageJson.dependencies?.["react-router-dom"];
  assert.ok(version, "react-router-dom must remain a direct dependency");
  assert.equal(version, "7.18.2");
  assert.ok(isAtLeast(version, "7.18.2"));
});
