[← Back to README](../README.md)

# Tinqer API Reference

Reference for adapter execution helpers, typed contexts, and query utilities.

## Table of Contents

- [1. Execution APIs](#1-execution-apis)
  - [1.1 selectStatement](#11-selectstatement)
  - [1.2 executeSelect](#12-executeselect)
  - [1.3 executeSelectSimple](#13-executeselectsimple)
  - [1.4 insertStatement & executeInsert](#14-insertstatement--executeinsert)
  - [1.5 updateStatement & executeUpdate](#15-updatestatement--executeupdate)
  - [1.6 deleteStatement & executeDelete](#16-deletestatement--executedelete)
  - [1.7 toSql](#17-tosql)
  - [1.8 ExecuteOptions & SqlResult](#18-executeoptions--sqlresult)
- [2. Type-Safe Contexts](#2-type-safe-contexts)
  - [2.1 createContext](#21-createcontext)
- [3. Helper Utilities](#3-helper-utilities)
  - [3.1 createQueryHelpers](#31-createqueryhelpers)

---

## 1. Execution APIs

Adapter packages export the runtime helpers that turn expression trees into SQL and execute them. PostgreSQL helpers live in `@webpods/tinqer-sql-pg-promise`; SQLite helpers live in `@webpods/tinqer-sql-better-sqlite3` and expose the same signatures.

### 1.1 selectStatement

Converts a query builder function into SQL and named parameters without executing it.

**Signature**

```typescript
function selectStatement<TParams, TResult>(
  queryBuilder:
    | ((params: TParams) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        params: TParams,
        helpers: QueryHelpers,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>),
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult>;
```

**Example (PostgreSQL)**

```typescript
import { createContext, from } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; age: number };
}

const ctx = createContext<Schema>();

const { sql, params } = selectStatement(
  (p: { minAge: number }) =>
    from(ctx, "users")
      .where((u) => u.age >= p.minAge)
      .select((u) => ({ id: u.id, name: u.name })),
  { minAge: 18 },
);
// sql: SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "age" >= $(minAge)
// params: { minAge: 18 }
```

### 1.2 executeSelect

Executes a query builder against the database and returns typed results. Accepts external parameters and optional execution options.

```typescript
async function executeSelect<
  TParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => TQuery,
  params: TParams,
  options?: ExecuteOptions,
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
>;
```

**Example (PostgreSQL)**

```typescript
const users = await executeSelect(
  db,
  (p: { minAge: number }) =>
    from(ctx, "users")
      .where((u) => u.age >= p.minAge)
      .orderBy((u) => u.name),
  { minAge: 21 },
);
```

### 1.3 executeSelectSimple

Convenience wrapper for queries that do not need external params.

```typescript
async function executeSelectSimple<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: () => TQuery,
  options?: ExecuteOptions,
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
>;
```

### 1.4 insertStatement & executeInsert

Generate and execute INSERT statements with optional RETURNING clauses. Available in both adapter packages.

```typescript
function insertStatement<TParams, TTable, TReturning = never>(
  queryBuilder: (
    params: TParams,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

async function executeInsert<TParams, TTable>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

async function executeInsert<TParams, TTable, TReturning>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;
```

**Example**

```typescript
import { createContext, insertInto } from "@webpods/tinqer";

const ctx = createContext<Schema>();

const inserted = await executeInsert(
  db,
  () => insertInto(ctx, "users").values({ name: "Alice" }),
  {},
);

const createdUsers = await executeInsert(
  db,
  () =>
    insertInto(ctx, "users")
      .values({ name: "Bob" })
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
);
```

### 1.5 updateStatement & executeUpdate

```typescript
function updateStatement<TParams, TTable, TReturning = never>(
  queryBuilder: (
    params: TParams,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

async function executeUpdate<TParams, TTable>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

async function executeUpdate<TParams, TTable, TReturning>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;
```

**Example**

```typescript
import { createContext, updateTable } from "@webpods/tinqer";

const ctx = createContext<Schema>();

const updatedRows = await executeUpdate(
  db,
  (p: { cutoff: Date }) =>
    updateTable(ctx, "users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < p.cutoff),
  { cutoff: new Date("2024-01-01") },
);
```

### 1.6 deleteStatement & executeDelete

```typescript
function deleteStatement<TParams, TResult>(
  queryBuilder: (params: TParams) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void>;

async function executeDelete<TParams, TResult>(
  db: PgDatabase | BetterSqlite3Database,
  queryBuilder: (params: TParams) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;
```

**Example**

```typescript
import { createContext, deleteFrom } from "@webpods/tinqer";

const ctx = createContext<Schema>();

const deletedCount = await executeDelete(
  db,
  () => deleteFrom(ctx, "users").where((u) => u.status === "inactive"),
  {},
);
```

### 1.7 toSql

Generates SQL and parameters from a pre-built queryable without executing it.

```typescript
function toSql<T>(queryable: Queryable<T> | OrderedQueryable<T> | TerminalQuery<T>): {
  text: string;
  parameters: Record<string, unknown>;
  _resultType?: T;
};
```

**Example (SQLite)**

```typescript
const { text, parameters } = toSql(
  from(ctx, "products")
    .where((p) => p.inStock === 1)
    .orderByDescending((p) => p.price),
);
```

### 1.8 ExecuteOptions & SqlResult

Both adapters expose `ExecuteOptions` and `SqlResult` for inspection and typing.

```typescript
interface ExecuteOptions {
  onSql?: (result: SqlResult<Record<string, unknown>, unknown>) => void;
}

interface SqlResult<TParams, TResult> {
  sql: string;
  params: TParams;
  _resultType?: TResult; // phantom type information
}
```

Use `onSql` for logging, testing, or debugging without changing execution flow.

---

## 2. Type-Safe Contexts

### 2.1 createContext

Creates a phantom-typed `DatabaseContext` that ties table names to row types. Combine it with the `from` overload that accepts a context to get strongly typed queryables.

```typescript
import { createContext, from } from "@webpods/tinqer";

interface Schema {
  users: { id: number; name: string; email: string };
  posts: { id: number; userId: number; title: string };
}

const ctx = createContext<Schema>();

const query = () =>
  from(ctx, "users")
    .where((u) => u.email.endsWith("@example.com"))
    .select((u) => ({ id: u.id, name: u.name }));
```

The overload `from<Table>()` without a context remains available when you want to specify the row type manually.

---

## 3. Helper Utilities

### 3.1 createQueryHelpers

Provides helper functions for case-insensitive comparisons and string searches. Helpers can be passed into query builders through the optional `helpers` argument provided by the adapters.

```typescript
import { createContext, createQueryHelpers, from } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string };
}

const ctx = createContext<Schema>();
const helpers = createQueryHelpers<Schema>();

const result = selectStatement(
  (_params, h = helpers) =>
    from(ctx, "users").where((u) => h.functions.icontains(u.name, "alice")),
  {},
);
```

Helpers expose `ilike`, `contains`, `startsWith`, `endsWith`, and related boolean helpers (prefixed with `i`) that adapt per database dialect.
