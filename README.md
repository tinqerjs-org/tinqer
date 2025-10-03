# Tinqer

Runtime LINQ-to-SQL query builder for TypeScript. Queries are expressed as inline arrow functions, parsed into an expression tree, and compiled into SQL for PostgreSQL or SQLite.

## Installation

Install the adapter for your database:

```bash
# PostgreSQL (pg-promise)
npm install @webpods/tinqer-sql-pg-promise

# SQLite (better-sqlite3)
npm install @webpods/tinqer-sql-better-sqlite3
```

## Quick Start

### PostgreSQL Example

```typescript
import { Queryable, createContext } from "tinqer";
import { executeSelectSimple, pgPromiseAdapter } from "tinqer-sql-pg-promise";
import pgPromise from "pg-promise";

// Define your schema
interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number;
  };
}

// Setup database
const pgp = pgPromise();
const db = pgp("postgresql://user:pass@localhost:5432/mydb");

// Create type-safe context
const ctx = createContext<Schema>();

// Build and execute query
const query = ctx
  .from("users")
  .where((u) => u.age >= 18)
  .orderBy((u) => u.name)
  .select((u) => ({ id: u.id, name: u.name }));

const results = await executeSelectSimple(query, db, pgPromiseAdapter);
// results: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
```

### SQLite Example

```typescript
import Database from "better-sqlite3";
import { Queryable, createContext } from "tinqer";
import { selectStatement, betterSqlite3Adapter } from "tinqer-sql-better-sqlite3";

interface Schema {
  products: {
    id: number;
    name: string;
    price: number;
    in_stock: number; // SQLite uses INTEGER (0/1) for boolean values
  };
}

const db = new Database("./data.db");
const ctx = createContext<Schema>();

const query = ctx
  .from("products")
  .where((p) => p.in_stock === 1 && p.price < 100)
  .orderByDescending((p) => p.price)
  .select((p) => p);

const { sql, params } = selectStatement(query, betterSqlite3Adapter);
const results = db.prepare(sql).all(...params);
```

## Core Features

### Type-Safe Query Building

```typescript
const ctx = createContext<Schema>();

// Full TypeScript type inference
const query = ctx
  .from("users")
  .where((u) => u.age >= 18 && u.email.includes("@company.com"))
  .orderBy((u) => u.name)
  .select((u) => ({ id: u.id, name: u.name, email: u.email }));

// Type of results is automatically inferred:
// { id: number; name: string; email: string }[]
```

### Joins

```typescript
interface Schema {
  users: { id: number; name: string; dept_id: number };
  departments: { id: number; name: string };
}

const ctx = createContext<Schema>();

const query = ctx
  .from("users")
  .join(
    ctx.from("departments"),
    (u) => u.dept_id,
    (d) => d.id,
    (u, d) => ({ userName: u.name, deptName: d.name }),
  )
  .orderBy((row) => row.userName);
```

### Grouping and Aggregation

```typescript
const summary = ctx
  .from("orders")
  .groupBy((o) => o.product_id)
  .select((g) => ({
    productId: g.key,
    totalQuantity: g.sum((o) => o.quantity),
    avgPrice: g.avg((o) => o.price),
    orderCount: g.count(),
  }))
  .orderByDescending((row) => row.totalQuantity);
```

### CRUD Operations

```typescript
import { insert, update, del } from "tinqer";
import {
  executeInsert,
  executeUpdate,
  executeDelete,
  pgPromiseAdapter,
} from "tinqer-sql-pg-promise";

// INSERT
const insertStmt = insert<Schema>("users")
  .values({ name: "Alice", email: "alice@example.com" })
  .returning((u) => u);

const { results } = await executeInsert(insertStmt, db, pgPromiseAdapter);

// UPDATE
const updateStmt = update<Schema>("users")
  .set({ status: "inactive" })
  .where((u) => u.last_login < params.cutoffDate)
  .returning((u) => u.id);

const { results } = await executeUpdate(updateStmt, db, pgPromiseAdapter, {
  cutoffDate: new Date("2023-01-01"),
});

// DELETE
const deleteStmt = del<Schema>("users")
  .where((u) => u.status === "deleted")
  .returning((u) => ({ id: u.id, name: u.name }));

const { results } = await executeDelete(deleteStmt, db, pgPromiseAdapter);
```

### Parameters and Auto-Parameterisation

All literal values are automatically parameterized to prevent SQL injection:

```typescript
// External parameters via params object
const query = ctx
  .from("users")
  .where((u, params: { minAge: number }) => u.age >= params.minAge)
  .select((u) => u);

const { sql, params } = selectStatement(query, pgPromiseAdapter);
// SQL: SELECT u.* FROM users AS u WHERE u.age >= $1
// params: [18] (passed when executing)

// Literals auto-parameterized
const query2 = ctx
  .from("users")
  .where((u) => u.age >= 18) // 18 becomes a parameter automatically
  .select((u) => u);
```

### Case-Insensitive String Operations

```typescript
import { createQueryHelpers } from "tinqer";

const { ilike, contains, startsWith, endsWith } = createQueryHelpers<Schema>();

const query = ctx
  .from("users")
  .where((u) => contains(u.name, "alice")) // Case-insensitive substring match
  .select((u) => u);

// PostgreSQL: WHERE u.name ILIKE $1 (param: "%alice%")
// SQLite: WHERE LOWER(u.name) LIKE LOWER(?) (param: "%alice%")
```

## Key Concepts

### Query Lifecycle

1. **Build Query** - Construct fluent chain using `Queryable` API
2. **Parse Lambda** - Lambda expressions are parsed into expression tree (never executed)
3. **Auto-Parameterize** - Literal values extracted as parameters
4. **Generate SQL** - Adapter converts expression tree to database-specific SQL

### Expression Support

Tinqer supports a focused set of JavaScript/TypeScript expressions:

- **Comparison**: `===`, `!==`, `>`, `>=`, `<`, `<=`
- **Logical**: `&&`, `||`, `!`
- **Arithmetic**: `+`, `-`, `*`, `/`, `%`
- **String**: `.includes()`, `.startsWith()`, `.endsWith()`, `.toLowerCase()`, `.toUpperCase()`
- **Null handling**: `??` (null coalescing), `?.` (optional chaining)
- **Arrays**: `.includes()` for IN queries
- **Helper functions**: `ilike()`, `contains()`, `startsWith()`, `endsWith()` (case-insensitive)

## Database Support

### PostgreSQL

- Native boolean type (`true`/`false`)
- Case-insensitive matching with `ILIKE`
- Full JSONB support
- Parameter placeholders: `$1`, `$2`, etc.

### SQLite

- Boolean values use INTEGER (0/1)
- Case-insensitive via `LOWER()` function
- JSON functions support
- Parameter placeholders: `?`, `?`, etc.

See [Database Adapters](docs/adapters.md) for detailed comparison.

## Differences from .NET LINQ to SQL

- Lambdas cannot capture external variables; use params object
- Limited method set (no `SelectMany`, `GroupJoin`, `DefaultIfEmpty`)
- Only inner joins (outer joins require manual SQL)
- No deferred execution; SQL generated on demand
- Grouping supports `count`, `sum`, `avg`, `min`, `max`

## Documentation

- **[Query Operations Guide](docs/guide.md)** - Complete reference for all query operations, parameters, and CRUD
- **[API Reference](docs/api-reference.md)** - Execution functions, type utilities, and helper APIs
- **[Database Adapters](docs/adapters.md)** - PostgreSQL and SQLite specifics, differences, limitations
- **[Development Guide](docs/development.md)** - Contributing, testing, troubleshooting

## Packages

| Package                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `@webpods/tinqer`                    | Core expression tree and types (re-exported by adapters) |
| `@webpods/tinqer-sql-pg-promise`     | PostgreSQL adapter with pg-promise                       |
| `@webpods/tinqer-sql-better-sqlite3` | SQLite adapter with better-sqlite3                       |

## License

MIT
