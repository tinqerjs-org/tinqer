# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Tinqer codebase.

## Critical Guidelines

### NEVER ACT WITHOUT EXPLICIT USER APPROVAL

**YOU MUST ALWAYS ASK FOR PERMISSION BEFORE:**

- Making architectural decisions or changes
- Implementing new features or functionality
- Modifying APIs, interfaces, or data structures
- Changing expected behavior or test expectations
- Adding new dependencies or patterns

**ONLY make changes AFTER the user explicitly approves.** When you identify issues or potential improvements, explain them clearly and wait for the user's decision. Do NOT assume what the user wants or make "helpful" changes without permission.

### ANSWER QUESTIONS AND STOP

**CRITICAL RULE**: If the user asks you a question - whether as part of a larger text or just the question itself - you MUST:

1. **Answer ONLY that question**
2. **STOP your response completely**
3. **DO NOT continue with any other tasks or implementation**
4. **DO NOT proceed with previous tasks**
5. **Wait for the user's next instruction**

This applies to ANY question, even if it seems like part of a larger task or discussion.

### FINISH DISCUSSIONS BEFORE WRITING CODE

**IMPORTANT**: When the user asks a question or you're in the middle of a discussion, DO NOT jump to writing code. Always:

1. **Complete the discussion first** - Understand the problem fully
2. **Analyze and explain** - Work through the issue verbally
3. **Get confirmation** - Ensure the user agrees with the approach
4. **Only then write code** - After the user explicitly asks you to implement

### STOP AND DISCUSS FUNDAMENTAL ISSUES

**CRITICAL**: If you discover fundamental architectural issues or parser limitations:

1. **STOP IMMEDIATELY** - Do not proceed with workarounds or hacks
2. **Explain the issue clearly** - Show exactly what information is being lost
3. **Discuss proper solutions** - Work with the user to identify the correct fix
4. **Never implement hacks** - No "clever" workarounds for parser/architecture problems
5. **Fix the root cause** - Address issues at their source, not with band-aids

### NEVER USE MULTIEDIT

**NEVER use the MultiEdit tool.** It has caused issues in multiple projects. Always use individual Edit operations instead, even if it means more edits. This ensures better control and prevents unintended changes.

### ⚠️ NEVER USE AUTOMATED SCRIPTS FOR FIXES ⚠️

**🚨 CRITICAL RULE: NEVER EVER attempt automated fixes via scripts or mass updates. 🚨**

This is a **MANDATORY** requirement that you **MUST NEVER** violate:

- **NEVER** create scripts to automate replacements (JS, Python, shell, etc.)
- **NEVER** use sed, awk, grep, or other text processing tools for bulk changes
- **NEVER** use xargs, find -exec, or any other batch processing commands
- **NEVER** write code that modifies multiple files automatically
- **NEVER** do "mass updates" or "bulk replacements" of any kind
- **ALWAYS** make changes manually using the Edit tool
- **Even if there are hundreds of similar changes, do them ONE BY ONE**

**WHY THIS IS CRITICAL:**

- Automated scripts break syntax in unpredictable ways
- Pattern matching fails on edge cases
- Mass updates destroy the codebase
- Manual edits ensure accuracy and preserve context
- You WILL mess up the code if you violate this rule

This ensures accuracy and prevents cascading errors from incorrect pattern matching.

## Session Startup & Task Management

### First Steps When Starting a Session

When you begin working on this project, you MUST:

1. **Read this entire CLAUDE.md file** to understand the project structure and conventions
2. **Check for ongoing tasks in `.todos/` directory** - Look for any in-progress task files
3. **Read the key documentation files** in this order:
   - `/README.md` - Project overview and API specification
   - `/CODING-STANDARDS.md` - Mandatory coding patterns and conventions
   - `/ARCHITECTURE.md` - System architecture and design decisions

Only after reading these documents should you proceed with any implementation or analysis tasks.

**IMPORTANT**: After every conversation compact/summary, you MUST re-read this CLAUDE.md file again as your first action.

### Task Management with .todos Directory

**For major multi-step tasks that span sessions:**

1. **Before starting**, create a detailed task file in `.todos/` directory:
   - Filename format: `YYYY-MM-DD-task-name.md` (e.g., `2025-01-13-sql-generation.md`)
   - Include ALL context, decisions, completed work, and remaining work
   - Write comprehensively so the task can be resumed in any future session

2. **Task file must include**:
   - Task overview and objectives
   - Current status (what's been completed)
   - Detailed list of remaining work
   - Important decisions made
   - Code locations affected
   - Testing requirements
   - Any gotchas or special considerations

3. **When resuming work**, always check `.todos/` first for in-progress tasks
4. **Update the task file** as you make progress
5. **Mark as complete** by renaming to `YYYY-MM-DD-task-name-COMPLETED.md`

The `.todos/` directory is gitignored for persistent task tracking across sessions.

## Project Overview & Principles

Tinqer is a LINQ-to-SQL query builder for TypeScript that provides type-safe, composable query construction using lambda expressions parsed at runtime. For project overview, see [README.md](../README.md).

### Greenfield Development Context

**IMPORTANT**: Tinqer is a greenfield project with no legacy constraints:

- **No backward compatibility concerns** - No existing deployments or users to migrate
- **No legacy code patterns** - All code should follow current best practices without compromise
- **No migration paths needed** - APIs and data structures can be designed optimally
- **Write code as if starting fresh** - Every implementation should be clean and modern
- **No change tracking in comments** - Avoid "changed from X to Y" since there is no "previous" state
- **No deprecation warnings** - Nothing is deprecated because nothing is legacy

This means: Focus on clean, optimal implementations without worrying about existing systems. Design for the ideal case, not for compatibility.

### Documentation & Code Principles

**Documentation Guidelines:**

- Write as if the spec was designed from the beginning, not evolved over time
- Avoid phrases like "now allows", "changed from", "previously was"
- Present features and constraints as inherent design decisions
- Be concise and technical - avoid promotional language, superlatives
- Use active voice and include code examples
- Keep README.md as single source of truth

**Code Principles:**

- **NO BACKWARDS COMPATIBILITY** - Do not write backwards compatibility code
- **PREFER FUNCTIONS OVER CLASSES** - Export functions from modules when possible, use classes only when beneficial for stateful connections or complex state management
- **NO DYNAMIC IMPORTS** - Always use static imports, never `await import()` or `import()` in the code
- **STRICT TYPING REQUIRED** - No `any` types allowed. All code must be strictly typed. ESLint rule `@typescript-eslint/no-explicit-any` must be set to "error"
- Use pure functions with explicit dependency injection
- Prefer `type` over `interface` (use `interface` only for extensible contracts)

## Key Technical Decisions

### Security: Never Use npx

**CRITICAL SECURITY REQUIREMENT**: NEVER use `npx` for any commands. This poses grave security risks by executing arbitrary code.

- **ALWAYS use exact dependency versions** in package.json
- **ALWAYS use local node_modules binaries** (e.g., `prettier`, `mocha`)
- **NEVER use `npx prettier`** - use `prettier` from local dependencies
- **NEVER use `npx mocha`** - use `mocha` from local dependencies

**Exception**: Only acceptable `npx` usage is for one-time project initialization when explicitly setting up new projects.

### ESM Modules

- **All imports MUST include `.js` extension**: `import { foo } from "./bar.js"`
- **TypeScript configured for `"module": "NodeNext"`**
- **Type: `"module"` in all package.json files**
- **NO DYNAMIC IMPORTS**: Always use static imports. Never use `await import()` or `import()` in the code

## Essential Commands & Workflow

### Build & Development Commands

```bash
# Build entire project (from root)
./scripts/build.sh              # Standard build with formatting
./scripts/build.sh --no-format  # Skip prettier formatting (faster builds during development)

# Clean build artifacts
./scripts/clean.sh
./scripts/clean.sh --all        # Also remove node_modules

# Lint entire project
./scripts/lint-all.sh           # Run ESLint on all packages
./scripts/lint-all.sh --fix     # Run ESLint with auto-fix

# Format code with Prettier (MUST run before committing)
./scripts/format-all.sh         # Format all files
./scripts/format-all.sh --check # Check formatting without changing files

# Run tests
npm test                        # Run all tests
npm run test:watch             # Run tests in watch mode
npm run test:grep -- "pattern" # Run specific tests matching pattern
```

### Testing Commands

```bash
# Run specific tests (fast)
npm run test:grep -- "pattern to match"

# Examples:
npm run test:grep -- "should handle COUNT with GROUP BY"
npm run test:grep -- "WHERE"
npm run test:grep -- "JOIN"
```

**IMPORTANT**: When running tests with mocha, always use `npm run test:grep -- "pattern"` from the root directory for specific tests. NEVER use `2>&1` redirection with mocha commands. Use `| tee` for output capture.

### Git Workflow

**CRITICAL GIT SAFETY RULES**:

1. **NEVER use `git push --force` or `git push -f`** - Force pushing destroys history
2. **NEVER use `git push origin --delete`** - Never delete remote branches
3. **NEVER perform ANY destructive operations on remote repositories**
4. **ONLY allowed remote operation is standard `git push` or `git push -u origin branch-name`**
5. **ALL git push commands require EXPLICIT user authorization**
6. **Use revert commits instead of force push** - To undo changes, create revert commits
7. **If you need to overwrite remote**, explain consequences and get explicit confirmation

**IMPORTANT**: NEVER commit, push, revert, or perform ANY git operations without explicit user permission. You are ONLY allowed to delete LOCAL branches with `git branch -D`, NEVER remote branches.

**NEW BRANCH REQUIREMENT**: ALL changes must be made on a new feature branch, never directly on main.

When the user asks you to commit and push:

1. Run `./scripts/format-all.sh` to format all files with Prettier
2. Run `./scripts/lint-all.sh` to ensure code passes linting
3. Follow the git commit guidelines in the main Claude system prompt
4. Get explicit user confirmation before any `git push`
5. Use only standard push commands - no force flags, no delete operations

## Core Architecture

For detailed architecture information, see `/ARCHITECTURE.md` and `/README.md`.

Key concepts:

- **Parser**: Uses OXC parser to convert lambda expressions to AST
- **Expression Trees**: Type-safe representation of query operations
- **Queryable**: Fluent API for building queries
- **SQL Adapters**: Convert expression trees to database-specific SQL

### Package Structure

```
packages/
├── tinqer/                    # Core library with parser and query builder
│   ├── src/
│   │   ├── parser/           # OXC parser wrapper
│   │   ├── converter/        # AST to expression tree converter
│   │   ├── queryable/        # Fluent query API
│   │   └── types/           # TypeScript type definitions
│   └── tests/
└── tinqer-sql-pg-promise/    # PostgreSQL adapter using pg-promise
```

## Code Patterns

### Import Patterns

```typescript
// Always include .js extension
import { Queryable } from "./queryable/queryable.js";
import type { Expression } from "./types/expressions.js";
```

### Expression Tree Pattern

```typescript
// Direct object construction with explicit parameters
const param = { type: "parameter", name: "u", origin: { type: "table", ref: "users" } };
const member = { type: "member", property: "age", object: param };
const constant = { type: "constant", value: 18 };
const comparison = { type: "binary", operator: ">=", left: member, right: constant };
```

## Testing & Development Optimization

### Test Output Strategy

**For full test suites**, use `tee` to display output AND save to file:

```bash
# Create .tests directory if it doesn't exist (gitignored)
mkdir -p .tests

# Run full test suite with tee - shows output to user AND saves to file
npm test | tee .tests/run-$(date +%s).txt

# Then analyze saved output without re-running tests:
grep "failing" .tests/run-*.txt
tail -50 .tests/run-*.txt
grep -A10 "specific test name" .tests/run-*.txt
```

**NEVER use plain redirection (`>` or `2>&1`)** - use `tee` for real-time output visibility.

### Analysis Working Directory

**For long-running analysis, research, or documentation tasks**, use `.analysis/` directory:

```bash
# Create .analysis directory if it doesn't exist (gitignored)
mkdir -p .analysis

# Examples of analysis work:
# - Code complexity reports
# - API documentation generation
# - Dependency analysis
# - Performance profiling results
# - Architecture diagrams and documentation
# - SQL generation analysis
# - Parser output investigations
```

Benefits: Keeps analysis artifacts separate from source code, allows iterative work without cluttering repository.

### Build & Lint Workflow

**ALWAYS follow this sequence:**

1. Run `./scripts/lint-all.sh` first
2. Run `./scripts/build.sh`
3. **If build fails and you make changes**: You MUST run `./scripts/lint-all.sh` again before building

**TIP**: Use `./scripts/build.sh --no-format` during debugging sessions to skip prettier formatting for faster builds.

### Text Replacement Guidelines

**NEVER use `sed` for text replacements**. Always use the Edit or MultiEdit tools to make changes manually. This ensures better control and prevents unintended replacements.

## Test Files Convention

**NEVER create temporary test scripts in the root directory**. Test files belong in:

- `packages/tinqer/tests/` - Core library tests
- `packages/tinqer-sql-pg-promise/tests/` - SQL adapter tests

**Temporary debugging scripts** should be created in `.analysis/` directory (gitignored).

## Common Issues

For troubleshooting common issues, refer to:

- Parser errors: Check lambda syntax and supported features
- Expression tree mismatches: Verify parameter origins
- Test failures: Ensure helper functions use explicit object parameters
- Build errors: Check ESM import extensions (.js)

## Additional Resources

- `/CODING-STANDARDS.md` - Detailed coding conventions
- `/ARCHITECTURE.md` - System design and implementation details
- `/README.md` - Project overview and usage examples
