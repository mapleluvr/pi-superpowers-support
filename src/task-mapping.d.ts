export interface LegacyTaskInput {
  subagent_type: string;
  prompt: string;
  description: string;
  model?: string;
  thinking?: string;
  max_turns?: number;
  run_in_background?: boolean;
  resume?: string;
  isolated?: boolean;
  inherit_context?: boolean;
}

export interface MappedSubagentInput {
  agent: string;
  task: string;
  async?: boolean;
  context?: "fresh" | "fork";
  model?: string;
}

export function mapTaskToSubagent(input: LegacyTaskInput): MappedSubagentInput;
export function formatSubagentInvocation(mapped: MappedSubagentInput): string;
export function describeUnsupportedTaskFields(input: LegacyTaskInput): string[];
