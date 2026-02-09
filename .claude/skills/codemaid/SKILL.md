---
name: codemaid
description: >
  Dead code detector and codebase hygiene CLI. Scans for unused files,
  stale imports, broken doc links, unused dependencies, and unused exports
  with confidence-tagged results. Agents consume JSON output; humans get
  interactive console reports with drill-down.
version: 1.1.0
category: methodology
tags:
  - dead-code
  - cleanup
  - hygiene
  - audit
  - codebase-health
  - unused-exports
  - static-analysis
author: Employee-ONE
triggers:
  - /codemaid
  - clean up code
  - dead code
  - unused files
  - audit codebase
  - codebase hygiene
  - unused exports
  - find dead code
claude_flow:
  agent_type: code-analyzer
  swarm_role: specialist
  model_tier: haiku
  coordination: parallel
  plugin: ./plugin.json
---

# CodeMaid - Dead Code Detection Plugin

## Quick Start (Agent Mode)

Agents should invoke codemaid via CLI and parse structured JSON output.

### Install

```bash
npm install -g codemaid    # global
npx codemaid scan .        # or run directly with npx
```

### Scan → JSON (primary agent workflow)

```bash
npx codemaid scan <directory> --format json
```

Returns a `ScanReport` JSON object to stdout. Exit code 0 = clean, 1 = errors found.

### Example Agent Workflow

```
1. Run:    npx codemaid scan ./my-project --format json
2. Parse:  JSON.parse(stdout) → ScanReport
3. Filter: report.issues.filter(i => i.confidence === 'high')
4. Act:    For each high-confidence issue, apply fix or flag to user
```

## CLI Commands

| Command | Description | Agent-Relevant |
|---------|-------------|---------------|
| `codemaid scan [dir]` | Scan for issues | Yes — use `--format json` |
| `codemaid clean [dir]` | Interactive fix wizard | No — human-only |
| `codemaid report [dir]` | Show cached report | Yes — use `--format json` |
| `codemaid init [dir]` | Create config file | No — one-time setup |

### Scan Options

```bash
codemaid scan [dir]
  --format <format>    # "json" (agent) or "console" (human). Default: console
  --only <type>        # Filter: python, js, docs, css, config
  --verbose            # Show detailed scan progress
  --config <path>      # Path to .codemaidrc.json
```

### Report Drill-Down (Human Mode)

```bash
codemaid report --detail dead-files
codemaid report --detail unused-exports
codemaid report --detail stale-refs
codemaid report --detail unused-deps
codemaid report --detail doc-drift
codemaid report --detail modularity
```

## Output Schema: ScanReport

```typescript
interface ScanReport {
  timestamp: string;           // ISO 8601
  rootDir: string;             // Absolute path scanned
  duration: number;            // Milliseconds
  scanners: string[];          // Active scanners: ["javascript", "python", ...]
  issues: Issue[];             // All detected issues
  stats: {
    filesScanned: number;
    deadFiles: number;
    staleRefs: number;
    unusedDeps: number;
    unusedExports: number;
    docDrift: number;
    modularityIssues: number;
  };
}

interface Issue {
  category: 'dead-file' | 'stale-reference' | 'unused-dependency'
           | 'unused-export' | 'doc-drift' | 'modularity';
  severity: 'error' | 'warning' | 'info';
  filePath: string;            // Relative path (in JSON mode)
  line?: number;               // Source line, if applicable
  message: string;             // Human-readable description
  action: 'delete' | 'update' | 'skip';
  confidence?: 'high' | 'medium' | 'low';   // Agent prioritization
  reason?: string;             // Why this was flagged
  trace?: string[];            // Dependency path from entry point
  fix?: {                      // Machine-actionable fix details
    type: 'remove-import' | 'remove-link' | 'remove-dependency' | 'custom';
    target: string;
    replacement?: string;
  };
}
```

## Confidence System (Strategy B)

All unused exports are reported with confidence tags so agents get full data:

| Confidence | When | Severity | Agent Action |
|-----------|------|----------|-------------|
| **high** | Only export in file, or no special context | `warning` | Safe to act on |
| **medium** | Type-only export (may be consumed indirectly) | `info` | Verify before acting |
| **low** | Barrel file (index.ts) or test helper | `info` | Usually skip |

**Agent filtering strategy:**
```javascript
// High-confidence issues — safe to auto-fix
const actionable = report.issues.filter(i => i.confidence === 'high');

// All issues including advisory
const everything = report.issues;
```

## Detection Algorithms

### Dead File Detection
- **BFS flood-fill** from entry points through the dependency graph
- Files not reached by any entry point → orphaned (dead)
- Entry points auto-detected: `main.py`, `index.ts`, `app.js`, etc.
- Custom entry points via `.codemaidrc.json`

### Unused Export Detection
- Build import/export graph across all scanned files
- Exports not referenced by any import → unused
- Confidence tagged based on file context (barrel, test, type-only)

### Stale Reference Detection
- Resolve all import paths against filesystem
- Resolve all markdown links against filesystem
- Unresolvable references → stale

### Dependency Detection
- Parse `package.json` dependencies and `requirements.txt`
- Cross-reference against actual imports in source code

## Programmatic API (for Node.js agents)

```typescript
import { scanProject } from 'codemaid/agent';

const report = await scanProject('./my-project', {
  only: 'javascript',
  minConfidence: 'medium',
});

// report is a ScanReport — same schema as JSON CLI output
```

## Safety Mechanisms

- **Backup & rollback**: BackupManager creates timestamped snapshots before any file modification
- **Pre-flight checks**: Verifies file exists + write permission before deletion
- **Precise import matching**: Regex with word boundaries (won't match "util" in "utilHelper")
- **First-occurrence replacement**: Link fixes replace only the first match, not all duplicates
- **Dry-run mode**: `codemaid clean --dry-run` previews changes without modifying files
- **Config validation**: Invalid `.codemaidrc.json` falls back to safe defaults with warnings

## Configuration (.codemaidrc.json)

```json
{
  "include": ["**/*"],
  "exclude": ["node_modules/**", "dist/**", ".git/**"],
  "entryPoints": ["src/main.ts"],
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

## Error Codes

| Exit Code | Meaning |
|-----------|---------|
| 0 | Scan complete, no errors (warnings/info may exist) |
| 1 | Scan complete, errors found |
| 2 | Configuration error |

## Supported Languages

| Language | Extensions | Scanner |
|----------|-----------|---------|
| JavaScript/TypeScript | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` | javascript |
| Python | `.py` | python |
| Markdown | `.md` | markdown |
| CSS | `.css` | css |
| Config | `.json`, `.yml`, `.yaml`, `.toml`, `.env` | config |

## Integration with Claude Flow

When used within a Claude Flow swarm, CodeMaid can:
- Run as a post-commit hook to catch new dead code
- Feed results into the `optimize` background worker
- Store findings in memory for cross-session tracking
- Trigger `testgaps` worker when files are removed
