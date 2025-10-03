[← Back to README](../README.md)

# Tinqer API Reference

Complete API reference for execution functions, type utilities, and helper APIs.

## Table of Contents

- [1. Execution APIs](#1-execution-apis)
  - [1.1 selectStatement](#11-selectstatement)
  - [1.2 executeSelect](#12-executeselect)
  - [1.3 executeSelectSimple](#13-executeselectsimple)
  - [1.4 CRUD Execution Functions](#14-crud-execution-functions)
  - [1.5 toSql](#15-tosql)
- [2. Type-Safe Contexts](#2-type-safe-contexts)
  - [2.1 createContext](#21-createcontext)
- [3. Helper Utilities](#3-helper-utilities)
  - [3.1 createQueryHelpers](#31-createqueryhelpers)

---

## 1. Execution APIs

### 1.1 selectStatement

Converts a queryable expression tree into a SQL statement with parameters.

**Function Signature:**

```typescript
function selectStatement<TResult>(
  queryable: Queryable<TResult>,
  adapter: SQLAdapter,
): { sql: string; params: unknown[] };
```

**Parameters:**

- `queryable`: The `Queryable<TResult>` object representing your query
- `adapter`: SQL adapter for your database (e.g., `pgPromiseAdapter`, `betterSqlite3Adapter`)

**Returns:**

- Object with `sql` (parameterized SQL string) and `params` (ordered array of parameter values)

**Example:**

```typescript
import { Queryable } from "tinqer";
import { selectStatement } from "tinqer-sql-pg-promise";

const query = new Queryable<{ users: User }>("users").where((u) => u.age >= 18).select((u) => u);

const { sql, params } = selectStatement(query, pgPromiseAdapter);
// sql: "SELECT u.* FROM users AS u WHERE u.age >= $1"
// params: [18]
```

---

### 1.2 executeSelect

Executes a SELECT query and returns results with parameter information.

**Function Signature:**

```typescript
async function executeSelect<TResult>(
  queryable: Queryable<TResult>,
  db: IDatabase<unknown>,
  adapter: SQLAdapter,
): Promise<{ results: TResult[]; params: unknown[] }>;
```

**Parameters:**

- `queryable`: The `Queryable<TResult>` representing your query
- `db`: Database connection (pg-promise `IDatabase` instance)
- `adapter`: SQL adapter (e.g., `pgPromiseAdapter`)

**Returns:**

- Promise resolving to object with:
  - `results`: Array of query results typed as `TResult[]`
  - `params`: Array of parameter values used in the query

**Example:**

```typescript
import { Queryable } from "tinqer";
import { executeSelect, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const query = new Queryable<{ users: User }>("users")
  .where((u) => u.age >= 18)
  .select((u) => ({ id: u.id, name: u.name }));

const { results, params } = await executeSelect(query, db, pgPromiseAdapter);
// results: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
// params: [18]
```

---

### 1.3 executeSelectSimple

Simplified execution that returns only the results array.

**Function Signature:**

```typescript
async function executeSelectSimple<TResult>(
  queryable: Queryable<TResult>,
  db: IDatabase<unknown>,
  adapter: SQLAdapter,
): Promise<TResult[]>;
```

**Parameters:**

- `queryable`: The `Queryable<TResult>` representing your query
- `db`: Database connection
- `adapter`: SQL adapter

**Returns:**

- Promise resolving directly to results array typed as `TResult[]`

**Example:**

```typescript
import { Queryable } from "tinqer";
import { executeSelectSimple, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const query = new Queryable<{ users: User }>("users")
  .where((u) => u.age >= 18)
  .select((u) => u.name);

const names = await executeSelectSimple(query, db, pgPromiseAdapter);
// names: ["Alice", "Bob", "Charlie"]
```

---

### 1.4 CRUD Execution Functions

Execute INSERT, UPDATE, and DELETE statements.

#### executeInsert

**Function Signature:**

```typescript
async function executeInsert<TSchema, TTable extends keyof TSchema & string>(
  statement: InsertStatement<TSchema, TTable>,
  db: IDatabase<unknown>,
  adapter: SQLAdapter,
): Promise<{ sql: string; params: unknown[]; results: unknown[] }>;
```

**Example:**

```typescript
import { insert } from "tinqer";
import { executeInsert, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const stmt = insert<Schema>("users")
  .values({ name: "Alice", email: "alice@example.com" })
  .returning((u) => u);

const { results, sql, params } = await executeInsert(stmt, db, pgPromiseAdapter);
// results: [{ id: 1, name: "Alice", email: "alice@example.com" }]
```

#### executeUpdate

**Function Signature:**

```typescript
async function executeUpdate<TSchema, TTable extends keyof TSchema & string>(
  statement: UpdateStatement<TSchema, TTable>,
  db: IDatabase<unknown>,
  adapter: SQLAdapter,
): Promise<{ sql: string; params: unknown[]; results: unknown[] }>;
```

**Example:**

```typescript
import { update } from "tinqer";
import { executeUpdate, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const stmt = update<Schema>("users")
  .set({ status: "inactive" })
  .where((u) => u.last_login < params.cutoffDate)
  .returning((u) => u.id);

const { results, sql, params } = await executeUpdate(stmt, db, pgPromiseAdapter, {
  cutoffDate: new Date("2023-01-01"),
});
// results: [{ id: 5 }, { id: 8 }]
```

#### executeDelete

**Function Signature:**

```typescript
async function executeDelete<TSchema, TTable extends keyof TSchema & string>(
  statement: DeleteStatement<TSchema, TTable>,
  db: IDatabase<unknown>,
  adapter: SQLAdapter,
): Promise<{ sql: string; params: unknown[]; results: unknown[] }>;
```

**Example:**

```typescript
import { del } from "tinqer";
import { executeDelete, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const stmt = del<Schema>("users")
  .where((u) => u.status === "deleted")
  .returning((u) => ({ id: u.id, name: u.name }));

const { results, sql, params } = await executeDelete(stmt, db, pgPromiseAdapter);
// results: [{ id: 3, name: "Old User" }]
```

---

### 1.5 toSql

Converts CRUD statements to SQL without executing them.

**Function Signatures:**

```typescript
// For INSERT statements
function toSql<TSchema, TTable extends keyof TSchema & string>(
  statement: InsertStatement<TSchema, TTable>,
  adapter: SQLAdapter,
  params?: Record<string, unknown>,
): { sql: string; params: unknown[] };

// For UPDATE statements
function toSql<TSchema, TTable extends keyof TSchema & string>(
  statement: UpdateStatement<TSchema, TTable>,
  adapter: SQLAdapter,
  params?: Record<string, unknown>,
): { sql: string; params: unknown[] };

// For DELETE statements
function toSql<TSchema, TTable extends keyof TSchema & string>(
  statement: DeleteStatement<TSchema, TTable>,
  adapter: SQLAdapter,
  params?: Record<string, unknown>,
): { sql: string; params: unknown[] };
```

**Example:**

```typescript
import { insert } from "tinqer";
import { toSql, pgPromiseAdapter } from "tinqer-sql-pg-promise";

const stmt = insert<Schema>("users").values({ name: "Alice", age: 30 });

const { sql, params } = toSql(stmt, pgPromiseAdapter);
// sql: "INSERT INTO users (name, age) VALUES ($1, $2) RETURNING *"
// params: ["Alice", 30]
```

---

## 2. Type-Safe Contexts

### 2.1 createContext

Creates a strongly-typed context for working with a specific database schema.

**Function Signature:**

```typescript
function createContext<TSchema>(): {
  from: <TTable extends keyof TSchema & string>(tableName: TTable) => Queryable<TSchema, TTable>;
  insert: <TTable extends keyof TSchema & string>(
    tableName: TTable,
  ) => InsertBuilder<TSchema, TTable>;
  update: <TTable extends keyof TSchema & string>(
    tableName: TTable,
  ) => UpdateBuilder<TSchema, TTable>;
  del: <TTable extends keyof TSchema & string>(tableName: TTable) => DeleteBuilder<TSchema, TTable>;
};
```

**Returns:**

- Object with `from`, `insert`, `update`, and `del` functions pre-typed for your schema

**Example:**

```typescript
import { createContext } from "tinqer";

interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
    content: string;
  };
}

const ctx = createContext<Schema>();

// Type-safe queries - TypeScript enforces schema
const query = ctx
  .from("users")
  .where((u) => u.email.includes("@example.com"))
  .select((u) => ({ id: u.id, name: u.name }));

// Type-safe CRUD
const insertStmt = ctx.insert("posts").values({ user_id: 1, title: "Hello", content: "World" });

const updateStmt = ctx
  .update("users")
  .set({ name: "Updated Name" })
  .where((u) => u.id === 1);

const deleteStmt = ctx.del("posts").where((p) => p.user_id === 1);
```

**Benefits:**

- Full TypeScript type inference and autocomplete
- Compile-time validation of table names and column references
- Prevents typos and schema mismatches
- Better IDE support and refactoring safety

---

## 3. Helper Utilities

### 3.1 createQueryHelpers

Creates helper functions for common query patterns with type safety.

**Function Signature:**

```typescript
function createQueryHelpers<TSchema>(): {
  ilike: (str: string, pattern: string) => boolean;
  contains: (str: string, substr: string) => boolean;
  startsWith: (str: string, prefix: string) => boolean;
  endsWith: (str: string, suffix: string) => boolean;
};
```

**Returns:**

- Object with case-insensitive string helper functions

**Example:**

```typescript
import { createContext, createQueryHelpers } from "tinqer";

interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
  };
}

const ctx = createContext<Schema>();
const { ilike, contains, startsWith, endsWith } = createQueryHelpers<Schema>();

// Case-insensitive pattern matching
const query1 = ctx
  .from("users")
  .where((u) => ilike(u.name, "%alice%"))
  .select((u) => u);
// PostgreSQL: WHERE u.name ILIKE $1
// SQLite: WHERE LOWER(u.name) LIKE LOWER($1)

// Case-insensitive substring search
const query2 = ctx
  .from("users")
  .where((u) => contains(u.email, "example"))
  .select((u) => u);
// PostgreSQL: WHERE u.email ILIKE $1  (param: "%example%")
// SQLite: WHERE LOWER(u.email) LIKE LOWER($1)

// Case-insensitive prefix match
const query3 = ctx
  .from("users")
  .where((u) => startsWith(u.name, "Dr."))
  .select((u) => u);
// PostgreSQL: WHERE u.name ILIKE $1  (param: "Dr.%")
// SQLite: WHERE LOWER(u.name) LIKE LOWER($1)

// Case-insensitive suffix match
const query4 = ctx
  .from("users")
  .where((u) => endsWith(u.email, "@company.com"))
  .select((u) => u);
// PostgreSQL: WHERE u.email ILIKE $1  (param: "%@company.com")
// SQLite: WHERE LOWER(u.email) LIKE LOWER($1)
```

**Notes:**

- PostgreSQL uses native `ILIKE` operator for case-insensitive matching
- SQLite uses `LOWER()` function on both sides for case-insensitive comparison
- All helpers automatically handle SQL injection via parameterization
- Pattern wildcards (`%`, `_`) are automatically added for `contains`, `startsWith`, `endsWith`

---

## Type Definitions

### Core Types

```typescript
// Query builder type
class Queryable<TSchema, TTable extends keyof TSchema & string = keyof TSchema & string> {
  where(predicate: (row: TSchema[TTable]) => boolean): Queryable<TSchema, TTable>;
  select<TResult>(selector: (row: TSchema[TTable]) => TResult): Queryable<TResult>;
  orderBy<TKey>(keySelector: (row: TSchema[TTable]) => TKey): Queryable<TSchema, TTable>;
  // ... other methods
}

// CRUD statement types
class InsertStatement<TSchema, TTable extends keyof TSchema & string> {
  values(obj: Partial<TSchema[TTable]>): InsertStatement<TSchema, TTable>;
  returning<TResult>(selector: (row: TSchema[TTable]) => TResult): InsertStatement<TSchema, TTable>;
}

class UpdateStatement<TSchema, TTable extends keyof TSchema & string> {
  set(obj: Partial<TSchema[TTable]>): UpdateStatement<TSchema, TTable>;
  where(predicate: (row: TSchema[TTable]) => boolean): UpdateStatement<TSchema, TTable>;
  returning<TResult>(selector: (row: TSchema[TTable]) => TResult): UpdateStatement<TSchema, TTable>;
}

class DeleteStatement<TSchema, TTable extends keyof TSchema & string> {
  where(predicate: (row: TSchema[TTable]) => boolean): DeleteStatement<TSchema, TTable>;
  returning<TResult>(selector: (row: TSchema[TTable]) => TResult): DeleteStatement<TSchema, TTable>;
}
```

### SQL Adapter Interface

```typescript
interface SQLAdapter {
  parameterPlaceholder(index: number): string;
  quoteName(name: string): string;
  // ... adapter-specific methods
}
```

---

[← Back to README](../README.md)
