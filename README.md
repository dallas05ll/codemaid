# CodeMaid

A Claude Agent Skill for codebase hygiene — detects and removes dead code, stale docs, unused imports, orphaned files, and documentation drift.

## Install

Copy the `.claude/skills/codemaid/SKILL.md` file into your project's `.claude/skills/codemaid/` directory:

```bash
# From your project root
mkdir -p .claude/skills/codemaid
curl -o .claude/skills/codemaid/SKILL.md \
  https://raw.githubusercontent.com/dallas05ll/codemaid/main/.claude/skills/codemaid/SKILL.md
```

Or clone and copy:

```bash
git clone https://github.com/dallas05ll/codemaid.git /tmp/codemaid
cp -r /tmp/codemaid/.claude/skills/codemaid .claude/skills/
```

## Usage

Once installed, trigger in Claude Code with:

```
/codemaid                  # Full scan + interactive cleanup
/codemaid scan             # Scan only, no modifications
/codemaid scan docs        # Scan documentation only
/codemaid scan imports     # Scan Python/JS imports only
/codemaid scan deps        # Scan dependency files only
/codemaid report           # Show last scan report
```

## What It Detects

| Category | Examples |
|----------|---------|
| Dead files | Python modules with zero imports, React components never referenced |
| Stale references | Broken markdown links, imports of deleted modules |
| Unused dependencies | `requirements.txt` / `package.json` entries not imported |
| Documentation drift | Docs referencing removed API endpoints or missing files |
| Modularity issues | 800+ line files, components with too many exports |

## 5-Phase Workflow

1. **SCAN** — Inventory files, cross-reference imports/links
2. **REPORT** — Structured output with file paths and reasons
3. **CONFIRM** — Interactive approval before any deletion
4. **CLEAN** — Execute confirmed removals
5. **VERIFY** — Re-scan to catch cascading breaks

## Stack Support

- Python backends (models, routes, services, requirements)
- React frontends (components, hooks, package.json, CSS)
- Markdown documentation (links, API references)
- Config files (docker-compose, .env)

## Claude Flow Integration

When used within a Claude Flow swarm, CodeMaid can:
- Run as a post-commit hook to catch new dead code
- Feed results into the `optimize` background worker
- Store findings in memory for cross-session tracking

## License

MIT
