# AGENTS.md

Guidance for AI coding agents (Claude, Codex, Copilot, ...) working in this repository. Where a rule below says `<agent>`, use your own name, e.g. `Claude` or `Codex`.

## Code comments

- Default to no comments. Well-named identifiers and clear code should speak for themselves.
- Only add a comment when the *why* isn't obvious from the code.
- When a comment is warranted, keep it short — a single line beats a paragraph.
- Don't explain *what* the code does, restate the diff, or reference the current task/fix/caller (e.g. "used by X", "added for the Y flow"). That belongs in the commit message or PR description, not the code.
- Don't overly emphasis historical reasons for the change, assume the current state of the code speaks for itself.

## Branches and PR titles

- Name branches `<issue type>/<release branch>/<short-name>/<JIRA key>`, e.g. `task/3.y/mark-claude-docs/SW-2594`: the JIRA issue type in lowercase (`task`, `bug`, ...), the release branch the PR targets, a short kebab-case name, and the JIRA issue ID.
- Title PRs the same way: `<issue type> / <release branch> / <short description> / <JIRA key>`, e.g. `task / 3.y / Mark Claude-authored sections of the Markdown docs / SW-2594`.
- Take the issue type and key from the JIRA issue itself, or from the current branch name if it already follows this pattern. If you can't determine them, ask; never guess or invent a JIRA key or issue type.

## JIRA issue status

- Keep the JIRA issue's status in step with the work, if it doesn't move on its own: `In Progress` when you create the branch, `In Review` when you open the PR, and `Done` when the PR is merged.
- An issue still in `To Do` hasn't been approved for work. Ask before moving it on rather than approving it yourself.
- If you can't reach JIRA, tell the user which status to set the issue to, and when.

## Github PR

- When replying to Github PRs, prefix each comment with `# <agent>` so the other users can clearly see it is your text.

## Pull request descriptions

Structure the description so the author's own notes come first, and write only
your own section:

```markdown
# <github username of the person the PR is for>

# <agent>

<your description>
```

- Leave the author's section empty for them to fill in. Never write in it or in
  another agent's section, and never remove text already there.
- When updating a PR description, rewrite only your own `# <agent>` section.

## Documentation

- Prefix everything you write in `src/doc/markdown` with `*This section written by <agent>*`: directly below the heading of a new section, or on its own line above text added to an existing section.
