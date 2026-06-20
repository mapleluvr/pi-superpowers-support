# pi-superpowers-support

A Pi compatibility extension for the official [Superpowers](https://github.com/obra/superpowers) skillset.

This package provides only the small harness-compatibility tools that are still useful on Pi:

- `TodoWrite` — in-session task tracking for skills that say "create a todo".
- `Skill` — explicit skill loading for prompts that expect a `Skill` tool.

It does **not** provide `Task`, `Agent`, or any subagent execution wrapper. Install nicobailon's `pi-subagents` separately and use its native `subagent(...)` tool for real delegation.

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
- if no subagent tool exists, do not fabricate unsupported tool calls.

This extension fills the small compatibility gap for prompts and older Superpowers wording that still mention `TodoWrite` or `Skill` directly.

## Tool Mapping

| Superpowers action | Pi-native / companion equivalent | Provided here |
| --- | --- | --- |
| Read a file | `read` | No |
| Run shell command | `bash` | No |
| Edit/write files | `edit`, `write` | No |
| Create/update todos | `TodoWrite` | Yes |
| Load a skill explicitly | `Skill({ skill })` | Yes |
| Dispatch a subagent | `subagent({ agent, task, ... })` from `npm:pi-subagents` | No |

## Subagents

Subagent support belongs to `npm:pi-subagents`, not this package.

Use nicobailon's native tool directly:

```js
subagent({ agent: "scout", task: "Find all auth-related files" })
subagent({ agent: "planner", task: "Create an implementation plan", context: "fork" })
subagent({ tasks: [
  { agent: "reviewer", task: "Review the diff" },
  { agent: "researcher", task: "Research the API behavior" }
] })
```

This package intentionally avoids a `Task` compatibility tool because the latest official Superpowers Pi mapping is capability-based: Pi should use the installed `subagent` tool when available and should not fabricate unavailable harness tools.

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

## Commands

| Command | Description |
| --- | --- |
| `/todos` | Show current todo list |
| `/todo-clear` | Clear all todos |

## Alignment With Latest Superpowers

As of the checked upstream Superpowers skillset, `skills/using-superpowers/references/pi-tools.md` treats `pi-subagents` as an optional Pi companion and explicitly says not to fabricate unsupported subagent calls when no subagent tool is installed.

This package aligns with that model:

- it requires users to install `npm:pi-subagents` separately for real delegation;
- it removes the old subagent dependency assumption;
- it nudges new work toward direct `subagent(...)` calls;
- it keeps this package focused on `TodoWrite` and `Skill` compatibility only.

## License

MIT
