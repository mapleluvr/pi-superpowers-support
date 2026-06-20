import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const files = [
  "src/index.ts",
  "README.md",
  "package.json",
];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  assert.equal(/registerTaskTool|name:\s*["']Task["']|\bTask\s*\(/.test(content), false, `${file} must not define or document a Task tool`);
}

assert.equal(existsSync("src/task-mapping.js"), false, "Task mapping helper must be removed");
assert.equal(existsSync("src/task-mapping.d.ts"), false, "Task mapping declarations must be removed");

console.log("no-task-tool tests passed");
