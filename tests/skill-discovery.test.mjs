import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function createSkill(root, skillName) {
  const skillDir = join(root, skillName);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: ${skillName} description\n---\n\n# ${skillName}\n`,
    "utf8",
  );
}

function writePackageJson(packageDir, skillPaths) {
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0", pi: { skills: skillPaths } }, null, 2),
    "utf8",
  );
}

function writeSettings(settingsPath, settings) {
  mkdirSync(join(settingsPath, ".."), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
}

async function loadExtension(homeDir) {
  process.env.USERPROFILE = homeDir;
  process.env.HOME = homeDir;
  process.env.USER = "skill-discovery-test";

  const moduleUrl = new URL(`../src/index.ts?case=${Date.now()}-${Math.random()}`, import.meta.url);
  return import(moduleUrl.href);
}

async function callSkill(extension, skillName, cwd) {
  let skillTool;
  const pi = {
    registerTool(tool) {
      if (tool.name === "Skill") skillTool = tool;
    },
    registerCommand() {},
    on() {},
  };

  extension.default(pi);
  assert.ok(skillTool, "Skill tool should be registered");
  return skillTool.execute("test-call", { skill: skillName }, undefined, undefined, { cwd });
}

const tempRoot = mkdtempSync(join(tmpdir(), "pi-superpowers-support-skill-discovery-"));

try {
  const npmNodeModules = join(tempRoot, ".pi", "agent", "npm", "node_modules");

  const unscopedPackage = join(npmNodeModules, "unscoped-skills-package");
  mkdirSync(join(unscopedPackage, "skills"), { recursive: true });
  writePackageJson(unscopedPackage, ["./skills"]);
  createSkill(join(unscopedPackage, "skills"), "unscoped-npm-skill");

  const scopedPackage = join(npmNodeModules, "@scope", "scoped-skills-package");
  mkdirSync(join(scopedPackage, "skills"), { recursive: true });
  writePackageJson(scopedPackage, ["./skills"]);
  createSkill(join(scopedPackage, "skills"), "scoped-npm-skill");

  const hiddenPackage = join(npmNodeModules, "hidden-package");
  mkdirSync(join(hiddenPackage, "nested", "skills"), { recursive: true });
  writePackageJson(hiddenPackage, []);
  createSkill(join(hiddenPackage, "nested", "skills"), "hidden-recursive-npm-skill");

  const cwd = join(tempRoot, "project");
  mkdirSync(cwd, { recursive: true });

  const globalLocalPackage = join(tempRoot, "global-local-package");
  mkdirSync(join(globalLocalPackage, "skills"), { recursive: true });
  writePackageJson(globalLocalPackage, ["./skills"]);
  createSkill(join(globalLocalPackage, "skills"), "global-settings-local-skill");

  writeSettings(join(tempRoot, ".pi", "agent", "settings.json"), {
    packages: [globalLocalPackage],
  });

  const projectLocalPackage = join(tempRoot, "project-local-package");
  mkdirSync(join(projectLocalPackage, "skills"), { recursive: true });
  writePackageJson(projectLocalPackage, ["./skills"]);
  createSkill(join(projectLocalPackage, "skills"), "project-settings-local-skill");

  const ignoredNonLocalPackage = join(tempRoot, "ignored-non-local-package");
  mkdirSync(join(ignoredNonLocalPackage, "skills"), { recursive: true });
  writePackageJson(ignoredNonLocalPackage, ["./skills"]);
  createSkill(join(ignoredNonLocalPackage, "skills"), "ignored-non-local-settings-skill");

  writeSettings(join(cwd, ".pi", "settings.json"), {
    packages: [
      { source: projectLocalPackage },
      "npm:ignored-non-local-package",
      { source: "https://example.com/ignored-non-local-package.git", skills: [ignoredNonLocalPackage] },
    ],
  });

  const extension = await loadExtension(tempRoot);

  const unscopedResult = await callSkill(extension, "unscoped-npm-skill", cwd);
  assert.equal(unscopedResult.isError, undefined, "unscoped npm package skill should load");
  assert.equal(unscopedResult.details.skillName, "unscoped-npm-skill");

  const scopedResult = await callSkill(extension, "scoped-npm-skill", cwd);
  assert.equal(scopedResult.isError, undefined, "scoped npm package skill should load");
  assert.equal(scopedResult.details.skillName, "scoped-npm-skill");

  const hiddenResult = await callSkill(extension, "hidden-recursive-npm-skill", cwd);
  assert.equal(hiddenResult.isError, true, "npm discovery should only follow package pi.skills paths");

  const globalLocalResult = await callSkill(extension, "global-settings-local-skill", cwd);
  assert.equal(globalLocalResult.isError, undefined, "global settings local package skill should load");
  assert.equal(globalLocalResult.details.skillName, "global-settings-local-skill");

  const projectLocalResult = await callSkill(extension, "project-settings-local-skill", cwd);
  assert.equal(projectLocalResult.isError, undefined, "project settings local package skill should load");
  assert.equal(projectLocalResult.details.skillName, "project-settings-local-skill");

  const ignoredNonLocalResult = await callSkill(extension, "ignored-non-local-settings-skill", cwd);
  assert.equal(ignoredNonLocalResult.isError, true, "non-local settings sources should not be scanned as local package paths");

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

  console.log("skill discovery tests passed");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
