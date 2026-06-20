import assert from "node:assert/strict";
import { mapTaskToSubagent, formatSubagentInvocation, describeUnsupportedTaskFields } from "../src/task-mapping.js";

assert.deepEqual(
  mapTaskToSubagent({ subagent_type: "Explore", prompt: "Find auth files", description: "Find auth" }),
  { agent: "scout", task: "Find auth files" },
);

assert.deepEqual(
  mapTaskToSubagent({ subagent_type: "Plan", prompt: "Plan auth rewrite", description: "Plan auth", run_in_background: true, inherit_context: true, model: "anthropic/claude-sonnet-4" }),
  { agent: "planner", task: "Plan auth rewrite", async: true, context: "fork", model: "anthropic/claude-sonnet-4" },
);

assert.deepEqual(
  mapTaskToSubagent({ subagent_type: "general-purpose", prompt: "Fix bug", description: "Fix bug", isolated: true }),
  { agent: "delegate", task: "Fix bug", context: "fresh" },
);

assert.equal(
  formatSubagentInvocation({ agent: "reviewer", task: "Review diff", async: true }),
  'subagent({ agent: "reviewer", task: "Review diff", async: true })',
);

assert.deepEqual(
  describeUnsupportedTaskFields({ subagent_type: "worker", prompt: "x", description: "x", thinking: "high", max_turns: 3, resume: "abc" }),
  ["thinking", "max_turns", "resume"],
);

console.log("task-mapping tests passed");
