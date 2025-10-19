[← Back to README](../README.md)

# Tinqer API Reference

Reference for adapter execution helpers, typed contexts, and query utilities.

## Table of Contents

- [1. Execution APIs](#1-execution-apis)
  - [1.1 selectStatement](#11-selectstatement)
  - [1.2 executeSelect](#12-executeselect)
  - [1.3 insertStatement & executeInsert](#13-insertstatement--executeinsert)
  - [1.4 updateStatement & executeUpdate](#14-updatestatement--executeupdate)
  - [1.5 deleteStatement & executeDelete](#15-deletestatement--executedelete)
  - [1.6 toSql](#16-tosql)
  - [1.7 ExecuteOptions & SqlResult](#17-executeoptions--sqlresult)
- [2. Type-Safe Contexts](#2-type-safe-contexts)
  - [2.1 createSchema](#21-createschema)
- [3. Helper Utilities](#3-helper-utilities)
  - [3.1 createQueryHelpers](#31-createqueryhelpers)

---

## 1. Execution APIs

Adapter packages export the runtime helpers that turn expression trees into SQL and execute them. PostgreSQL helpers live in `@webpods/tinqer-sql-pg-promise`; SQLite helpers live in `@webpods/tinqer-sql-better-sqlite3` and expose the same signatures.

### 1.1 selectStatement

Converts a query builder function into SQL and named parameters without executing it. The query builder receives a DSL context, parameters, and helper functions.

**Signature**

```typescript
function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, unknown>, TResult>;
```

**Example (PostgreSQL)**

```typescript
import { createSchema } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; age: number };
}

const schema = createSchema<Schema>();

const { sql, params } = selectStatement(
  schema,
  (q, params) =>
    q
      .from("users")
      .where((u) => u.age >= params.minAge)
      .select((u) => ({ id: u.id, name: u.name })),
  { minAge: 18 },
);
// sql: SELECT "id" AS "id", "name" AS "name" FROM "users" WHERE "age" >= $(minAge)
// params: { minAge: 18 }
```

### 1.2 executeSelect

Executes a query builder against the database and returns typed results. The query builder receives a DSL context, parameters, and helper functions.

```typescript
async function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (ctx: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery,
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
import { createSchema } from "@webpods/tinqer";
import { executeSelect } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; age: number };
}

const schema = createSchema<Schema>();

const users = await executeSelect(
  db,
  schema,
  (q, params) =>
    q
      .from("users")
      .where((u) => u.age >= params.minAge)
      .orderBy((u) => u.name),
  { minAge: 21 },
);
```

### 1.3 insertStatement & executeInsert

Generate and execute INSERT statements with optional RETURNING clauses. The query builder receives a DSL context, parameters, and helper functions.

```typescript
function insertStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<TParams & Record<string, unknown>, TReturning extends never ? void : TReturning>;

async function executeInsert<TSchema, TParams, TTable>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

async function executeInsert<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;
```

**Example**

```typescript
import { createSchema } from "@webpods/tinqer";
import { executeInsert } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string };
}

const schema = createSchema<Schema>();

const inserted = await executeInsert(
  db,
  schema,
  (q) => q.insertInto("users").values({ name: "Alice" }),
  {},
);

const createdUsers = await executeInsert(
  db,
  schema,
  (q) =>
    q
      .insertInto("users")
      .values({ name: "Bob" })
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
);
```

### 1.4 updateStatement & executeUpdate

Generate and execute UPDATE statements with optional RETURNING clauses. The query builder receives a DSL context, parameters, and helper functions.

```typescript
function updateStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<TParams & Record<string, unknown>, TReturning extends never ? void : TReturning>;

async function executeUpdate<TSchema, TParams, TTable>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

async function executeUpdate<TSchema, TParams, TTable, TReturning>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;
```

**Example**

```typescript
import { createSchema } from "@webpods/tinqer";
import { executeUpdate } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; lastLogin: Date; status: string };
}

const schema = createSchema<Schema>();

const updatedRows = await executeUpdate(
  db,
  schema,
  (q, params) =>
    q
      .update("users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < params.cutoff),
  { cutoff: new Date("2024-01-01") },
);
```

### 1.5 deleteStatement & executeDelete

Generate and execute DELETE statements. The query builder receives a DSL context, parameters, and helper functions.

```typescript
function deleteStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, unknown>, void>;

async function executeDelete<TSchema, TParams, TResult>(
  db: PgDatabase | BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  queryBuilder: (
    ctx: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;
```

**Example**

```typescript
import { createSchema } from "@webpods/tinqer";
import { executeDelete } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; status: string };
}

const schema = createSchema<Schema>();

const deletedCount = await executeDelete(
  db,
  schema,
  (q) => q.deleteFrom("users").where((u) => u.status === "inactive"),
  {},
);
```

### 1.6 Statement Functions (selectStatement, insertStatement, etc.)

Generate SQL and parameters without executing them. These functions are useful for debugging, testing, or when you need the SQL before execution.

```typescript
function selectStatement<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (q: QueryBuilder<TSchema>) => Queryable<TResult>,
): SqlResult<Record<string, unknown>, TResult>;
```

**Example (SQLite)**

```typescript
import { createSchema } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-better-sqlite3";

interface Schema {
  products: { id: number; name: string; price: number; inStock: number };
}

const schema = createSchema<Schema>();

// Generate SQL without executing
const result = selectStatement(schema, (q) =>
  q
    .from("products")
    .where((p) => p.inStock === 1)
    .orderByDescending((p) => p.price),
);

// result.sql contains the SQL string
// result.params contains the parameters
```

### 1.7 ExecuteOptions & SqlResult

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

### 2.1 createSchema

Creates a phantom-typed `DatabaseSchema` that ties table names to row types. The schema is passed to execution functions, which provide a type-safe query builder through the lambda's first parameter.

```typescript
import { createSchema } from "@webpods/tinqer";
import { executeSelect } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; email: string };
  posts: { id: number; userId: number; title: string };
}

const schema = createSchema<Schema>();

// Schema is passed to execute functions, which provide the query builder 'q' parameter
const results = await executeSelect(db, schema, (q) =>
  q.from("users").where((u) => u.email.endsWith("@example.com")),
);
```

---

## 3. Helper Utilities

### 3.1 createQueryHelpers

Provides helper functions for case-insensitive comparisons and string searches. Helpers are automatically passed as the third parameter to query builder functions.

```typescript
import { createSchema, createQueryHelpers } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string };
}

const schema = createSchema<Schema>();

const result = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("users").where((u) => helpers.functions.icontains(u.name, "alice")),
  {},
);
```

**Available Helper Functions**

Helpers expose the following functions that adapt per database dialect:

- `ilike(field, pattern)` - Case-insensitive LIKE comparison
- `contains(field, substring)` - Check if field contains substring (case-sensitive)
- `icontains(field, substring)` - Check if field contains substring (case-insensitive)
- `startsWith(field, prefix)` - Check if field starts with prefix (case-sensitive)
- `istartsWith(field, prefix)` - Check if field starts with prefix (case-insensitive)
- `endsWith(field, suffix)` - Check if field ends with suffix (case-sensitive)
- `iendsWith(field, suffix)` - Check if field ends with suffix (case-insensitive)

**Creating Custom Helpers**

You can create helpers with custom functions:

```typescript
const helpers = createQueryHelpers<Schema>();
// Use helpers in your queries through the third parameter
```
