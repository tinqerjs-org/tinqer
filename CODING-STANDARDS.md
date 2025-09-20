# Coding Standards

This document outlines the coding standards and patterns used throughout the Tinqer codebase. All contributors should follow these guidelines to maintain consistency and quality.

## Core Principles

### 1. Functional Programming First

**PREFER FUNCTIONS OVER CLASSES** - Export functions from modules when possible. Classes should only be used when they provide clear benefits.

```typescript
// ✅ Good - Pure function with explicit dependencies
export function where<T>(
  query: Query<T>,
  predicate: (item: T) => boolean
): Query<T> {
  // Implementation
}

// ❌ Bad - Class used unnecessarily for stateless operations
export class QueryBuilder<T> {
  where(predicate: (item: T) => boolean): QueryBuilder<T> {
    // This doesn't need to be a class
  }
}
```

### 2. Explicit Error Handling with Result Types

Use `Result<T>` for all operations that can fail. Never throw exceptions for expected errors.

```typescript
// Result type definition (in types.ts)
export interface QueryError {
  code: string;
  message: string;
}

export type Result<T, E = QueryError> =
  | { success: true; data: T }
  | { success: false; error: E };

// ✅ Good - Using Result type
export function parseQuery(
  sql: string
): Result<ParsedQuery> {
  try {
    const parsed = parseSql(sql);

    if (!parsed.isValid) {
      return failure({
        code: "INVALID_SQL",
        message: "Invalid SQL syntax",
      });
    }

    return success(parsed);
  } catch (error) {
    return failure({
      code: "PARSE_ERROR",
      message: error.message,
    });
  }
}

// ❌ Bad - Throwing exceptions
export function parseQuery(sql: string): ParsedQuery {
  const parsed = parseSql(sql);
  if (!parsed.isValid) throw new Error("Invalid SQL syntax");
  return parsed;
}
```

### 3. Type-Safe Query Building

All query operations must maintain type safety:

```typescript
// ✅ Good - Type-safe column references
type User = {
  id: number;
  name: string;
  email: string;
};

const query = from<User>("users")
  .select(["id", "name"]) // Only allows keyof User
  .where(u => u.id > 100); // u is typed as User

// ❌ Bad - String-based columns without type checking
const query = from("users")
  .select(["id", "username"]) // No type checking
  .where("id > 100"); // String predicates
```

### 4. Module Structure

#### Imports

All imports MUST include the `.js` extension:

```typescript
// ✅ Good
import { createQuery } from "./core/query.js";
import { PostgresProvider } from "./providers/postgres.js";
import { Result } from "./types.js";

// ❌ Bad
import { createQuery } from "./core/query";
import { PostgresProvider } from "./providers/postgres";
```

#### Exports

Use named exports, avoid default exports:

```typescript
// ✅ Good
export function select() { ... }
export function where() { ... }
export type Query<T> = { ... };

// ❌ Bad
export default class QueryBuilder { ... }
```

### 5. Naming Conventions

#### General Rules

- **Functions**: camelCase (`createQuery`, `buildExpression`, `toSql`)
- **Types/Interfaces**: PascalCase (`Query`, `Expression`, `SqlProvider`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_QUERY_DEPTH`, `DEFAULT_LIMIT`)
- **Files**: kebab-case (`create-query.ts`, `sql-provider.ts`)

### 6. TypeScript Guidelines

#### Strict Mode

Always use TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### Type vs Interface

Prefer `type` over `interface`:

```typescript
// ✅ Good - Using type
type Query<T> = {
  from: string;
  select: (keyof T)[];
  where?: Expression<T>;
  orderBy?: OrderBy<T>[];
};

type SqlDialect = "postgres" | "mysql" | "sqlite";

// Use interface only for extensible contracts
interface SqlProvider {
  toSql<T>(query: Query<T>): string;
  escapeIdentifier(name: string): string;
}
```

#### Avoid `any`

Never use `any`. Use `unknown` if type is truly unknown:

```typescript
// ✅ Good
function processValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return JSON.stringify(value);
}

// ❌ Bad
function processValue(value: any): string {
  return value.toString();
}
```

### 7. Expression Trees

Build type-safe expression trees for query composition:

```typescript
// ✅ Good - Type-safe expression tree
type BinaryOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";
type LogicalOperator = "AND" | "OR";

type Expression<T> =
  | { type: "field"; name: keyof T }
  | { type: "literal"; value: unknown }
  | { type: "binary"; left: Expression<T>; operator: BinaryOperator; right: Expression<T> }
  | { type: "logical"; left: Expression<T>; operator: LogicalOperator; right: Expression<T> }
  | { type: "function"; name: string; args: Expression<T>[] };

// Build expressions programmatically
export function field<T>(name: keyof T): Expression<T> {
  return { type: "field", name };
}

export function literal<T>(value: unknown): Expression<T> {
  return { type: "literal", value };
}

export function eq<T>(left: Expression<T>, right: Expression<T>): Expression<T> {
  return { type: "binary", left, operator: "=", right };
}
```

### 8. SQL Provider Pattern

```typescript
// ✅ Good - Provider pattern for SQL dialects
export type SqlProvider = {
  escapeIdentifier: (name: string) => string;
  escapeLiteral: (value: unknown) => string;
  buildSelect: <T>(query: Query<T>) => string;
  buildWhere: <T>(expression: Expression<T>) => string;
  buildOrderBy: <T>(orderBy: OrderBy<T>[]) => string;
};

export const postgresProvider: SqlProvider = {
  escapeIdentifier: (name) => `"${name.replace(/"/g, '""')}"`,
  escapeLiteral: (value) => {
    if (value === null) return "NULL";
    if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
    return String(value);
  },
  buildSelect: (query) => {
    // PostgreSQL-specific SELECT building
  },
  buildWhere: (expression) => {
    // PostgreSQL-specific WHERE building
  },
  buildOrderBy: (orderBy) => {
    // PostgreSQL-specific ORDER BY building
  }
};
```

### 9. Testing

```typescript
import { expect } from "chai";
import { describe, it } from "mocha";

describe("Query Builder", () => {
  describe("select", () => {
    it("should generate correct SQL for simple select", () => {
      const query = from<User>("users")
        .select(["id", "name"])
        .toSql(postgresProvider);

      expect(query).to.equal('SELECT "id", "name" FROM "users"');
    });

    it("should handle where clauses", () => {
      const query = from<User>("users")
        .select(["id", "name"])
        .where(u => u.id > 100)
        .toSql(postgresProvider);

      expect(query).to.equal('SELECT "id", "name" FROM "users" WHERE "id" > 100');
    });
  });

  describe("expression building", () => {
    it("should build complex expressions", () => {
      const expr = and(
        eq(field<User>("id"), literal(1)),
        like(field<User>("name"), literal("John%"))
      );

      const sql = postgresProvider.buildWhere(expr);
      expect(sql).to.equal('WHERE "id" = 1 AND "name" LIKE \'John%\'');
    });
  });
});
```

### 10. Documentation

Add JSDoc comments for exported functions:

```typescript
/**
 * Creates a new query for the specified table.
 *
 * @param table - The table name to query from
 * @returns A new Query object with fluent API for building queries
 *
 * @example
 * ```typescript
 * const query = from<User>("users")
 *   .select(["id", "name"])
 *   .where(u => u.email.endsWith("@example.com"))
 *   .orderBy("name", "asc")
 *   .limit(10);
 * ```
 */
export function from<T>(table: string): Query<T> {
  return createQuery<T>(table);
}

/**
 * Builds a SQL WHERE clause from an expression tree.
 *
 * @param expression - The expression tree to convert
 * @param provider - The SQL dialect provider
 * @returns The SQL WHERE clause as a string
 */
export function buildWhere<T>(
  expression: Expression<T>,
  provider: SqlProvider
): string {
  // Implementation
}
```

### 11. Performance Patterns

#### Query Optimization

```typescript
// ✅ Good - Build SQL once
const query = from<User>("users")
  .select(["id", "name"])
  .where(u => u.active === true)
  .orderBy("created_at", "desc");

const sql = query.toSql(provider); // Build SQL once
const results = await db.query(sql);

// ❌ Bad - Rebuilding SQL multiple times
for (const id of userIds) {
  const sql = from<User>("users")
    .select(["*"])
    .where(u => u.id === id)
    .toSql(provider); // Rebuilds SQL each iteration

  const result = await db.query(sql);
}
```

#### Expression Reuse

```typescript
// ✅ Good - Reuse common expressions
const activeUserExpr = eq(field<User>("active"), literal(true));
const verifiedExpr = eq(field<User>("verified"), literal(true));

const activeUsers = from<User>("users")
  .where(activeUserExpr);

const activeVerifiedUsers = from<User>("users")
  .where(and(activeUserExpr, verifiedExpr));
```

### 12. Type Inference

Leverage TypeScript's type inference:

```typescript
// ✅ Good - Let TypeScript infer types
export function select<T, K extends keyof T>(
  query: Query<T>,
  columns: K[]
): Query<Pick<T, K>> {
  // Returns a query with only selected columns
}

// Usage - type is inferred as Query<{id: number, name: string}>
const query = from<User>("users")
  .select(["id", "name"]);

// ❌ Bad - Over-specifying types
const query: Query<Pick<User, "id" | "name">> = from<User>("users")
  .select<User, "id" | "name">(["id", "name"]);
```

## Code Review Checklist

Before submitting a PR, ensure:

- [ ] All functions use Result types for error handling
- [ ] No classes used unless necessary
- [ ] All imports include `.js` extension
- [ ] SQL generation is type-safe
- [ ] JSDoc comments for public functions
- [ ] No `any` types used
- [ ] Unit tests included
- [ ] No console.log statements
- [ ] Follows functional programming principles
- [ ] Type inference leveraged where possible