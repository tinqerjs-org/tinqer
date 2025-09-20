# Implementation Plan

## Current State
- All old implementation code has been deleted
- Only type definitions remain in `packages/tinqer/src/types/`:
  - `grouping.ts` - IGrouping interface matching .NET
  - `linq-interfaces.ts` - Complete LINQ-compatible interfaces
  - `query-operations.ts` - Expression tree operation nodes
- Documentation is complete:
  - `README.md` - User-facing documentation with examples
  - `ARCHITECTURE.md` - System design and components
  - `CODING-STANDARDS.md` - Development guidelines
  - `CLAUDE.md` - AI assistant instructions

## Implementation Order

### Phase 1: Core Expression Types
1. Create `packages/tinqer/src/types/expressions.ts`
   - Define all expression types (Constant, Parameter, Member, Binary, etc.)
   - Use discriminated unions for type safety
   - Include parameter origin tracking

### Phase 2: Parser Infrastructure
1. Create `packages/tinqer/src/parser/oxc-parser.ts`
   - Wrapper around OXC WASM parser
   - Parse TypeScript/JavaScript to AST

2. Create `packages/tinqer/src/converter/ast-converter.ts`
   - Convert OXC AST to expression trees
   - Handle parameter origin tracking
   - Extract lambda bodies

3. Create `packages/tinqer/src/parser/parser.ts`
   - High-level parsing API
   - Coordinate parser and converter

### Phase 3: Queryable Implementation
1. Create `packages/tinqer/src/queryable/queryable.ts`
   - Main Queryable class with expression tree operations
   - OrderedQueryable for thenBy support
   - TerminalQuery for terminal operations
   - from() factory function

2. Create `packages/tinqer/src/index.ts`
   - Export public API

### Phase 4: SQL Adapter
1. Create `packages/tinqer-sql-pg-promise/src/sql-generator.ts`
   - Convert expression trees to PostgreSQL
   - Handle parameter binding with :paramName format
   - Table aliasing (t0, t1, etc.)

2. Create `packages/tinqer-sql-pg-promise/src/index.ts`
   - Export query function
   - Coordinate parsing and SQL generation

### Phase 5: Testing Infrastructure
1. Create `packages/tinqer/tests/utils/tree-helpers.ts`
   - Helper functions to create expression trees
   - Must create identical structures to parser

2. Create test files:
   - `basic.test.ts` - Simple queries
   - `where.test.ts` - WHERE clause tests
   - `select.test.ts` - Projection tests
   - `join.test.ts` - JOIN tests
   - `groupby.test.ts` - GROUP BY tests
   - `terminal.test.ts` - Terminal operations

## Key Design Decisions

### Expression Tree Architecture
- Each operation wraps its source (nested tree structure)
- Preserves complete operation chain
- No flattening into arrays

### Type Safety
- Discriminated unions for expressions
- Phantom types to preserve type information
- Strict TypeScript with no `any` types

### Terminal Operations
- Return `TerminalQuery<T>` not `Queryable<T>`
- Preserve result type (number for count, boolean for any, etc.)

### LINQ Compatibility
- Method signatures match .NET exactly
- IGrouping interface for grouped data
- OrderedQueryable for thenBy operations

## Critical Requirements

1. **No Closure Variables** - Lambdas cannot access outer scope
2. **Runtime Parsing** - Functions parsed from string representation
3. **Generic Expressions** - Simple cases are special cases of generic
4. **Parameter Origins** - Track where each parameter comes from
5. **Expression Tree Preservation** - Maintain complete operation order

## Files to Create

```
packages/tinqer/src/
├── types/
│   ├── expressions.ts         [NEW]
│   ├── grouping.ts            [EXISTS]
│   ├── linq-interfaces.ts     [EXISTS]
│   └── query-operations.ts    [EXISTS]
├── parser/
│   ├── oxc-parser.ts          [NEW]
│   └── parser.ts              [NEW]
├── converter/
│   └── ast-converter.ts       [NEW]
├── queryable/
│   └── queryable.ts           [NEW]
└── index.ts                   [NEW]

packages/tinqer-sql-pg-promise/src/
├── sql-generator.ts           [NEW]
└── index.ts                   [NEW]

packages/tinqer/tests/
├── utils/
│   └── tree-helpers.ts        [NEW]
├── basic.test.ts              [NEW]
├── where.test.ts              [NEW]
├── select.test.ts             [NEW]
├── join.test.ts               [NEW]
├── groupby.test.ts            [NEW]
└── terminal.test.ts           [NEW]
```

## Success Criteria

1. All operations maintain type safety
2. Expression trees preserve operation order
3. SQL generation handles all expression types
4. Tests use tree helpers exclusively
5. No `any` types in codebase
6. Matches LINQ API signatures