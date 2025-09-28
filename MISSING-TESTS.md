# Missing Integration Tests

This document outlines integration tests that should be added to the Tinqer test suite. These tests were identified by analyzing the tinqer-rearchitect branch and identifying gaps in current test coverage.

## High Priority Tests (Security & Correctness)

### 1. SQL Injection Prevention Tests

**File:** `packages/tinqer-sql-pg-promise/tests/sql-injection-prevention.test.ts`

Critical tests to ensure all user input is properly parameterized:

- String literals containing SQL keywords (DROP TABLE, UNION SELECT, OR 1=1)
- Special characters and escape sequences (single quotes, backslashes, newlines)
- Comment injection attempts (--, /\* \*/, #)
- Numeric injection attempts
- Unicode and encoding attacks
- Boolean-based blind injection patterns
- Stacked query attempts (semicolons)
- NULL byte injection
- Hexadecimal and encoded injection

### 2. Date/Time Operations Tests

**File:** Add to existing test files or create `date-time-operations.test.ts`

Currently missing entirely:

- Date equality and inequality comparisons
- Date range queries with AND/OR
- Date with time components (millisecond precision)
- NULL date handling (IS NULL, IS NOT NULL, COALESCE)
- Date in ORDER BY clauses
- Date in SELECT projections
- Relative date comparisons (Date.now(), date arithmetic)
- Edge cases (leap years, DST transitions, year boundaries)
- Very old and future dates
- Complex date queries with nested conditions

### 3. Advanced Boolean Operations Tests

**File:** Add to existing `where.test.ts` and `where-complex.test.ts`

Expand coverage for:

- Direct boolean column usage without comparison (`x => x.isActive`)
- Negated boolean columns (`x => !x.isDeleted`)
- Complex boolean logic with multiple columns
- XOR-like patterns
- NOT operator with complex expressions
- Double and triple negation
- De Morgan's law patterns
- Boolean with NULL handling
- Boolean in SELECT projections
- Boolean in ORDER BY
- NAND, NOR patterns
- Boolean algebra (implication, equivalence)

## Medium Priority Tests (Functionality)

### 4. Hierarchical/Self-Referential Data Tests

**File:** Create `hierarchical-data.test.ts`

For tree-structured data:

- Finding root nodes (parentId IS NULL)
- Finding children of specific parent
- Finding leaf nodes
- Self-joins (categories with parents, employees with managers)
- Path-based queries (path LIKE patterns)
- Level-based queries
- Organizational hierarchy patterns
- Comment thread patterns
- Tree traversal patterns
- Performance-oriented hierarchical queries

### 5. Advanced Pagination Patterns Tests

**File:** Add to existing `skip.test.ts` and `take.test.ts`

Beyond basic SKIP/TAKE:

- Cursor-based pagination (ID cursor, composite cursor)
- Keyset pagination (single and multi-column)
- Pagination with aggregates and GROUP BY
- Pagination with JOIN
- Pagination with DISTINCT
- Dynamic page sizes
- Last page detection
- Bidirectional pagination
- Performance-optimized patterns (avoiding large offsets)

### 6. Search Pattern Tests

**File:** Add to existing `string-operations.test.ts`

Complex search scenarios:

- Case-insensitive search (toLowerCase/toUpperCase)
- Multi-field search with OR
- Fuzzy search patterns
- Search with filtering (price ranges, categories)
- Search result ranking/ordering
- Tag-based search
- Search with exclusions (NOT LIKE)
- Exact phrase search
- Word boundary patterns
- Search performance patterns

### 7. Advanced NULL Handling Tests

**File:** Add to existing `null-handling.test.ts` and `null-coalescing-simple.test.ts`

Complex NULL scenarios:

- NULL in arithmetic operations (+, -, \*, /)
- NULL in string concatenation
- Three-valued logic (NULL AND/OR/NOT)
- COALESCE with multiple values
- NULL in aggregate functions (SUM, AVG, COUNT, MIN, MAX)
- NULL in JOIN conditions
- NULL in GROUP BY keys
- NULL ordering in ORDER BY
- NULL in DISTINCT
- Conditional NULL assignment
- NULL-safe equality patterns

### 8. Numeric Edge Cases Extended Tests

**File:** Add to existing `edge-cases.test.ts` and `edge-cases-advanced.test.ts`

Numeric boundaries and precision:

- JavaScript numeric limits (MAX_SAFE_INTEGER, MIN_SAFE_INTEGER)
- Zero and negative zero
- Floating point precision issues
- Scientific notation
- Division by zero prevention
- Modulo operations
- Type coercion edge cases
- Numeric comparisons with tolerance
- Special values (Infinity, -Infinity, NaN)

## Lower Priority Tests

### 9. Complex Aggregate Tests

Add to existing `aggregates.test.ts`:

- Nested aggregate patterns
- Conditional aggregates
- Multiple aggregates in single query
- Aggregates with DISTINCT
- Aggregates with complex expressions
- Running totals patterns
- Percentile calculations

### 10. Performance Pattern Tests

Create `performance-patterns.test.ts`:

- Index-friendly query patterns
- Query optimization patterns
- Efficient JOIN patterns
- EXISTS vs IN patterns
- Covering index patterns

### 11. Error Handling Tests

Create `error-handling.test.ts`:

- Invalid column names
- Invalid table names
- Type mismatches
- Constraint violation patterns

### 12. Advanced JOIN Tests

Add to existing `join.test.ts`:

- Multiple JOINs (3+ tables)
- Self-joins
- Complex ON conditions
- JOIN with OR conditions
- JOIN with aggregates

## Implementation Notes

1. **Test Format:** All tests should follow the existing pattern using the `query` function and test schema
2. **Import Pattern:** Use `import { query } from "../dist/index.js"` and `import { db, from } from "./test-schema.js"`
3. **Assertions:** Check both SQL string generation and parameter values
4. **Coverage:** Each test should cover both the positive case and edge cases
5. **Documentation:** Include clear descriptions of what each test validates

## Priority Order for Implementation

1. **Immediate:** SQL Injection Prevention (security critical)
2. **High:** Date/Time Operations (common use case, completely missing)
3. **High:** Boolean Operations (expand existing)
4. **Medium:** NULL Handling (expand existing)
5. **Medium:** Search Patterns (expand existing)
6. **Lower:** Other specialized patterns

## Existing Test Files to Expand

These existing test files should be expanded with the tests listed above:

- `where.test.ts` - Boolean operations
- `where-complex.test.ts` - Complex boolean logic
- `string-operations.test.ts` - Search patterns
- `null-handling.test.ts` - NULL operations
- `null-coalescing-simple.test.ts` - COALESCE patterns
- `edge-cases.test.ts` - Numeric edge cases
- `edge-cases-advanced.test.ts` - More numeric edge cases
- `aggregates.test.ts` - Aggregate functions
- `join.test.ts` - JOIN operations
- `skip.test.ts` / `take.test.ts` - Pagination
