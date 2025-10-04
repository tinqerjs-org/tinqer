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
import { createContext, from } from "@webpods/tinqer";
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
const ctx = createContext<Schema>();

const results = await executeSelectSimple(db, () =>
  from(ctx, "users")
    .where((u) => u.age >= 18)
    .orderBy((u) => u.name)
    .select((u) => ({ id: u.id, name: u.name })),
);
// results: [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }]
```

### SQLite Example

```typescript
import Database from "better-sqlite3";
import { createContext, from } from "@webpods/tinqer";
import { selectStatement } from "@webpods/tinqer-sql-better-sqlite3";

interface Schema {
  products: {
    id: number;
    name: string;
    price: number;
    inStock: number; // SQLite uses INTEGER (0/1) for boolean values
  };
}

const db = new Database("./data.db");
const ctx = createContext<Schema>();

const { sql, params } = selectStatement(
  () =>
    from(ctx, "products")
      .where((p) => p.inStock === 1 && p.price < 100)
      .orderByDescending((p) => p.price)
      .select((p) => p),
  {},
);

const results = db.prepare(sql).all(params);
```

## Core Features

### Type-Safe Query Building

```typescript
const ctx = createContext<Schema>();

// Full TypeScript type inference
const query = () =>
  from(ctx, "users")
    .where((u) => u.age >= 18 && u.email.includes("@company.com"))
    .orderBy((u) => u.name)
    .select((u) => ({ id: u.id, name: u.name, email: u.email }));

// query() returns a Queryable whose result type is inferred as
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

const ctx = createContext<Schema>();

const inner = from(ctx, "users")
  .join(
    from(ctx, "departments"),
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
const leftOuter = from(ctx, "users")
  .groupJoin(
    from(ctx, "departments"),
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
const cross = from(ctx, "departments")
  .selectMany(
    () => from(ctx, "users"),
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
const summary = from(ctx, "orders")
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
import { createContext, insertInto, updateTable, deleteFrom } from "@webpods/tinqer";
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

const ctx = createContext<Schema>();

// INSERT
const insertedRows = await executeInsert(
  db,
  () =>
    insertInto(ctx, "users").values({
      name: "Alice",
      email: "alice@example.com",
    }),
  {},
);

// UPDATE with RETURNING
const inactiveUsers = await executeUpdate(
  db,
  (params: { cutoffDate: Date }) =>
    updateTable(ctx, "users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < params.cutoffDate)
      .returning((u) => u.id),
  { cutoffDate: new Date("2023-01-01") },
);

// DELETE
const deletedCount = await executeDelete(
  db,
  () => deleteFrom(ctx, "users").where((u) => u.status === "deleted"),
  {},
);
```

### Parameters and Auto-Parameterisation

All literal values are automatically parameterized to prevent SQL injection:

```typescript
// External parameters via params object
const ctx = createContext<Schema>();

const sample = selectStatement(
  (p: { minAge: number }) =>
    from(ctx, "users")
      .where((u) => u.age >= p.minAge)
      .select((u) => u),
  { minAge: 18 },
);
// SQL (PostgreSQL): SELECT * FROM "users" WHERE "age" >= $(minAge)
// params: { minAge: 18 }

// Literals auto-parameterized automatically
const literals = selectStatement(
  () =>
    from(ctx, "users")
      .where((u) => u.age >= 18)
      .select((u) => u),
  {},
);
// params: { __p1: 18 }
```

### Case-Insensitive String Operations

```typescript
import { createQueryHelpers } from "@webpods/tinqer";

const { ilike, contains, startsWith, endsWith } = createQueryHelpers<Schema>();

const ctx = createContext<Schema>();

const query = from(ctx, "users")
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
