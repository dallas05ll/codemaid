# CodeMaid

**Dead code detector and codebase hygiene tool for Python, JS/TS, and Markdown projects.**

Scans your project for orphaned files, broken imports, unused dependencies, stale documentation links, and modularity issues. Produces an interactive report with confidence-tagged results and only deletes with your explicit approval.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Demo](#demo)
- [Commands](#commands)
- [What It Detects](#what-it-detects)
- [How It Works](#how-it-works)
- [Configuration](#configuration)
- [Confidence System](#confidence-system)
- [Scanner Reference](#scanner-reference)
- [Programmatic API](#programmatic-api)
- [Agent Adapter](#agent-adapter)
- [CI Integration](#ci-integration)
- [Claude Code Skill](#claude-code-skill)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

```bash
# Run directly — no install needed
npx codemaid scan

# Or install globally
npm install -g codemaid

# Or as a dev dependency
npm install --save-dev codemaid
```

Requires Node.js 18+.

---

## Demo

**Scanning a React project:**

```
$ npx codemaid scan ./my-react-app

  ✓ Found 47 files
  ✓ Scanned 38 javascript files
  ✓ Scanned 4 markdown files
  ✓ Scanned 2 css files
  ✓ Graph: 47 files, 31 edges, 2 entry points

=== CodeMaid Scan Report ===

1. DEAD FILES (2)

  ┌────┬─────────────────────────────────┬──────────────────────────────────────────────┐
  │    │ File                            │ Issue                                        │
  ├────┼─────────────────────────────────┼──────────────────────────────────────────────┤
  │ !  │ src/components/OldBanner.tsx     │ File is not imported by any other file       │
  │ !  │ src/hooks/useDeprecated.ts       │ File is not imported by any other file       │
  └────┴─────────────────────────────────┴──────────────────────────────────────────────┘

2. UNUSED EXPORTS (3)

  ┌────┬─────────────────────────────────┬──────────────────────────────────────────────┐
  │    │ File                            │ Issue                                        │
  ├────┼─────────────────────────────────┼──────────────────────────────────────────────┤
  │ !  │ src/utils/format.ts:12          │ Export 'formatCurrency' is never imported     │
  │    │                                 │ [HIGH]                                       │
  │ i  │ src/types/index.ts:8            │ Export 'LegacyUser' is never imported [LOW]  │
  │ i  │ src/lib/api.ts:45              │ Export 'ApiConfig' is never imported [MED]    │
  └────┴─────────────────────────────────┴──────────────────────────────────────────────┘

3. DOCUMENTATION DRIFT (1)

  ┌────┬─────────────────────────────────┬──────────────────────────────────────────────┐
  │    │ File                            │ Issue                                        │
  ├────┼─────────────────────────────────┼──────────────────────────────────────────────┤
  │ X  │ docs/SETUP.md:23                │ Link [API Guide](./api.md) points to         │
  │    │                                 │ non-existent file                            │
  └────┴─────────────────────────────────┴──────────────────────────────────────────────┘

  ╭──────────────────────────────────╮
  │           Summary                │
  │                                  │
  │  Files scanned: 47              │
  │  Total issues:  6               │
  │                                  │
  │  X Errors:   1                  │
  │  ! Warnings: 4                  │
  │  i Info:     1                  │
  │                                  │
  │  Duration: 142ms                │
  ╰──────────────────────────────────╯

  Run codemaid clean to interactively fix these issues.
```

**Interactive cleanup:**

```
$ npx codemaid clean ./my-react-app

Cleanup Plan:

DELETE (2 files):
  x src/components/OldBanner.tsx -- File is not imported by any other file
  x src/hooks/useDeprecated.ts -- File is not imported by any other file

UPDATE (1 file):
  ~ docs/SETUP.md -- Link [API Guide](./api.md) points to non-existent file

? Select issues to fix:
  [x] DELETE src/components/OldBanner.tsx
  [x] DELETE src/hooks/useDeprecated.ts
  [x] UPDATE docs/SETUP.md

  ✓ Backed up 3 files
  ✓ Deleted: src/components/OldBanner.tsx
  ✓ Deleted: src/hooks/useDeprecated.ts
  ✓ Fixed broken link in docs/SETUP.md
  ✓ Done: 3 fixed, 0 failed
```

**Drill into unused exports:**

```
$ npx codemaid report --detail unused-exports

=== UNUSED-EXPORTS (3 issues) ===

  src/utils/format.ts:12
    Export 'formatCurrency' (function) is never imported
    Confidence: HIGH
    Reason: Only export in this file — the entire file may be dead code

  src/types/index.ts:8
    Export 'LegacyUser' (type) is never imported
    Confidence: LOW
    Reason: Barrel file — re-exports are intentional API surface

  src/lib/api.ts:45
    Export 'ApiConfig' (type) is never imported
    Confidence: MEDIUM
    Reason: Type export 'ApiConfig' may be consumed via declaration merging or inference
    Trace: src/index.ts -> src/lib/api.ts
```

---

## Commands

### `codemaid scan`

Scan a directory for dead code and hygiene issues.

```bash
npx codemaid scan [dir]           # Scan current or specified directory
npx codemaid scan --only python   # Python files only
npx codemaid scan --only js       # JS/TS only
npx codemaid scan --only docs     # Markdown only
npx codemaid scan --only css      # CSS only
npx codemaid scan --only config   # YAML/ENV only
npx codemaid scan --format json   # JSON output (for CI or agents)
npx codemaid scan --verbose       # Show detailed progress
```

Exit codes: `0` = clean, `1` = errors found.

### `codemaid clean`

Interactively fix detected issues with checkbox selection.

```bash
npx codemaid clean [dir]          # Interactive mode — pick what to fix
npx codemaid clean --dry-run      # Preview changes, modify nothing
npx codemaid clean --auto         # Auto-fix all actionable issues
npx codemaid clean --verbose      # Detailed output
```

Before any modification, CodeMaid creates a timestamped backup in `.codemaid-backup/`. If anything fails, all changes are rolled back automatically.

### `codemaid report`

Show or drill into the last cached scan report.

```bash
npx codemaid report [dir]                        # Full report from cache
npx codemaid report --format json                # JSON output
npx codemaid report --detail dead-files          # Drill into dead files
npx codemaid report --detail unused-exports      # Drill with confidence + trace
npx codemaid report --detail stale-refs          # Broken imports
npx codemaid report --detail unused-deps         # Unused packages
npx codemaid report --detail doc-drift           # Broken markdown links
npx codemaid report --detail modularity          # Size/export violations
```

### `codemaid init`

Create a `.codemaidrc.json` configuration file.

```bash
npx codemaid init [dir]           # Generate default config
```

---

## What It Detects

| Category | Severity | Examples |
|----------|----------|---------|
| **Dead files** | Warning | Python modules with zero imports, React components never referenced |
| **Unused exports** | Warning/Info | Exported functions, classes, types, or variables never imported anywhere |
| **Stale references** | Error | Broken imports pointing to deleted or renamed modules |
| **Unused dependencies** | Warning | `requirements.txt` / `package.json` entries not imported in any source file |
| **Documentation drift** | Error | Markdown links (`[text](path)`) pointing to non-existent files |
| **Modularity issues** | Info | Files exceeding configurable line count or export count thresholds |

---

## How It Works

```
[File Discovery] -> [Scanner Plugins] -> [Dependency Graph] -> [BFS Analysis] -> [Report]
       |                   |                    |                    |               |
   fast-glob          5 language          Directed graph       Flood-fill       Confidence
   + .codemaidignore    scanners          nodes = files        from entry       tagging +
                        (regex-based)     edges = imports      points           trace paths
```

### Pipeline

1. **Discover** all files using [fast-glob](https://github.com/mrmlnc/fast-glob), respecting `.codemaidignore` and config exclusions
2. **Parse** each file with language-specific scanner plugins that extract imports and exports using regex
3. **Build** a directed dependency graph where nodes are files and edges are import relationships
4. **Detect** entry points automatically by filename (`main.py`, `index.ts`, `server.js`, etc.) or via config
5. **Walk** the graph using BFS flood-fill from all entry points — any unreachable file is orphaned
6. **Tag** unused exports with confidence scores based on context (barrel files, test helpers, type-only exports)
7. **Report** findings with file paths, line numbers, confidence levels, reasons, and suggested actions

### Safety Mechanisms

- **Backup before modify** — timestamped snapshots in `.codemaid-backup/` before any file change
- **Auto-rollback** — if cleanup encounters errors, all backed-up files are restored
- **Pre-flight checks** — verifies files still exist and are writable before deletion
- **Precise regex matching** — `escapeRegex()` + word boundaries prevent false-positive import removal
- **First-occurrence link fix** — broken link removal uses `indexOf`, not `replaceAll`, to avoid clobbering duplicates
- **Dry-run mode** — preview all changes without touching any files

---

## Configuration

Generate a config file:

```bash
npx codemaid init
```

This creates `.codemaidrc.json`:

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

### Config Options

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `include` | `string[]` | `["**/*"]` | Glob patterns for files to scan |
| `exclude` | `string[]` | `["node_modules/**", ...]` | Glob patterns to exclude |
| `entryPoints` | `string[]` | `[]` | Additional entry points beyond auto-detected ones |
| `scanners` | `object` | all `true` | Enable/disable individual language scanners |
| `thresholds.maxFileLines` | `number` | `500` | Flag files exceeding this line count |
| `thresholds.maxExports` | `number` | `10` | Flag files with more exports than this |

### `.codemaidignore`

Create a `.codemaidignore` file (gitignore-style) to exclude additional paths:

```
# Ignore generated files
generated/
*.auto.ts

# Ignore vendor code
vendor/
third-party/
```

### Auto-Detected Entry Points

CodeMaid automatically recognizes these filenames as entry points (no configuration needed):

**Python:** `main.py`, `app.py`, `server.py`, `wsgi.py`, `asgi.py`, `manage.py`, `cli.py`, `__main__.py`, `setup.py`

**JavaScript/TypeScript:** `index.js`, `index.ts`, `index.tsx`, `main.js`, `main.ts`, `app.js`, `app.ts`, `server.js`, `server.ts`, `cli.js`, `cli.ts`

---

## Confidence System

Unused export detection uses a layered confidence system so you (or your AI agent) can filter by reliability:

| Confidence | When | What To Do |
|-----------|------|------------|
| **HIGH** | Only export in the file, or no special context | Safe to auto-fix or delete |
| **MEDIUM** | Type-only export (`type`, `interface`) — may be consumed indirectly | Verify before removing |
| **LOW** | Barrel file (`index.ts`) or test helper | Usually skip — these are intentional |

### Confidence in the CLI

```bash
# Summary view — badges appear inline
npx codemaid scan

# Detailed view — shows confidence, reason, and dependency trace
npx codemaid report --detail unused-exports
```

### Confidence in JSON Output

```json
{
  "category": "unused-export",
  "severity": "warning",
  "filePath": "src/utils/format.ts",
  "line": 12,
  "message": "Export 'formatCurrency' (function) is never imported",
  "confidence": "high",
  "reason": "Only export in this file — the entire file may be dead code",
  "trace": ["src/index.ts", "src/utils/format.ts"]
}
```

---

## Scanner Reference

### JavaScript / TypeScript

| What | How |
|------|-----|
| **Extensions** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` |
| **ESM imports** | `import X from 'Y'`, `import { X } from 'Y'`, `import type { X } from 'Y'` |
| **CommonJS** | `require('Y')` |
| **Dynamic imports** | `import('Y')` |
| **Named exports** | `export const`, `export function`, `export class`, `export type`, `export interface`, `export enum` |
| **Default exports** | `export default function X`, `export default class X` |
| **Package.json deps** | Compares `dependencies` + `devDependencies` against actual imports |
| **Resolver** | Handles extension omission, `.js`-to-`.ts` mapping, index files |

### Python

| What | How |
|------|-----|
| **Extensions** | `.py` |
| **Imports** | `import X`, `from X import Y, Z`, `from X import Y as Z` |
| **Exports** | Top-level `def` and `class` definitions |
| **`__init__.py`** | Validates `__all__` entries match actual files in the package directory |
| **requirements.txt** | Cross-references listed packages against imports across all `.py` files |
| **Resolver** | Dotted module paths (`app.models.user` -> `app/models/user.py` or `__init__.py`) |

### Markdown

| What | How |
|------|-----|
| **Extensions** | `.md`, `.mdx` |
| **Link validation** | Checks `[text](relative/path)` links resolve to existing files |
| **Skips** | External URLs (`http://`, `https://`), anchors (`#section`), mailto links |
| **Anchor stripping** | `file.md#section` validates `file.md` exists (ignores anchor) |

### CSS

| What | How |
|------|-----|
| **Extensions** | `.css` |
| **Class definitions** | Extracts `.className` from stylesheets |
| **Usage detection** | Cross-references against `className="..."` and `class="..."` in JS/HTML files |

### Config

| What | How |
|------|-----|
| **Extensions** | `.yml`, `.yaml`, `.env`, `.json` |
| **docker-compose** | Validates `build.context` directories contain actual files |
| **`.env.example`** | Checks that declared env vars are referenced in config files |

---

## Programmatic API

```typescript
import { ScanOrchestrator, loadConfig } from 'codemaid';

const config = loadConfig('./my-project');
const orchestrator = new ScanOrchestrator(config);
const report = await orchestrator.scan(config);

console.log(`Found ${report.issues.length} issues`);
console.log(`Dead files: ${report.stats.deadFiles}`);
console.log(`Unused exports: ${report.stats.unusedExports}`);
```

### Available Exports

```typescript
// Core
import { ScanOrchestrator } from 'codemaid';
import { DependencyGraph } from 'codemaid';
import { BackupManager } from 'codemaid';
import { loadConfig, generateDefaultConfig } from 'codemaid';

// Reporters
import { ConsoleReporter, JsonReporter } from 'codemaid';

// Utilities
import { discoverFiles, filterByExtensions } from 'codemaid';

// Types
import type {
  Issue, IssueCategory, IssueConfidence, IssueSeverity,
  ScanResult, ScanReport, ExportedSymbol, ImportedSymbol,
  CodemaidConfig, ScannerPlugin, ReporterPlugin,
} from 'codemaid';
```

---

## Agent Adapter

For AI agents and programmatic consumers, use the dedicated agent adapter with relative paths and confidence filtering:

```typescript
import { scanProject } from 'codemaid/agent';

const report = await scanProject('./my-project', {
  only: 'javascript',        // optional: filter by language
  minConfidence: 'medium',   // optional: exclude low-confidence results
});

// All paths are relative — safe for agent consumption
for (const issue of report.issues) {
  console.log(`${issue.filePath}:${issue.line} — ${issue.message}`);
  console.log(`  Confidence: ${issue.confidence}, Reason: ${issue.reason}`);
}

// Filter to only high-confidence, auto-fixable issues
const actionable = report.issues.filter(i => i.confidence === 'high');
```

### Agent Scan Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `only` | `string` | — | Scan only: `'python'`, `'js'`, `'docs'`, `'css'`, `'config'` |
| `minConfidence` | `'high' \| 'medium' \| 'low'` | — | Filter: `'high'` = only high, `'medium'` = high+medium |
| `config` | `string` | — | Path to `.codemaidrc.json` |

### Machine-Readable Plugin Manifest

A `plugin.json` is included in the npm package for agent discovery systems:

```bash
cat node_modules/codemaid/plugin.json
```

---

## CI Integration

### GitHub Actions

```yaml
name: Codebase Hygiene
on: [push, pull_request]

jobs:
  codemaid:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx codemaid scan --format json > codemaid-report.json
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: codemaid-report
          path: codemaid-report.json
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Scan complete, no errors |
| `1` | Scan complete, errors found (broken imports, broken links) |

### JSON Output for Pipelines

```bash
npx codemaid scan --format json > report.json
npx codemaid scan --format json | jq '.stats'
npx codemaid scan --format json | jq '.issues[] | select(.confidence == "high")'
```

---

## Claude Code Skill

CodeMaid works as a [Claude Code](https://claude.ai/code) skill for AI-powered codebase hygiene. Add it to your project:

```bash
mkdir -p .claude/skills/codemaid
curl -o .claude/skills/codemaid/SKILL.md \
  https://raw.githubusercontent.com/dallas05ll/codemaid/main/.claude/skills/codemaid/SKILL.md
curl -o .claude/skills/codemaid/plugin.json \
  https://raw.githubusercontent.com/dallas05ll/codemaid/main/.claude/skills/codemaid/plugin.json
```

Then use `/codemaid` in Claude Code to scan and clean your project with AI guidance.

---

## Project Structure

```
codemaid/
  src/
    cli.ts                  # CLI entry point (Commander)
    index.ts                # Programmatic API exports
    agent-adapter.ts        # Agent-facing API with confidence filtering
    core/
      types.ts              # TypeScript types and defaults
      config.ts             # Config loading and validation
      graph.ts              # Dependency graph (BFS + DFS)
      scanner.ts            # Scan orchestrator
      resolver.ts           # Import path resolution (JS/TS, Python, Markdown)
      backup.ts             # Backup and rollback manager
    scanners/
      base-scanner.ts       # Scanner plugin interface
      javascript-scanner.ts # JS/TS/JSX/TSX scanner
      python-scanner.ts     # Python scanner
      markdown-scanner.ts   # Markdown link scanner
      css-scanner.ts        # CSS class usage scanner
      config-scanner.ts     # YAML/ENV config scanner
    cleaners/
      file-deleter.ts       # Safe file deletion with pre-flight checks
      import-cleaner.ts     # Precise import line removal
      link-cleaner.ts       # Broken markdown link replacement
    reporters/
      base-reporter.ts      # Reporter plugin interface
      console-reporter.ts   # Human-readable table output
      json-reporter.ts      # Machine-readable JSON output
    commands/
      scan.ts               # Scan command handler
      clean.ts              # Clean command handler
      report.ts             # Report command handler (with --detail)
      init.ts               # Init command handler
    utils/
      file-discovery.ts     # fast-glob file discovery
      ignore.ts             # .codemaidignore parser
      logger.ts             # Colored console logger
      progress.ts           # Spinner/progress indicator
  plugin.json               # Machine-readable plugin manifest
  .claude/skills/codemaid/  # Claude Code skill definition
```

---

## Contributing

1. Clone the repo
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Run locally: `node dist/cli.js scan ./your-project`

### Development Commands

```bash
npm run build        # Build with tsup (ESM + types)
npm run dev          # Watch mode
npm run lint         # TypeScript type-check
npm test             # Run vitest suite
npm test -- --watch  # Watch mode
```

---

## License

MIT
