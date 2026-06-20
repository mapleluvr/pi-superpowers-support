# pi-superpowers-support

A Pi compatibility extension for the official [Superpowers](https://github.com/obra/superpowers) skillset.

This package provides small harness-compatibility tools that Superpowers workflows often reference:

- `TodoWrite` — in-session task tracking for skills that say "create a todo".
- `Skill` — explicit skill loading for prompts that expect a `Skill` tool.
- `Task` — a legacy dispatch shim that maps Claude Code / older Superpowers `Task(...)` calls to the nicobailon `pi-subagents` `subagent(...)` style.

It does **not** bundle, fork, or reimplement subagent execution. Install `pi-subagents` separately and let it own real subagent workflows.

## Required Companion Packages

Install the official Superpowers skills and nicobailon's `pi-subagents` first:

```bash
pi install https://github.com/obra/superpowers
pi install npm:pi-subagents
pi install https://github.com/mapleluvr/pi-superpowers-support
```

For local development from this checkout:

```bash
pi install /absolute/path/to/pi-superpowers-support
```

## Why This Extension Exists

Pi already discovers skills natively and the latest Superpowers Pi mapping says:

- use Pi's `read`, `bash`, `edit`, and `write` tools for file/shell work;
- use an installed todo/task extension when a skill asks for task tracking;
- use `pi-subagents`' `subagent` tool when a skill asks to dispatch subagents;
- if no subagent tool exists, do not fabricate `Task` or `Agent` calls.

This extension fills the small compatibility gap for prompts and older Superpowers wording that still mention `TodoWrite`, `Skill`, or `Task` directly.

## Tool Mapping

| Superpowers action | Pi-native / companion equivalent | Provided here |
| --- | --- | --- |
| Read a file | `read` | No |
| Run shell command | `bash` | No |
| Edit/write files | `edit`, `write` | No |
| Create/update todos | `TodoWrite` | Yes |
| Load a skill explicitly | `Skill({ skill })` | Yes |
| Dispatch a subagent | `subagent({ agent, task, ... })` from `npm:pi-subagents` | No |
| Legacy `Task(...)` dispatch | Compatibility mapping to `subagent(...)` | Yes |

## `Task` Compatibility Mapping

`Task` is intentionally a shim. Pi's public extension API exposes tool names and schemas, but not a stable way for one custom tool to execute another custom tool. Therefore `Task(...)` validates that `subagent` is installed and returns the exact `subagent(...)` invocation to use.

Prefer direct `subagent(...)` calls in new prompts and plans.

Legacy examples:

```js
Task({
  subagent_type: "Explore",
  prompt: "Find all auth-related files",
  description: "Find auth files",
  run_in_background: true
})
```

Maps to:

```js
subagent({
  agent: "scout",
  task: "Find all auth-related files",
  async: true
})
```

Common mappings:

| Legacy `subagent_type` | nicobailon `agent` |
| --- | --- |
| `Explore` / `scout` | `scout` |
| `Plan` / `planner` | `planner` |
| `review` / `reviewer` | `reviewer` |
| `research` / `researcher` | `researcher` |
| `general-purpose` / `generalist` / `task` | `delegate` |
| `worker` | `worker` |
| `oracle` | `oracle` |
| `context-builder` | `context-builder` |

Other names pass through unchanged, so user-defined `pi-subagents` agents can still be targeted.

Legacy fields handled by the shim:

- `run_in_background: true` → `async: true`
- `inherit_context: true` → `context: "fork"`
- `isolated: true` → `context: "fresh"` when `inherit_context` is not set
- `model` → `model`

Legacy fields not forwarded by the shim:

- `thinking`
- `max_turns`
- `resume`

Use native `subagent` configuration/actions for those behaviors.

## Tools Provided

### `TodoWrite`

```js
TodoWrite({
  todos: [
    { id: "1", content: "Design API", status: "pending", priority: "high" },
    { id: "2", content: "Implement", status: "in_progress" },
    { id: "3", content: "Write tests", status: "completed" }
  ]
})
```

### `Skill`

```js
Skill({ skill: "brainstorming" })
Skill({ skill: "test-driven-development" })
```

### `Task`

```js
Task({
  subagent_type: "Plan",
  prompt: "Create an implementation plan for the approved design",
  description: "Plan implementation",
  inherit_context: true
})
```

Then call the returned `subagent(...)` invocation.

## Commands

| Command | Description |
| --- | --- |
| `/todos` | Show current todo list |
| `/todo-clear` | Clear all todos |

## Alignment With Latest Superpowers

As of the checked upstream Superpowers skillset, `skills/using-superpowers/references/pi-tools.md` treats `pi-subagents` as an optional Pi companion and explicitly says not to fabricate unsupported `Task` calls when no subagent tool is installed.

This package aligns with that model:

- it requires users to install `npm:pi-subagents` separately for real delegation;
- it removes the old `Agent` dependency assumption;
- it nudges new work toward direct `subagent(...)` calls;
- it keeps `Task` only as a legacy compatibility bridge.

## License

MIT
