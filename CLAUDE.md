# CLAUDE.md

Guidance for Claude when working in this repository.

## Code comments

- Default to no comments. Well-named identifiers and clear code should speak for themselves.
- Only add a comment when the *why* isn't obvious from the code.
- When a comment is warranted, keep it short — a single line beats a paragraph.
- Don't explain *what* the code does, restate the diff, or reference the current task/fix/caller (e.g. "used by X", "added for the Y flow"). That belongs in the commit message or PR description, not the code.
- Don't overly emphasis historical reasons for the change, assume the current state of the code speaks for itself.

## Pull request descriptions

Structure the description so the author's own notes come first, and write only
your own section:

```markdown
# <github username of the person the PR is for>

# Claude

<your description>
```

- Leave the author's section empty for them to fill in. Never write in it, and
  never remove text already there.
- When updating a PR description, rewrite only the `# Claude` section.
