const SUBAGENT_TYPE_MAP = new Map([
  ["explore", "scout"],
  ["scout", "scout"],
  ["plan", "planner"],
  ["planner", "planner"],
  ["review", "reviewer"],
  ["reviewer", "reviewer"],
  ["research", "researcher"],
  ["researcher", "researcher"],
  ["general-purpose", "delegate"],
  ["generalist", "delegate"],
  ["task", "delegate"],
  ["worker", "worker"],
  ["oracle", "oracle"],
  ["context-builder", "context-builder"],
  ["delegate", "delegate"],
]);

function normalizeSubagentType(type) {
  return type.trim().toLowerCase();
}

function resolveSubagentName(subagentType) {
  const normalized = normalizeSubagentType(subagentType);
  return SUBAGENT_TYPE_MAP.get(normalized) ?? subagentType.trim();
}

export function mapTaskToSubagent(input) {
  const mapped = {
    agent: resolveSubagentName(input.subagent_type),
    task: input.prompt,
  };

  if (input.run_in_background === true) mapped.async = true;
  if (input.inherit_context === true) mapped.context = "fork";
  if (input.isolated === true && mapped.context === undefined) mapped.context = "fresh";
  if (typeof input.model === "string" && input.model.trim()) mapped.model = input.model.trim();

  return mapped;
}

export function formatSubagentInvocation(mapped) {
  const parts = [
    `agent: ${JSON.stringify(mapped.agent)}`,
    `task: ${JSON.stringify(mapped.task)}`,
  ];
  if (mapped.async === true) parts.push("async: true");
  if (mapped.context) parts.push(`context: ${JSON.stringify(mapped.context)}`);
  if (mapped.model) parts.push(`model: ${JSON.stringify(mapped.model)}`);
  return `subagent({ ${parts.join(", ")} })`;
}

export function describeUnsupportedTaskFields(input) {
  const unsupported = [];
  if (input.thinking !== undefined) unsupported.push("thinking");
  if (input.max_turns !== undefined) unsupported.push("max_turns");
  if (input.resume !== undefined) unsupported.push("resume");
  return unsupported;
}
