---
name: codemaid
description: >
  Codebase hygiene agent that detects and removes dead code, stale docs,
  unused imports, orphaned files, and documentation drift. Produces an
  interactive removal plan with descriptions before any deletion.
version: 1.0.0
category: methodology
tags:
  - dead-code
  - cleanup
  - hygiene
  - audit
  - codebase-health
author: Employee-ONE
triggers:
  - /codemaid
  - clean up code
  - dead code
  - unused files
  - audit codebase
  - codebase hygiene
claude_flow:
  agent_type: code-analyzer
  swarm_role: specialist
  model_tier: sonnet
  coordination: parallel
---

# CodeMaid - Codebase Hygiene Agent

## Overview

CodeMaid is a full-stack codebase hygiene skill that scans for dead code, stale documentation, unused imports, orphaned files, and documentation drift across Python backends, React frontends, and markdown docs. It produces an interactive report and only deletes with explicit user approval.

## 5-Phase Workflow

### Phase 1: SCAN

Inventory all source files and cross-reference imports, registrations, and links.

**Python backend scans:**
- Compare `models/__init__.py` imports against files in `models/`
- Compare `main.py` router registrations against files in `routes/`
- Check every `services/` module is imported by at least one route or another service
- Verify `requirements.txt` packages appear in at least one import
- Detect empty `__init__.py` files with no exports

**React frontend scans:**
- Check every `components/` file is imported by another component or page
- Check every `hooks/` file is used by at least one component
- Compare `package.json` dependencies against actual imports
- Detect CSS files with no matching component import
- Find unused CSS classes (class defined but never referenced)

**Documentation scans:**
- Resolve all markdown links (`[text](path)`) and flag broken ones
- Check documented API endpoints match actual route registrations
- Detect references to removed features (configurable keyword list)
- Flag docs that reference files no longer in the repo

**Config scans:**
- Check `docker-compose.yml` service names match actual directories
- Verify `.env.example` keys are referenced in config code
- Detect orphaned migration files (if applicable)

```bash
# Example scan command structure
Glob("**/*.py")       # Inventory Python files
Glob("**/*.js")       # Inventory React files
Glob("**/*.md")       # Inventory documentation
Grep("from app.models" --type py)  # Cross-reference model imports
Grep("import.*from.*components" --type js)  # Cross-reference component imports
```

### Phase 2: REPORT

Output a structured report with 5 sections:

```
=== CodeMaid Scan Report ===

1. DEAD FILES (files with zero inbound references)
   - host-backend/app/models/old_feature.py
     Reason: Not imported by __init__.py or any route

2. STALE REFERENCES (imports/links pointing to missing targets)
   - docs/README.md:15 links to specs/DELETED_FILE.md (file missing)
   - host-backend/app/routes/chat.py:8 imports removed_module (module missing)

3. UNUSED DEPENDENCIES
   - requirements.txt: "some-package" not imported anywhere
   - package.json: "unused-lib" not imported anywhere

4. DOCUMENTATION DRIFT
   - docs/specs/API.md documents POST /api/v1/workflows but no route exists
   - docs/guides/SETUP.md references ./setup-workflow.sh (file missing)

5. MODULARITY ISSUES
   - host-backend/app/services/big_service.py has 800+ lines (consider splitting)
   - frontend/src/components/GodComponent.js exports 12 components

Each item includes: file path, line number (if applicable), one-line reason.
Total: X issues found across Y files.
```

### Phase 3: CONFIRM

Present the report to the user. Allow selective exclusion.

```
I found 23 issues across 4 categories. Here's the plan:

DELETE (8 files):
  [x] host-backend/app/models/old_feature.py -- zero imports
  [x] frontend/src/components/Removed.js -- not referenced
  ...

UPDATE (5 files):
  [x] docs/README.md -- remove 3 broken links
  [x] host-backend/app/models/__init__.py -- remove dead import
  ...

SKIP (advisory only, 10 items):
  - requirements.txt: "httpx" appears unused but may be indirect
  - 3 modularity warnings

Would you like to proceed with all checked items, or exclude specific ones?
```

### Phase 4: CLEAN

Execute confirmed removals:

1. Delete confirmed dead files using `Bash("rm ...")`
2. Remove dead imports from `__init__.py` files using `Edit`
3. Fix broken markdown links using `Edit`
4. Update `__init__.py` re-exports to match remaining modules

Important safeguards:
- Never delete files without Phase 3 confirmation
- Never modify files that weren't in the report
- Log every action taken for the verification phase

### Phase 5: VERIFY

Re-scan post-cleanup to catch cascading breaks:

1. Re-run the Phase 1 scan on affected directories only
2. Check that no new broken imports were introduced
3. Verify the app still starts (`python -c "from app.main import app"`)
4. Report: "Cleanup complete. N files removed, M files updated. No cascading breaks detected."

If cascading breaks are found, report them and offer to fix or revert.

## Usage

```
/codemaid                    # Full scan + interactive cleanup
/codemaid scan               # Scan only, no modifications
/codemaid scan docs          # Scan documentation only
/codemaid scan imports       # Scan Python/JS imports only
/codemaid scan deps          # Scan dependency files only
/codemaid report             # Show last scan report
```

## Configuration

The skill respects `.codemaidignore` (same format as `.gitignore`) if present:

```
# .codemaidignore
node_modules/
.venv/
__pycache__/
*.pyc
dist/
build/
```

## Integration with Claude Flow

When used within a Claude Flow swarm, CodeMaid can:
- Run as a post-commit hook to catch new dead code
- Feed results into the `optimize` background worker
- Store findings in memory for cross-session tracking
- Trigger `testgaps` worker when files are removed

## Competitive Advantages

| Feature | CodeMaid | code-simplifier | docs-cleaner | CodeAnt |
|---------|----------|----------------|--------------|---------|
| Dead file detection | Yes | No | No | Yes |
| Doc link validation | Yes | No | Yes | No |
| Cross-ref engine | Yes | No | No | Partial |
| Interactive confirm | Yes | N/A | No | No |
| Full-stack (Py+JS+MD) | Yes | JS only | MD only | Multi |
| Post-cleanup verify | Yes | No | No | No |
| Claude Code native | Yes | Yes | Yes | No |
