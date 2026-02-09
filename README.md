# CodeMaid

Dead code detector and codebase hygiene tool for Python, JS/TS, and Markdown projects.

Scans your project for orphaned files, broken imports, unused dependencies, stale documentation links, and modularity issues. Produces an interactive report and only deletes with your approval.

## Install

```bash
# Run directly (no install needed)
npx codemaid scan

# Or install globally
npm install -g codemaid

# Or as a dev dependency
npm install --save-dev codemaid
```

## Usage

```bash
npx codemaid scan                 # Full scan, print report
npx codemaid scan --only python   # Python files only
npx codemaid scan --only js       # JS/TS only
npx codemaid scan --only docs     # Markdown only
npx codemaid scan --format json   # JSON output for CI
npx codemaid clean                # Interactive cleanup with checkboxes
npx codemaid clean --dry-run      # Preview changes without modifying
npx codemaid clean --auto         # Auto-fix all actionable issues
npx codemaid init                 # Create .codemaidrc.json config
npx codemaid report               # Show last cached report
npx codemaid report --detail unused-exports  # Drill into a category
```

## What It Detects

| Category | Examples |
|----------|---------|
| Dead files | Python modules with zero imports, React components never referenced |
| Unused exports | Exported functions/classes/types never imported anywhere |
| Stale references | Broken imports pointing to deleted modules |
| Unused dependencies | `requirements.txt` / `package.json` entries not imported anywhere |
| Documentation drift | Markdown links pointing to non-existent files |
| Modularity issues | Files exceeding line thresholds, too many exports |

## How It Works

```
[File Discovery] -> [Scanner Plugins] -> [Dependency Graph] -> [BFS Analysis] -> [Report]
        |                   |                    |                    |
    fast-glob         5 language          Directed graph       Find orphaned
    + .codemaidignore   scanners          with edges for       files not reachable
                        (regex-based)     every import         from entry points
```

1. **Discover** all files using fast-glob, respecting `.codemaidignore`
2. **Parse** each file with language-specific scanners (Python, JS/TS, Markdown, CSS, Config)
3. **Build** a dependency graph (nodes = files, edges = imports)
4. **Detect** entry points automatically (`main.py`, `index.ts`, `server.js`, etc.) or via config
5. **Walk** the graph via BFS from entry points to find unreachable files
6. **Report** findings with file paths, line numbers, and suggested actions

## Configuration

Create a `.codemaidrc.json` in your project root:

```bash
npx codemaid init
```

```json
{
  "include": ["**/*"],
  "exclude": ["node_modules/**", "dist/**", ".git/**"],
  "entryPoints": ["src/server.ts", "src/worker.ts"],
  "scanners": {
    "python": true,
    "javascript": true,
    "markdown": true,
    "config": true,
    "css": true
  },
  "thresholds": {
    "maxFileLines": 500,
    "maxExports": 10
  }
}
```

You can also create a `.codemaidignore` file (gitignore format) to exclude paths.

## Scanner Plugins

| Scanner | Extensions | Detects |
|---------|-----------|---------|
| Python | `.py` | `import`/`from` statements, `__init__.py` exports, `requirements.txt` usage |
| JavaScript | `.js`, `.ts`, `.tsx`, `.jsx` | ESM imports, `require()`, dynamic imports, `package.json` deps |
| Markdown | `.md`, `.mdx` | Relative link targets (`[text](path)`) |
| Config | `.yml`, `.yaml`, `.env` | docker-compose build contexts, `.env.example` key references |
| CSS | `.css` | Class definitions vs `className`/`class` usage in JS/HTML |

## Confidence System

Unused export detection uses a layered confidence system so you can filter by reliability:

| Confidence | When | Agent Action |
|-----------|------|-------------|
| **high** | Only export in file, or no special context | Safe to auto-fix |
| **medium** | Type-only export (may be consumed indirectly) | Verify first |
| **low** | Barrel file (index.ts) or test helper | Usually skip |

```bash
# Drill into unused exports with confidence + reason + trace
npx codemaid report --detail unused-exports
```

## Programmatic API

```typescript
import { ScanOrchestrator, loadConfig } from 'codemaid';

const config = loadConfig('./my-project');
const orchestrator = new ScanOrchestrator(config);
const report = await orchestrator.scan(config);

console.log(`Found ${report.issues.length} issues`);
```

### Agent Adapter (for AI agents)

```typescript
import { scanProject } from 'codemaid/agent';

const report = await scanProject('./my-project', {
  only: 'javascript',        // optional: filter by language
  minConfidence: 'medium',   // optional: filter out low-confidence results
});

// report.issues has relative paths, confidence tags, reasons, and traces
const actionable = report.issues.filter(i => i.confidence === 'high');
```

## CI Integration

```bash
# Exit code 1 if errors found (for CI pipelines)
npx codemaid scan --format json > codemaid-report.json
```

## Claude Code Skill

CodeMaid also works as a Claude Code skill. Copy the skill file into your project:

```bash
mkdir -p .claude/skills/codemaid
curl -o .claude/skills/codemaid/SKILL.md \
  https://raw.githubusercontent.com/dallas05ll/codemaid/main/.claude/skills/codemaid/SKILL.md
```

Then use `/codemaid` in Claude Code for AI-powered codebase hygiene.

## License

MIT
