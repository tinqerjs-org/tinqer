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
import { createSchema } from "@webpods/tinqer";
import { executeSelectSimple } from "@webpods/tinqer-sql-pg-promise";
import pgPromise from "pg-promise";

interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
    age: number;
  };
}

const pgp = pgPromise();
const db = pgp("postgresql://user:pass@localhost:5432/mydb");
const schema = createSchema<Schema>();

const results = await executeSelectSimple(db, schema, (ctx, _params, _helpers) =>
  ctx
    .from("users")
    .where((u) => u.age >= 18)
    .orderBy((u) => u.name)
    .select((u) => ({ id: u.id, name: u.name })),
);
// results: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
```

### SQLite Example

```typescript
import Database from "better-sqlite3";
import { createSchema } from "@webpods/tinqer";
import { executeSelect, selectStatement } from "@webpods/tinqer-sql-better-sqlite3";

interface Schema {
  products: {
    id: number;
    name: string;
    price: number;
    inStock: number; // SQLite uses INTEGER (0/1) for boolean values
  };
}

const db = new Database("./data.db");
const schema = createSchema<Schema>();

const results = executeSelect(
  db,
  schema,
  (ctx, params, _helpers) =>
    ctx
      .from("products")
      .where((p) => p.inStock === 1 && p.price < params.maxPrice)
      .orderByDescending((p) => p.price)
      .select((p) => p),
  { maxPrice: 100 },
);

// Need the raw SQL for logging or prepared statements? selectStatement is still available:
const { sql, params } = selectStatement(
  schema,
  (ctx) => ctx.from("products").select((p) => p.name),
  {},
);
```

## Core Features

### Type-Safe Query Building

```typescript
const schema = createSchema<Schema>();

// Full TypeScript type inference
const query = (ctx, _params, _helpers) =>
  ctx
    .from("users")
    .where((u) => u.age >= 18 && u.email.includes("@company.com"))
    .orderBy((u) => u.name)
    .select((u) => ({ id: u.id, name: u.name, email: u.email }));

// The query builder returns a Queryable whose result type is inferred as
// { id: number; name: string; email: string }
```

### Joins

Tinqer mirrors LINQ semantics. Inner joins have a dedicated operator; left outer and cross joins follow the familiar `groupJoin`/`selectMany` patterns from C#.

#### Inner Join

```typescript
interface Schema {
  users: { id: number; name: string; deptId: number };
  departments: { id: number; name: string };
}

const schema = createSchema<Schema>();

const query = (ctx, _params, _helpers) =>
  ctx
    .from("users")
    .join(
      ctx.from("departments"),
      (user) => user.deptId,
      (department) => department.id,
      (user, department) => ({
        userName: user.name,
        departmentName: department.name,
      }),
    )
    .orderBy((row) => row.userName);
```

#### Left Outer Join

```typescript
const query = (ctx, _params, _helpers) =>
  ctx
    .from("users")
    .groupJoin(
      ctx.from("departments"),
      (user) => user.deptId,
      (department) => department.id,
      (user, deptGroup) => ({ user, deptGroup }),
    )
    .selectMany(
      (group) => group.deptGroup.defaultIfEmpty(),
      (group, department) => ({
        user: group.user,
        department,
      }),
    )
    .select((row) => ({
      userId: row.user.id,
      departmentName: row.department ? row.department.name : null,
    }));
```

#### Cross Join

```typescript
const query = (ctx, _params, _helpers) =>
  ctx
    .from("departments")
    .selectMany(
      () => ctx.from("users"),
      (department, user) => ({ department, user }),
    )
    .select((row) => ({
      departmentId: row.department.id,
      userId: row.user.id,
    }));
```

Right and full outer joins still require manual SQL, just as in LINQ-to-Objects.

### Grouping and Aggregation

```typescript
const query = (ctx, _params, _helpers) =>
  ctx
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

### Window Functions

Window functions enable calculations across rows related to the current row. Tinqer supports `ROW_NUMBER()`, `RANK()`, and `DENSE_RANK()` with optional partitioning and ordering.

```typescript
// Get top earner per department (automatically wrapped in subquery)
const topEarners = await executeSelect(
  db,
  schema,
  (ctx, _params, h) =>
    ctx
      .from("employees")
      .select((e) => ({
        ...e,
        rank: h
          .window(e)
          .partitionBy((r) => r.department)
          .orderByDescending((r) => r.salary)
          .rowNumber(),
      }))
      .where((e) => e.rank === 1), // Filtering on window function result
  {},
);

// Generated SQL (automatically wrapped):
// SELECT * FROM (
//   SELECT *, ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
//   FROM "employees"
// ) AS "employees"
// WHERE "rank" = 1
```

**Automatic Subquery Wrapping**: Tinqer automatically detects when `where()` clauses reference window function columns and wraps the query in a subquery, since SQL doesn't allow filtering on window functions at the same level where they're defined.

See the [Window Functions Guide](docs/guide.md#8-window-functions) for detailed examples of `RANK()`, `DENSE_RANK()`, complex ordering, and [filtering on window results](docs/guide.md#85-filtering-on-window-function-results).

### CRUD Operations

```typescript
import { createSchema } from "@webpods/tinqer";
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

const schema = createSchema<Schema>();

// INSERT
const insertedRows = await executeInsert(
  db,
  schema,
  (ctx, _params) =>
    ctx.insertInto("users").values({
      name: "Alice",
      email: "alice@example.com",
    }),
  {},
);

// UPDATE with RETURNING
const inactiveUsers = await executeUpdate(
  db,
  schema,
  (ctx, params) =>
    ctx
      .update("users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < params.cutoffDate)
      .returning((u) => u.id),
  { cutoffDate: new Date("2023-01-01") },
);

// DELETE
const deletedCount = await executeDelete(
  db,
  schema,
  (ctx, _params) => ctx.deleteFrom("users").where((u) => u.status === "deleted"),
  {},
);

// SQLite note: executeInsert/executeUpdate ignore RETURNING clauses at runtime; run a follow-up SELECT if you need the affected rows.
```

### Parameters and Auto-Parameterisation

All literal values are automatically parameterized to prevent SQL injection:

```typescript
// External parameters via params object
const schema = createSchema<Schema>();

const sample = selectStatement(
  schema,
  (ctx, p) =>
    ctx
      .from("users")
      .where((u) => u.age >= p.minAge)
      .select((u) => u),
  { minAge: 18 },
);
// SQL (PostgreSQL): SELECT * FROM "users" WHERE "age" >= $(minAge)
// params: { minAge: 18 }

// Literals auto-parameterized automatically
const literals = selectStatement(
  schema,
  (ctx) =>
    ctx
      .from("users")
      .where((u) => u.age >= 18)
      .select((u) => u),
  {},
);
// params: { __p1: 18 }
```

### Case-Insensitive String Operations

```typescript
import { createSchema } from "@webpods/tinqer";

const schema = createSchema<Schema>();

const query = (ctx, _params, helpers) =>
  ctx
    .from("users")
    .where((u) => helpers.contains(u.name, "alice")) // Case-insensitive substring match
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
- **Window functions**: `h.window(row).rowNumber()`, `h.window(row).rank()`, `h.window(row).denseRank()` with `partitionBy()`, `orderBy()`, `orderByDescending()`, `thenBy()`, `thenByDescending()`

## Database Support

### PostgreSQL

- Native boolean type (`true`/`false`)
- Case-insensitive matching with `ILIKE`
- Full JSONB support
- Window functions: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()`
- Parameter placeholders: `$1`, `$2`, etc.

### SQLite

- Boolean values use INTEGER (0/1)
- Case-insensitive via `LOWER()` function
- JSON functions support
- Window functions: `ROW_NUMBER()`, `RANK()`, `DENSE_RANK()` (requires SQLite 3.25+)
- Parameter placeholders: `?`, `?`, etc.

See [Database Adapters](docs/adapters.md) for detailed comparison.

## Differences from .NET LINQ to SQL

- Lambdas cannot capture external variables; use params object
- Limited method set (no `SelectMany`, `GroupJoin`, `DefaultIfEmpty`)
- Left outer joins and cross joins supported via LINQ patterns (right/full joins still require manual SQL)
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
