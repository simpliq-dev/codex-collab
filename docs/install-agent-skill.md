# Installing the Markdown Collab skill

Markdown Collab stores submitted conversations inside the Markdown file. The extension provides the review interface, but it never calls a model. Whichever agent you use needs the `markdown-collab` skill so it can identify ready comments, preserve the full conversation history, and append responses safely.

## Install from the extension

The skill is bundled inside the VSIX. The first time you open Collaborative Review, Markdown Collab offers to install it. You can also run **Markdown Collab: Install Agent Skill** from the Command Palette at any time.

The installer asks two things:

1. **User profile or current workspace.** User-profile installation makes the skill available across projects. Workspace installation creates files that can be reviewed and shared with that project.
2. **Agent harness.** Choose Codex and Cursor, Claude Code, or both locations.

If a different `SKILL.md` already exists, Markdown Collab shows the full destination and asks before replacing it. It never modifies `AGENTS.md`, `CLAUDE.md`, another skill, or another file in the skill directory.

Run the command again if you later add another agent harness. Finding one current installation stops the first-use reminder; the extension does not assume that every supported agent must be configured.

## Install the direct download manually

Every GitHub release attaches [`SKILL.md`](https://github.com/simpliq-dev/markdown-collab/releases/latest/download/SKILL.md) as a directly downloadable file. Create a `markdown-collab` directory at the appropriate location and save the download inside it as `SKILL.md`.

| Agent | User-wide location | Project location | Explicit invocation |
| --- | --- | --- | --- |
| Codex | `~/.agents/skills/markdown-collab/SKILL.md` | `.agents/skills/markdown-collab/SKILL.md` | `$markdown-collab` |
| Cursor | `~/.agents/skills/markdown-collab/SKILL.md` | `.agents/skills/markdown-collab/SKILL.md` | `/markdown-collab` |
| Claude Code | `~/.claude/skills/markdown-collab/SKILL.md` | `.claude/skills/markdown-collab/SKILL.md` | `/markdown-collab` |

Other clients that support the open [Agent Skills](https://agentskills.io) format can use the same file in the skill location documented by that client.

Install the skill for the agent harness that will handle the comments. It does not need to be the agent built into the editor: you can keep the document and Markdown Collab interface in VS Code, then use Codex Desktop, Codex CLI, Claude Code, or another skill-aware harness to edit the same working copy.

The complete release kit also contains the unchanged folder at `skills/markdown-collab/`, and a standalone skill archive is available when moving the folder between machines is more convenient.

Some clients take a snapshot of available skills when a conversation begins. Start a new agent conversation or restart the client if a newly installed skill is not visible immediately.

## Use the skill

The extension's **Copy prompt** action produces a message such as:

> Use the installed markdown-collab skill for this turn. 3 comments are ready for review in docs/brief.md. Process them together as one coherent turn. Preserve every existing Markdown Collab conversation unless I explicitly ask you to delete it.

Paste that into the agent conversation that is working on the same repository. The ordinary wording is deliberately portable across agents. The explicit invocation forms in the table are useful for troubleshooting, but are not required when the agent recognises the skill from the copied prompt.

The skill instructs the agent to read every ready comment before editing, make coordinated changes, append one `role=A` response to each handled thread, and verify that no existing conversation was removed or rewritten.

`rules/COLLAB-RULES.md` remains the detailed protocol reference for maintainers and unusual edge cases.
