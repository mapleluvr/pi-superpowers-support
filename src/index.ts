/**
 * pi-superpowers-support — A pi extension providing TodoWrite and Skill tools
 * for official superpowers (obra/superpowers) compatibility on Pi.
 *
 * Tools:
 *   TodoWrite  — Task tracking with status (pending, in_progress, completed)
 *   Skill      — Load skill content by name (for harnesses/workflows that expect a Skill tool)
 *
 * Commands:
 *   /todos     — Show current todos
 *   /todo-clear — Clear all todos
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type, type Static } from "typebox";

// ============================================================================
// Types
// ============================================================================

type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority?: "high" | "medium" | "low";
}

interface SkillMeta {
  name: string;
  description?: string;
  path: string;
}

// ============================================================================
// TodoWrite Tool
// ============================================================================

const TodoWriteSchema = Type.Object({
  todos: Type.Array(Type.Object({
    id: Type.String({ description: "Unique identifier for the todo item" }),
    content: Type.String({ description: "The content/description of the todo item" }),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("in_progress"),
      Type.Literal("completed"),
    ], { description: "Status of the todo item" }),
    priority: Type.Optional(Type.Union([
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ], { description: "Priority level (optional)" })),
  })),
});

type TodoWriteInput = Static<typeof TodoWriteSchema>;

let todos: TodoItem[] = [];

function formatTodos(): string {
  if (todos.length === 0) return "No todos. Use TodoWrite to create tasks.";

  const statusIcon = (s: TodoStatus) => {
    switch (s) {
      case "completed": return "✅";
      case "in_progress": return "🔄";
      case "pending": return "⭕";
    }
  };

  const priorityLabel = (p?: "high" | "medium" | "low") => p ? `[${p.toUpperCase()}] ` : "";

  // Pad ID for alignment when there are 10+ items
  const idWidth = todos.length >= 10 ? 2 : 1;

  const lines = todos.map((t, i) => `${String(i + 1).padStart(idWidth)}. ${statusIcon(t.status)} ${priorityLabel(t.priority)}${t.content}`);
  const completed = todos.filter(t => t.status === "completed").length;

  return `Todos (${completed}/${todos.length} completed):\n${lines.join("\n")}`;
}

function registerTodoWriteTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "TodoWrite",
    label: "TodoWrite",
    description: "Create, update, or replace the todo list for tracking task progress. Use this to track implementation tasks from plans.",
    promptSnippet: "Track tasks with status (pending, in_progress, completed)",
    promptGuidelines: [
      "Use TodoWrite when starting a multi-step task to track progress.",
      "Update todo status as you work through tasks: mark in_progress when starting, completed when done.",
    ],
    parameters: TodoWriteSchema,
    async execute(_toolCallId, params: TodoWriteInput) {
      todos = params.todos.map(t => ({
        id: t.id,
        content: t.content,
        status: t.status,
        priority: t.priority,
      }));
      return {
        content: [{ type: "text", text: formatTodos() }],
        details: { todoCount: todos.length },
      };
    },
  });
}

// ============================================================================
// Skill Tool
// ============================================================================

const SkillSchema = Type.Object({
  skill: Type.String({ description: "Name of the skill to load (e.g., 'brainstorming', 'test-driven-development')" }),
});

type SkillInput = Static<typeof SkillSchema>;

let skillCache: Map<string, SkillMeta> | null = null;

function discoverSkills(cwd: string): Map<string, SkillMeta> {
  if (skillCache) return skillCache;

  const skills = new Map<string, SkillMeta>();
  const home = homedir();

  const skillPaths = [
    join(home, ".pi", "agent", "skills"),
    join(home, ".agents", "skills"),
    join(cwd, ".pi", "skills"),
    join(cwd, ".agents", "skills"),
  ];

  // Recursively find skills directories under ~/.pi/agent/git/
  const gitPackagesDir = join(home, ".pi", "agent", "git");
  if (existsSync(gitPackagesDir)) {
    findSkillsDirs(gitPackagesDir, skillPaths);
  }

  const npmNodeModulesDir = join(home, ".pi", "agent", "npm", "node_modules");
  if (existsSync(npmNodeModulesDir)) {
    findNpmPackageSkillDirs(npmNodeModulesDir, skillPaths);
  }

  for (const basePath of skillPaths) {
    if (!existsSync(basePath)) continue;
    try {
      const skillDirs = readdirSync(basePath, { withFileTypes: true });
      for (const skillDir of skillDirs) {
        if (!skillDir.isDirectory()) continue;
        const skillFile = join(basePath, skillDir.name, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        try {
          const content = readFileSync(skillFile, "utf-8");
          const meta = parseSkillFrontmatter(content, skillFile);
          if (meta?.name && !skills.has(meta.name)) {
            skills.set(meta.name, meta);
          }
        } catch (error) {
          console.error(`[pi-superpowers-support] Failed to parse skill ${skillFile}:`, error);
        }
      }
    } catch (error) {
      console.error(`[pi-superpowers-support] Failed to read skills directory ${basePath}:`, error);
    }
  }

  skillCache = skills;
  return skills;
}

/** Recursively find all directories named "skills" under a base path */
function findSkillsDirs(basePath: string, results: string[], depth = 0): void {
  // Limit recursion depth to avoid infinite loops
  if (depth > 10) return;
  
  try {
    const entries = readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const fullPath = join(basePath, entry.name);
      
      if (entry.name === "skills") {
        results.push(fullPath);
      } else {
        // Recurse into subdirectories
        findSkillsDirs(fullPath, results, depth + 1);
      }
    }
  } catch (error) {
    // Ignore permission errors, etc. - these are expected for some directories
    if (depth === 0) {
      console.error(`[pi-superpowers-support] Error scanning ${basePath}:`, error);
    }
  }
}

/** Find manifest-declared skill directories in npm packages installed by Pi */
function findNpmPackageSkillDirs(nodeModulesPath: string, results: string[]): void {
  try {
    const entries = readdirSync(nodeModulesPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const packagePath = join(nodeModulesPath, entry.name);
      if (entry.name.startsWith("@")) {
        findScopedNpmPackageSkillDirs(packagePath, results);
      } else {
        addNpmPackageSkillDirs(packagePath, results);
      }
    }
  } catch (error) {
    console.error(`[pi-superpowers-support] Failed to read npm packages directory ${nodeModulesPath}:`, error);
  }
}

function findScopedNpmPackageSkillDirs(scopePath: string, results: string[]): void {
  try {
    const packages = readdirSync(scopePath, { withFileTypes: true });
    for (const packageEntry of packages) {
      if (!packageEntry.isDirectory()) continue;
      addNpmPackageSkillDirs(join(scopePath, packageEntry.name), results);
    }
  } catch (error) {
    console.error(`[pi-superpowers-support] Failed to read scoped npm packages directory ${scopePath}:`, error);
  }
}

function addNpmPackageSkillDirs(packagePath: string, results: string[]): void {
  const packageJsonPath = join(packagePath, "package.json");
  if (!existsSync(packageJsonPath)) return;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as { pi?: { skills?: unknown } };
    const skillPaths = packageJson.pi?.skills;
    if (!Array.isArray(skillPaths)) return;

    for (const skillPath of skillPaths) {
      if (typeof skillPath !== "string") continue;
      const resolvedSkillPath = resolve(packagePath, skillPath);
      if (isPathInside(packagePath, resolvedSkillPath)) {
        results.push(resolvedSkillPath);
      }
    }
  } catch (error) {
    console.error(`[pi-superpowers-support] Failed to read npm package skills from ${packageJsonPath}:`, error);
  }
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const normalizedParent = resolve(parentPath);
  const normalizedChild = resolve(childPath);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}\\`) || normalizedChild.startsWith(`${normalizedParent}/`);
}

function parseSkillFrontmatter(content: string, path: string): SkillMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  // Use cross-platform path handling - get parent directory name as default skill name
  const skillDir = path.replace(/[\\/]SKILL\.md$/, '');
  const meta: SkillMeta = { name: basename(skillDir), path };

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key === "name") meta.name = value;
      if (key === "description") meta.description = value;
    }
  }

  return meta;
}

/** Extract skill content, stripping frontmatter if present */
function extractSkillContent(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content;
}

/** Read and parse a skill file, returning content without frontmatter */
function readSkillContent(skillPath: string): string | null {
  try {
    const content = readFileSync(skillPath, "utf-8");
    return extractSkillContent(content);
  } catch (error) {
    console.error(`[pi-superpowers-support] Failed to read skill file ${skillPath}:`, error);
    return null;
  }
}

function registerSkillTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "Skill",
    label: "Skill",
    description: "Load and invoke a skill by name. Skills provide specialized instructions for specific tasks like TDD, debugging, or brainstorming. IMPORTANT: Use this tool instead of read for skill files.",
    promptSnippet: "Load specialized skill instructions for specific workflows",
    promptGuidelines: [
      "Use Skill tool to load skill instructions before starting a task that matches the skill's description.",
      "Common skills: brainstorming, test-driven-development, systematic-debugging, writing-plans.",
      "IMPORTANT: Always use Skill tool to load skills, never use read tool on skill files.",
    ],
    parameters: SkillSchema,
    async execute(_toolCallId, params: SkillInput, _signal, _onUpdate, ctx) {
      const skills = discoverSkills(ctx.cwd);
      const skill = skills.get(params.skill);

      if (!skill) {
        const availableSkills = Array.from(skills.keys()).sort();
        return {
          content: [{
            type: "text",
            text: `Skill "${params.skill}" not found.\n\nAvailable skills:\n${availableSkills.map(s => `  - ${s}`).join("\n")}\n\nInstall superpowers: pi install https://github.com/obra/superpowers`,
          }],
          isError: true,
          details: { requestedSkill: params.skill, availableSkills },
        };
      }

      const skillContent = readSkillContent(skill.path);
      if (!skillContent) {
        return {
          content: [{
            type: "text",
            text: `Error loading skill "${params.skill}": Failed to read skill file`,
          }],
          isError: true,
          details: { error: "Failed to read skill file", skillPath: skill.path },
        };
      }

      // Return FULL skill content to LLM (no truncation)
      // UI display is handled separately by renderResult
      return {
        content: [{
          type: "text",
          text: `Loaded skill: ${skill.name}\n${skill.description ? `\nDescription: ${skill.description}\n` : ""}\n---\n\n${skillContent}`,
        }],
        details: { skillName: skill.name, skillPath: skill.path, skillDescription: skill.description, totalLines: skillContent.split("\n").length },
      };
    },
    // Custom UI rendering: show collapsed skill info instead of full content
    renderResult(result, _options, theme, context) {
      // If there was an error (e.g. skill not found), display the error message directly
      if (context.isError) {
        const errorMsg = result.content[0]?.type === "text" ? result.content[0].text : "Failed to load skill.";
        return new Text(theme.fg("error", errorMsg), 0, 0);
      }

      const details = result.details as { skillName?: string; skillPath?: string; totalLines?: number } | undefined;
      
      // If we are missing expected details, show a generic failure/fallback message
      if (!details || !details.skillName || !details.totalLines) {
        return new Text(theme.fg("warning", "Skill loaded, but metadata is missing."), 0, 0);
      }

      const label = theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
      const name = theme.fg("customMessageText", details.skillName);
      const lines = theme.fg("dim", ` (${details.totalLines} lines)`);
      const line = `${label} ${name}${lines}`;
      
      const box = new Box(1, 0, (t: string) => theme.bg("customMessageBg", t));
      box.addChild(new Text(line, 0, 0));
      return box;
    },
  });
}

// ============================================================================
// Commands
// ============================================================================

function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand("todos", {
    description: "Show current todo list",
    handler: async (_args, ctx) => ctx.ui.notify(formatTodos(), "info"),
  });

  pi.registerCommand("todo-clear", {
    description: "Clear all todos",
    handler: async (_args, ctx) => {
      todos = [];
      ctx.ui.notify("All todos cleared.", "info");
    },
  });
}

// ============================================================================
// Main Extension
// ============================================================================

const USING_SUPERPOWERS_SKILL = "using-superpowers";

export default function (pi: ExtensionAPI) {
  registerTodoWriteTool(pi);
  registerSkillTool(pi);
  registerCommands(pi);

  pi.on("session_start", async () => {
    todos = [];
    skillCache = null;
  });

  pi.on("resources_discover", async () => {
    skillCache = null;
  });

  // Auto-inject using-superpowers skill content into system prompt
  pi.on("before_agent_start", async (event, ctx) => {
    const skills = discoverSkills(ctx.cwd);
    const skill = skills.get(USING_SUPERPOWERS_SKILL);
    
    if (!skill) {
      // using-superpowers skill not found - notify user if UI available
      if (ctx.hasUI) {
        ctx.ui.notify(
          "[pi-superpowers-support] using-superpowers skill not found. Install superpowers: pi install https://github.com/obra/superpowers",
          "warning"
        );
      }
      return;
    }
    
    const skillContent = readSkillContent(skill.path);
    if (!skillContent) {
      // Failed to read skill file - notify user if UI available
      if (ctx.hasUI) {
        ctx.ui.notify(
          `[pi-superpowers-support] Failed to read using-superpowers skill from ${skill.path}`,
          "error"
        );
      }
      return;
    }

    // Inject the using-superpowers skill content into the system prompt
    const injectedPrompt = `

<superpowers-skills>
${skillContent}
</superpowers-skills>
`;

    return {
      systemPrompt: event.systemPrompt + injectedPrompt,
    };
  });
}
