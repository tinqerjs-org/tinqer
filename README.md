# Tinqer

Runtime LINQ-to-SQL builder for TypeScript. Queries are expressed as inline arrow functions, parsed into an expression tree, and compiled into SQL for PostgreSQL (pg-promise) or SQLite (better-sqlite3).

---

## Table of Contents

- [1. Installation](#1-installation)
- [2. Adapter Packages](#2-adapter-packages)
- [3. Getting Started](#3-getting-started)
  - [3.1 PostgreSQL Example](#31-postgresql-example)
  - [3.2 SQLite Example](#32-sqlite-example)
- [4. Core Concepts](#4-core-concepts)
  - [4.1 Query Lifecycle](#41-query-lifecycle)
  - [4.2 Queryable Chain vs Terminal Operations](#42-queryable-chain-vs-terminal-operations)
  - [4.3 Expression Support Summary](#43-expression-support-summary)
- [5. Detailed Query Reference](#5-detailed-query-reference)
  - [5.1 Filtering (`where`)](#51-filtering-where)
  - [5.2 Projections (`select`)](#52-projections-select)
  - [5.3 Ordering (`orderBy`, `orderByDescending`, `thenBy`)](#53-ordering-orderby-orderbydescending-thenby)
  - [5.4 Distinct (`distinct`)](#54-distinct-distinct)
  - [5.5 Pagination (`skip`, `take`)](#55-pagination-skip-take)
  - [5.6 Joins (`join`)](#56-joins-join)
  - [5.7 Grouping and Aggregation (`groupBy`, `count`, `sum`, `avg`, `min`, `max`)](#57-grouping-and-aggregation-groupby-count-sum-avg-min-max)
  - [5.8 Scalar Aggregates on Root Queries](#58-scalar-aggregates-on-root-queries)
  - [5.9 Quantifiers (`any`, `all`)](#59-quantifiers-any-all)
  - [5.10 Element Retrieval (`first`, `firstOrDefault`, `single`, `singleOrDefault`, `last`, `lastOrDefault`)](#510-element-retrieval-first-firstordefault-single-singleordefault-last-lastordefault)
  - [5.11 Materialisation (`toArray`)](#511-materialisation-toarray)
- [6. Parameters and Auto-Parameterisation](#6-parameters-and-auto-parameterisation)
  - [6.1 External Parameter Objects](#61-external-parameter-objects)
  - [6.2 Literal Auto-Parameterisation](#62-literal-auto-parameterisation)
  - [6.3 Array Membership (`Array.includes`)](#63-array-membership-arrayincludes)
  - [6.4 Case-Insensitive Helper Functions](#64-case-insensitive-helper-functions)
- [7. CRUD Operations (INSERT, UPDATE, DELETE)](#7-crud-operations-insert-update-delete)
  - [7.1 INSERT Statements](#71-insert-statements)
  - [7.2 UPDATE Statements](#72-update-statements)
  - [7.3 DELETE Statements](#73-delete-statements)
  - [7.4 Safety Features](#74-safety-features)
  - [7.5 Executing CRUD Operations](#75-executing-crud-operations)
- [8. Execution APIs](#8-execution-apis)
  - [8.1 `selectStatement` Function](#81-selectstatement-function)
  - [8.2 `executeSelect` and `executeSelectSimple`](#82-executeselect-and-executeselectsimple)
  - [8.3 CRUD Execution Functions](#83-crud-execution-functions)
  - [8.4 `toSql`](#84-tosql)
- [9. Adapter-Specific Notes](#9-adapter-specific-notes)
  - [9.1 PostgreSQL (pg-promise)](#91-postgresql-pg-promise)
  - [9.2 SQLite (better-sqlite3)](#92-sqlite-better-sqlite3)
- [10. Type-Safe Contexts (`createContext`)](#10-type-safe-contexts-createcontext)
- [11. Helper Utilities (`createQueryHelpers`)](#11-helper-utilities-createqueryhelpers)
- [12. Date and Time Handling](#12-date-and-time-handling)
- [13. Limitations and Unsupported Features](#13-limitations-and-unsupported-features)
- [14. Differences from .NET LINQ to SQL](#14-differences-from-net-linq-to-sql)
- [15. Troubleshooting](#15-troubleshooting)
- [16. Development Notes](#16-development-notes)
- [17. Appendices](#17-appendices)
  - [17.1 Expression Tree Example](#171-expression-tree-example)
  - [17.2 Generated SQL Inventory](#172-generated-sql-inventory)

---

## 1. Installation

Install the adapter for the database driver you plan to use. The adapters depend on the core `@webpods/tinqer` package and re-export the public API.

```bash
# PostgreSQL (pg-promise)
npm install @webpods/tinqer-sql-pg-promise

# SQLite (better-sqlite3)
npm install @webpods/tinqer-sql-better-sqlite3
```

All examples assume TypeScript with `strict` enabled and ECMAScript modules.

---

## 2. Adapter Packages

| Package                              | Purpose                                                                     | Notes                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@webpods/tinqer`                    | Core expression tree, visitors, and TypeScript types.                       | Not meant to be installed directly; the adapters re-export everything.                |
| `@webpods/tinqer-sql-pg-promise`     | SQL generator for PostgreSQL with pg-promise parameter markers (`$(name)`). | Provides `selectStatement`, CRUD statement functions, execution helpers, and `toSql`. |
| `@webpods/tinqer-sql-better-sqlite3` | SQL generator for SQLite using better-sqlite3 (`@name`).                    | Handles boolean conversion, supports RETURNING (SQLite 3.35.0+), and date formatting. |

Both adapters expose identical TypeScript APIs so query builders can be shared between them.

---

## 3. Getting Started

Create a database connection, define your model interfaces, and build queries with `from(...)`.

### 3.1 PostgreSQL Example

```typescript
import { from, selectStatement, executeSelect } from "@webpods/tinqer-sql-pg-promise";
import pgPromise from "pg-promise";

type User = {
  id: number;
  name: string;
  email: string;
  age: number;
  active: boolean;
  departmentId: number;
};

type Department = {
  id: number;
  name: string;
};

const pgp = pgPromise();
const db = pgp("postgresql://user:pass@localhost:5432/app");

const result = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.age >= 18)
      .orderBy((u) => u.name)
      .take(10),
  {},
);

await executeSelect(
  db,
  () =>
    from<User>("users")
      .join(
        from<Department>("departments"),
        (u) => u.departmentId,
        (d) => d.id,
        (u, d) => ({ userName: u.name, departmentName: d.name }),
      )
      .orderBy((row) => row.userName),
  {},
);
```

### 3.2 SQLite Example

```typescript
import Database from "better-sqlite3";
import { from, selectStatement, executeSelect } from "@webpods/tinqer-sql-better-sqlite3";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
};

type Order = {
  id: number;
  productId: number;
  quantity: number;
  total: number;
};

const sqlite = new Database("./data.db");

const summary = selectStatement(
  () =>
    from<Order>("orders")
      .groupBy((o) => o.productId)
      .select((g) => ({ productId: g.key, totalQuantity: g.sum((o) => o.quantity) }))
      .orderByDescending((row) => row.totalQuantity),
  {},
);

const bestSellers = await executeSelect(
  sqlite,
  () =>
    from<Order>("orders")
      .join(
        from<Product>("products"),
        (o) => o.productId,
        (p) => p.id,
        (o, p) => ({ product: p.name, total: o.total }),
      )
      .orderByDescending((row) => row.total)
      .take(5),
  {},
);
```

---

## 4. Core Concepts

### 4.1 Query Lifecycle

1. **Queryable Chain** – Build a fluent chain beginning with `from(...)`. Each method call returns a `Queryable` or `OrderedQueryable` placeholder.
2. **Builder Function** – Wrap the chain in a lambda supplied to `selectStatement(...)`, `executeSelect(...)`, or `executeSelectSimple(...)`. The lambda is never executed; it is stringified and parsed.
3. **Parser** – The builder function is converted to a string. The OXC parser produces a JavaScript AST, which is translated to an internal query operation tree.
4. **Auto-Parameterisation** – Literal values are extracted into auto-generated parameters (`__p1`, `__p2`, ...). External parameters remain by name.
5. **SQL Generator** – The adapter walks the operation tree, assigns table aliases, composes clauses, and formats parameters for the target driver.
6. **Execution** – `selectStatement` returns `{ sql, params }`. `executeSelect` runs the SQL using the appropriate driver helpers (`db.any`, `db.one`, or better-sqlite3 prepared statements).

### 4.2 Queryable Chain vs Terminal Operations

| Category                   | Methods                                                                                                                        | Notes                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Chainable                  | `where`, `select`, `distinct`, `orderBy`, `orderByDescending`, `thenBy`, `thenByDescending`, `skip`, `take`, `join`, `groupBy` | May be composed in any order consistent with LINQ semantics. Only inner joins are supported. |
| Terminal (element)         | `first`, `firstOrDefault`, `single`, `singleOrDefault`, `last`, `lastOrDefault`                                                | Generate queries with `LIMIT 1`. `last*` reverses ordering when necessary.                   |
| Terminal (aggregates)      | `count`, `sum`, `average`, `min`, `max`                                                                                        | Emit `SELECT COUNT(*)`, `SUM(...)`, etc. Predicate overload supported for `count`.           |
| Terminal (boolean)         | `any`, `all`                                                                                                                   | Translate to `EXISTS` / `NOT EXISTS`.                                                        |
| Terminal (materialisation) | `toArray`                                                                                                                      | Executes the chain without adding additional clauses.                                        |

### 4.3 Expression Support Summary

- Comparison: `===`, `!==`, `==`, `!=`, `>`, `>=`, `<`, `<=`.
- Logical: `&&`, `||`, `!`, including nested combinations.
- Null checks: comparisons to `null` (strict or loose equality).
- Null coalescing (`??`) in projections and predicates.
- Arithmetic: `+`, `-`, `*`, `/`, `%` applied to numeric columns, literals, and parameters.
- String methods: `startsWith`, `endsWith`, `includes`, `toLowerCase`, `toUpperCase`.
- Case-insensitive helpers: `iequals`, `istartsWith`, `iendsWith`, `icontains` via `createQueryHelpers`.
- Array membership: `Array.includes(column)` or `parameterArray.includes(column)`.
- Parameter property access: nested objects and array indices (`params.filters.roles[0]`).
- Projection object literals referencing table columns.
- Grouping aggregation methods on grouped projections: `g.count()`, `g.sum(selector)`, `g.avg(selector)`, `g.min(selector)`, `g.max(selector)`.

Unsupported constructs (custom helper calls, `Math` functions, `Date.now()`, destructuring, optional chaining) cause parsing to fail immediately.

---

## 5. Detailed Query Reference

Each subsection provides TypeScript, PostgreSQL SQL, SQLite SQL, and parameter output. Examples mirror the adapter tests so the emitted SQL is representative of actual behaviour.

### 5.1 Filtering (`where`)

#### Basic comparison

```typescript
const adults = selectStatement(() => from<User>("users").where((u) => u.age >= 18), {});
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "age" >= $(__p1)
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "age" >= @__p1
```

```json
{ "__p1": 18 }
```

#### Combining multiple predicates

```typescript
const activeRange = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.age >= 21)
      .where((u) => u.age <= 60)
      .where((u) => u.active === true),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users"
WHERE "age" >= $(__p1) AND "age" <= $(__p2) AND "active" = $(__p3)
```

```sql
-- SQLite
SELECT * FROM "users"
WHERE "age" >= @__p1 AND "age" <= @__p2 AND "active" = @__p3
```

```json
{ "__p1": 21, "__p2": 60, "__p3": true }
```

#### Logical nesting and arithmetic

```typescript
const premium = selectStatement(
  () =>
    from<User>("users").where(
      (u) => (u.salary * 0.9 > 150_000 && u.age < 55) || u.active === false,
    ),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users"
WHERE ((("salary" * $(__p1)) > $(__p2) AND "age" < $(__p3)) OR "active" = $(__p4))
```

```sql
-- SQLite
SELECT * FROM "users"
WHERE ((("salary" * @__p1) > @__p2 AND "age" < @__p3) OR "active" = @__p4)
```

```json
{ "__p1": 0.9, "__p2": 150000, "__p3": 55, "__p4": false }
```

#### Null checks and null coalescing

```typescript
const preferredName = selectStatement(
  () => from<User>("users").where((u) => (u.nickname ?? u.name) === "anonymous"),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE COALESCE("nickname", "name") = $(__p1)
```

```sql
-- SQLite
SELECT * FROM "users" WHERE COALESCE("nickname", "name") = @__p1
```

```json
{ "__p1": "anonymous" }
```

#### String operations on columns

```typescript
const emailFilters = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.email.startsWith("admin"))
      .where((u) => u.email.endsWith("@example.com"))
      .where((u) => u.name.toLowerCase() === "john"),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users"
WHERE "email" LIKE $(__p1) || '%'
  AND "email" LIKE '%' || $(__p2)
  AND LOWER("name") = $(__p3)
```

```sql
-- SQLite
SELECT * FROM "users"
WHERE "email" LIKE @__p1 || '%'
  AND "email" LIKE '%' || @__p2
  AND LOWER("name") = @__p3
```

```json
{ "__p1": "admin", "__p2": "@example.com", "__p3": "john" }
```

#### Case-insensitive helpers

```typescript
import { createQueryHelpers } from "@webpods/tinqer";

const helpers = createQueryHelpers();

const insensitive = selectStatement(
  (_: unknown, h = helpers) =>
    from<User>("users").where((u) => h.functions.iequals(u.name, "ALICE")),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE LOWER("name") = LOWER($(__p1))
```

```sql
-- SQLite
SELECT * FROM "users" WHERE LOWER("name") = LOWER(@__p1)
```

```json
{ "__p1": "ALICE" }
```

#### Array membership (`IN`)

```typescript
const allowed = selectStatement(
  () => from<User>("users").where((u) => ["admin", "support", "auditor"].includes(u.role)),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "role" IN ($(__p1), $(__p2), $(__p3))
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "role" IN (@__p1, @__p2, @__p3)
```

```json
{ "__p1": "admin", "__p2": "support", "__p3": "auditor" }
```

Negating the predicate (`!array.includes(...)`) yields `NOT IN`.

#### Combined filter example

```typescript
const helpers = createQueryHelpers();

const advancedFilter = selectStatement(
  (params: { minAge: number; categories: string[] }, h = helpers) =>
    from<User>("users")
      .where((u) => u.age >= params.minAge)
      .where((u) => params.categories.includes(u.departmentId.toString()))
      .where((u) => h.functions.icontains(u.email, "company")),
  { minAge: 25, categories: ["10", "11"] },
);
```

```sql
-- PostgreSQL
SELECT * FROM "users"
WHERE "age" >= $(minAge)
  AND "departmentId" IN ($(categories[0]), $(categories[1]))
  AND LOWER("email") LIKE '%' || LOWER($(__p1)) || '%'
```

```sql
-- SQLite
SELECT * FROM "users"
WHERE "age" >= @minAge
  AND "departmentId" IN (@categories[0], @categories[1])
  AND LOWER("email") LIKE '%' || LOWER(@__p1) || '%'
```

```json
{ "minAge": 25, "categories[0]": "10", "categories[1]": "11", "__p1": "company" }
```

### 5.2 Projections (`select`)

#### Full row projection (identity)

```typescript
const fullRow = selectStatement(() => from<User>("users").select((u) => u), {});
```

```sql
-- PostgreSQL
SELECT * FROM "users"
```

```sql
-- SQLite
SELECT * FROM "users"
```

#### Object projection

```typescript
const summary = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.active)
      .select((u) => ({
        id: u.id,
        name: u.name,
        contact: {
          email: u.email,
        },
      })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "id" AS "id", "name" AS "name", "email" AS "contact.email" FROM "users" WHERE "active"
```

```sql
-- SQLite
SELECT "id" AS "id", "name" AS "name", "email" AS "contact.email" FROM "users" WHERE "active"
```

#### Projection with null coalescing and arithmetic

```typescript
const pricing = selectStatement(
  () =>
    from<Product>("products").select((p) => ({
      id: p.id,
      name: p.name,
      effectivePrice: p.price - (p.discount ?? 0),
    })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "id" AS "id", "name" AS "name", ("price" - COALESCE("discount", $(__p1))) AS "effectivePrice" FROM "products"
```

```sql
-- SQLite
SELECT "id" AS "id", "name" AS "name", ("price" - COALESCE("discount", @__p1)) AS "effectivePrice" FROM "products"
```

```json
{ "__p1": 0 }
```

### 5.3 Ordering (`orderBy`, `orderByDescending`, `thenBy`)

#### Single key ascending

```typescript
const alphabetical = selectStatement(() => from<User>("users").orderBy((u) => u.name), {});
```

```sql
-- PostgreSQL
SELECT * FROM "users" ORDER BY "name" ASC
```

```sql
-- SQLite
SELECT * FROM "users" ORDER BY "name" ASC
```

#### Mixed ordering

```typescript
const ordered = selectStatement(
  () =>
    from<User>("users")
      .orderBy((u) => u.departmentId)
      .thenByDescending((u) => u.salary)
      .thenBy((u) => u.name),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" ORDER BY "departmentId" ASC, "salary" DESC, "name" ASC
```

```sql
-- SQLite
SELECT * FROM "users" ORDER BY "departmentId" ASC, "salary" DESC, "name" ASC
```

### 5.4 Distinct (`distinct`)

```typescript
const departments = selectStatement(
  () =>
    from<User>("users")
      .select((u) => u.departmentId)
      .distinct(),
  {},
);
```

```sql
-- PostgreSQL
SELECT DISTINCT "departmentId" AS "departmentId" FROM "users"
```

```sql
-- SQLite
SELECT DISTINCT "departmentId" AS "departmentId" FROM "users"
```

### 5.5 Pagination (`skip`, `take`)

#### Offset/limit pattern

```typescript
const page = selectStatement(
  () =>
    from<User>("users")
      .orderBy((u) => u.id)
      .skip(30)
      .take(15),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" ORDER BY "id" ASC LIMIT $(__p2) OFFSET $(__p1)
```

```sql
-- SQLite
SELECT * FROM "users" ORDER BY "id" ASC LIMIT @__p2 OFFSET @__p1
```

```json
{ "__p1": 30, "__p2": 15 }
```

#### Pagination with filtering

```typescript
const filteredPage = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.active)
      .orderBy((u) => u.name)
      .skip(50)
      .take(25),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "active" ORDER BY "name" ASC LIMIT $(__p3) OFFSET $(__p2)
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "active" ORDER BY "name" ASC LIMIT @__p3 OFFSET @__p2
```

```json
{ "__p1": true, "__p2": 50, "__p3": 25 }
```

### 5.6 Joins (`join`)

#### Simple inner join

```typescript
const userDepartments = selectStatement(
  () =>
    from<User>("users").join(
      from<Department>("departments"),
      (u) => u.departmentId,
      (d) => d.id,
      (u, d) => ({ userName: u.name, departmentName: d.name }),
    ),
  {},
);
```

```sql
-- PostgreSQL
SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName"
FROM "users" AS "t0"
INNER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"
```

```sql
-- SQLite
SELECT "t0"."name" AS "userName", "t1"."name" AS "departmentName"
FROM "users" AS "t0"
INNER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"
```

#### Join with additional filter

```typescript
const regionOrders = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.id > 100)
      .join(
        from<Order>("orders"),
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ userName: u.name, total: o.total }),
      )
      .where((row) => row.total > 500),
  {},
);
```

```sql
-- PostgreSQL
SELECT "t0"."name" AS "userName", "t1"."total" AS "total"
FROM "users" AS "t0"
INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId"
WHERE "t0"."id" > $(__p1) AND "t1"."total" > $(__p2)
```

```sql
-- SQLite
SELECT "t0"."name" AS "userName", "t1"."total" AS "total"
FROM "users" AS "t0"
INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId"
WHERE "t0"."id" > @__p1 AND "t1"."total" > @__p2
```

```json
{ "__p1": 100, "__p2": 500 }
```

#### Join with grouped results

```typescript
const totalsByDepartment = selectStatement(
  () =>
    from<User>("users")
      .join(
        from<Order>("orders"),
        (u) => u.id,
        (o) => o.userId,
        (u, o) => ({ u, o }),
      )
      .groupBy((joined) => joined.u.departmentId)
      .select((g) => ({
        departmentId: g.key,
        totalOrders: g.count(),
        revenue: g.sum((row) => row.o.total),
      })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "t0"."departmentId" AS "departmentId", COUNT(*) AS "totalOrders", SUM("t1"."total") AS "revenue"
FROM "users" AS "t0"
INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId"
GROUP BY "t0"."departmentId"
```

```sql
-- SQLite
SELECT "t0"."departmentId" AS "departmentId", COUNT(*) AS "totalOrders", SUM("t1"."total") AS "revenue"
FROM "users" AS "t0"
INNER JOIN "orders" AS "t1" ON "t0"."id" = "t1"."userId"
GROUP BY "t0"."departmentId"
```

### 5.7 Grouping and Aggregation (`groupBy`, `count`, `sum`, `avg`, `min`, `max`)

#### Basic grouping

```typescript
const byDepartment = selectStatement(() => from<User>("users").groupBy((u) => u.departmentId), {});
```

```sql
-- PostgreSQL
SELECT "departmentId" FROM "users" GROUP BY "departmentId"
```

```sql
-- SQLite
SELECT "departmentId" FROM "users" GROUP BY "departmentId"
```

#### Group with multiple aggregates

```typescript
const departmentStats = selectStatement(
  () =>
    from<User>("users")
      .groupBy((u) => u.departmentId)
      .select((g) => ({
        departmentId: g.key,
        headcount: g.count(),
        totalSalary: g.sum((u) => u.salary),
        averageSalary: g.avg((u) => u.salary),
        maxSalary: g.max((u) => u.salary),
      }))
      .orderByDescending((row) => row.totalSalary),
  {},
);
```

```sql
-- PostgreSQL
SELECT "departmentId" AS "departmentId", COUNT(*) AS "headcount", SUM("salary") AS "totalSalary", AVG("salary") AS "averageSalary", MAX("salary") AS "maxSalary"
FROM "users"
GROUP BY "departmentId"
ORDER BY "totalSalary" DESC
```

```sql
-- SQLite
SELECT "departmentId" AS "departmentId", COUNT(*) AS "headcount", SUM("salary") AS "totalSalary", AVG("salary") AS "averageSalary", MAX("salary") AS "maxSalary"
FROM "users"
GROUP BY "departmentId"
ORDER BY "totalSalary" DESC
```

#### Group with post-filter (application-level HAVING)

```typescript
const largeDepartments = await executeSelect(
  db,
  () =>
    from<User>("users")
      .groupBy((u) => u.departmentId)
      .select((g) => ({ departmentId: g.key, headcount: g.count() }))
      .where((row) => row.headcount > 5),
  {},
);
```

The adapter emits the `WHERE` on the grouped projection; explicit HAVING clauses are not generated.

### 5.8 Scalar Aggregates on Root Queries

```typescript
const totals = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.active === true)
      .sum((u) => u.salary),
  {},
);
```

```sql
-- PostgreSQL
SELECT SUM("salary") FROM "users" WHERE "active" = $(__p1)
```

```sql
-- SQLite
SELECT SUM("salary") FROM "users" WHERE "active" = @__p1
```

```json
{ "__p1": true }
```

`count`, `average`, `min`, and `max` follow the same structure. `count` also accepts a predicate:

```typescript
const activeCount = selectStatement(() => from<User>("users").count((u) => u.active), {});
```

```sql
-- PostgreSQL
SELECT COUNT(*) FROM "users" WHERE "active"
```

```sql
-- SQLite
SELECT COUNT(*) FROM "users" WHERE "active"
```

### 5.9 Quantifiers (`any`, `all`)

```typescript
const hasAdults = selectStatement(() => from<User>("users").any((u) => u.age >= 18), {});
```

```sql
-- PostgreSQL
SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" WHERE "age" >= $(__p1)) THEN 1 ELSE 0 END
```

```sql
-- SQLite
SELECT CASE WHEN EXISTS(SELECT 1 FROM "users" WHERE "age" >= @__p1) THEN 1 ELSE 0 END
```

```json
{ "__p1": 18 }
```

`all` emits a `NOT EXISTS` check:

```typescript
const allActive = selectStatement(() => from<User>("users").all((u) => u.active === true), {});
```

```sql
-- PostgreSQL
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE NOT ("active" = $(__p1))) THEN 1 ELSE 0 END
```

```sql
-- SQLite
SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM "users" WHERE NOT ("active" = @__p1)) THEN 1 ELSE 0 END
```

### 5.10 Element Retrieval (`first`, `firstOrDefault`, `single`, `singleOrDefault`, `last`, `lastOrDefault`)

```typescript
const newestUser = selectStatement(
  () =>
    from<User>("users")
      .orderBy((u) => u.createdAt)
      .last(),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" ORDER BY "createdAt" ASC LIMIT 1
```

```sql
-- SQLite
SELECT * FROM "users" ORDER BY "createdAt" ASC LIMIT 1
```

`single` ensures at most one result; `firstOrDefault`/`singleOrDefault` return `NULL` when no rows match. `last` and `lastOrDefault` automatically reverse ordering when no explicit `orderBy` exists.

### 5.11 Materialisation (`toArray`)

```typescript
const activeUsers = await executeSelect(
  db,
  () =>
    from<User>("users")
      .where((u) => u.active)
      .orderBy((u) => u.name)
      .toArray(),
  {},
);
```

The generated SQL matches the chain preceding `toArray`.

---

## 6. Parameters and Auto-Parameterisation

### 6.1 External Parameter Objects

```typescript
const filtered = selectStatement(
  (params: { minAge: number; role: string }) =>
    from<User>("users")
      .where((u) => u.age >= params.minAge)
      .where((u) => u.role === params.role),
  { minAge: 30, role: "manager" },
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "age" >= $(minAge) AND "role" = $(role)
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "age" >= @minAge AND "role" = @role
```

```json
{ "minAge": 30, "role": "manager" }
```

Nested properties and array indices are preserved (`params.filters.departments[0]`).

### 6.2 Literal Auto-Parameterisation

```typescript
const autoParams = selectStatement(
  () => from<User>("users").where((u) => u.departmentId === 7 && u.name.startsWith("A")),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "departmentId" = $(__p1) AND "name" LIKE $(__p2) || '%'
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "departmentId" = @__p1 AND "name" LIKE @__p2 || '%'
```

```json
{ "__p1": 7, "__p2": "A" }
```

### 6.3 Array Membership (`Array.includes`)

```typescript
const membership = selectStatement(
  () => from<User>("users").where((u) => [1, 2, 3].includes(u.id)),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE "id" IN ($(__p1), $(__p2), $(__p3))
```

```sql
-- SQLite
SELECT * FROM "users" WHERE "id" IN (@__p1, @__p2, @__p3)
```

```json
{ "__p1": 1, "__p2": 2, "__p3": 3 }
```

Parameterized array example:

```typescript
const dynamicMembership = selectStatement(
  (params: { allowed: readonly number[] }) =>
    from<User>("users").where((u) => params.allowed.includes(u.id)),
  { allowed: [5, 8] },
);
```

```json
{ "allowed[0]": 5, "allowed[1]": 8 }
```

### 6.4 Case-Insensitive Helper Functions

```typescript
const helpers = createQueryHelpers();

const ic = selectStatement(
  (_: unknown, h = helpers) =>
    from<User>("users").where((u) => h.functions.icontains(u.email, "support")),
  {},
);
```

```sql
-- PostgreSQL
SELECT * FROM "users" WHERE LOWER("email") LIKE '%' || LOWER($(__p1)) || '%'
```

```sql
-- SQLite
SELECT * FROM "users" WHERE LOWER("email") LIKE '%' || LOWER(@__p1) || '%'
```

```json
{ "__p1": "support" }
```

---

## 7. CRUD Operations (INSERT, UPDATE, DELETE)

Tinqer provides full CRUD support with the same type-safety and lambda expression support as SELECT queries. All CRUD operations follow the same pattern: builder functions return operation chains, statement functions generate SQL, and execute functions run the queries.

### 7.1 INSERT Statements

The `insertInto` function creates INSERT operations with type-safe value specifications.

#### Basic INSERT

```typescript
import { insertInto, insertStatement } from "@webpods/tinqer";

// Insert with literal values
const insert = insertStatement(
  () =>
    insertInto(db, "users").values(() => ({
      name: "Alice",
      age: 30,
      email: "alice@example.com",
    })),
  {},
);
```

Generated SQL:

```sql
-- PostgreSQL
INSERT INTO "users" ("name", "age", "email")
VALUES ($(__p1), $(__p2), $(__p3))

-- SQLite
INSERT INTO "users" ("name", "age", "email")
VALUES (@__p1, @__p2, @__p3)
```

#### INSERT with External Parameters

```typescript
const insert = insertStatement(
  (p: { name: string; age: number }) =>
    insertInto(db, "users").values(() => ({
      name: p.name,
      age: p.age,
      email: "default@example.com",
    })),
  { name: "Bob", age: 25 },
);
```

Generated SQL uses external parameters directly:

```sql
INSERT INTO "users" ("name", "age", "email")
VALUES ($(name), $(age), $(__p1))  -- PostgreSQL
VALUES (@name, @age, @__p1)        -- SQLite
```

#### INSERT with RETURNING Clause

Both PostgreSQL and SQLite (3.35.0+) support the RETURNING clause to retrieve values from inserted rows:

```typescript
// Return specific columns
const insertWithReturn = insertStatement(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "Charlie", age: 35 }))
      .returning((u) => ({ id: u.id, createdAt: u.createdAt })),
  {},
);

// Return all columns
const insertReturnAll = insertStatement(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "David", age: 40 }))
      .returning((u) => u), // Returns *
  {},
);
```

#### NULL Values in INSERT

```typescript
const insert = insertStatement(
  () =>
    insertInto(db, "users").values(() => ({
      name: "Eve",
      email: null, // Generates NULL, not parameterized
      phone: undefined, // Column omitted from INSERT
    })),
  {},
);
```

### 7.2 UPDATE Statements

The `updateTable` function creates UPDATE operations with mandatory SET clause and optional WHERE conditions.

#### Basic UPDATE

```typescript
import { updateTable, updateStatement } from "@webpods/tinqer";

const update = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 31, lastModified: new Date() }))
      .where((u) => u.id === 1),
  {},
);
```

Generated SQL:

```sql
-- PostgreSQL
UPDATE "users"
SET "age" = $(__p1), "lastModified" = $(__p2)
WHERE "id" = $(__p3)

-- SQLite
UPDATE "users"
SET "age" = @__p1, "lastModified" = @__p2
WHERE "id" = @__p3
```

#### UPDATE with Complex WHERE

```typescript
const update = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ status: "inactive" }))
      .where((u) => u.lastLogin < new Date("2023-01-01") && u.role !== "admin"),
  {},
);
```

#### UPDATE with RETURNING Clause

```typescript
const updateWithReturn = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 32 }))
      .where((u) => u.id === 2)
      .returning((u) => ({ id: u.id, age: u.age, updatedAt: u.updatedAt })),
  {},
);
```

#### Full Table UPDATE (Requires Explicit Permission)

```typescript
// UPDATE without WHERE requires explicit permission
const updateAll = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ isActive: true }))
      .allowFullTableUpdate(), // Required flag
  {},
);
```

Without the flag, attempting an UPDATE without WHERE throws an error:

```
Error: UPDATE requires a WHERE clause or explicit allowFullTableUpdate().
Full table updates are dangerous and must be explicitly allowed.
```

### 7.3 DELETE Statements

The `deleteFrom` function creates DELETE operations with optional WHERE conditions.

#### Basic DELETE

```typescript
import { deleteFrom, deleteStatement } from "@webpods/tinqer";

const del = deleteStatement(() => deleteFrom(db, "users").where((u) => u.age > 100), {});
```

Generated SQL:

```sql
DELETE FROM "users" WHERE "age" > $(__p1)  -- PostgreSQL
DELETE FROM "users" WHERE "age" > @__p1    -- SQLite
```

#### DELETE with Complex Conditions

```typescript
const del = deleteStatement(
  () =>
    deleteFrom(db, "users").where(
      (u) => u.isDeleted === true || (u.age < 18 && u.role !== "admin") || u.email === null,
    ),
  {},
);
```

#### DELETE with IN Clause

```typescript
const del = deleteStatement(
  (p: { userIds: number[] }) => deleteFrom(db, "users").where((u) => p.userIds.includes(u.id)),
  { userIds: [1, 2, 3, 4, 5] },
);
```

Generated SQL:

```sql
-- PostgreSQL
DELETE FROM "users"
WHERE "id" IN ($(userIds[0]), $(userIds[1]), $(userIds[2]), $(userIds[3]), $(userIds[4]))

-- SQLite
DELETE FROM "users"
WHERE "id" IN (@userIds[0], @userIds[1], @userIds[2], @userIds[3], @userIds[4])
```

#### Full Table DELETE (Requires Explicit Permission)

```typescript
// DELETE without WHERE requires explicit permission
const deleteAll = deleteStatement(
  () => deleteFrom(db, "users").allowFullTableDelete(), // Required flag
  {},
);
```

### 7.4 Safety Features

Tinqer includes multiple safety guards for CRUD operations:

#### Mandatory WHERE Clauses

UPDATE and DELETE operations require WHERE clauses by default to prevent accidental full-table operations:

```typescript
// This throws an error
deleteStatement(() => deleteFrom(db, "users"), {});
// Error: DELETE requires a WHERE clause or explicit allowFullTableDelete()

// This works
deleteStatement(() => deleteFrom(db, "users").allowFullTableDelete(), {});
```

#### Type Safety

All CRUD operations maintain full TypeScript type safety:

```typescript
interface User {
  id: number;
  name: string;
  email: string | null;
  age: number;
}

// Type error: 'username' doesn't exist on User
insertInto<User>("users").values(() => ({
  username: "Alice", // ❌ Type error
}));

// Type error: age must be number
updateTable<User>("users").set(() => ({
  age: "30", // ❌ Type error - must be number
}));
```

#### Parameter Sanitization

All values are automatically parameterized to prevent SQL injection:

```typescript
const maliciousName = "'; DROP TABLE users; --";
const insert = insertStatement(
  () =>
    insertInto(db, "users").values(() => ({
      name: maliciousName, // Safely parameterized
    })),
  {},
);
// Generates: INSERT INTO "users" ("name") VALUES ($(__p1))
// Parameters: { __p1: "'; DROP TABLE users; --" }
```

### 7.5 Executing CRUD Operations

The adapter packages provide execution functions for all CRUD operations:

#### PostgreSQL (pg-promise)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

// Execute INSERT with RETURNING
const insertedUser = await executeInsert(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "Frank", age: 28 }))
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
  pgConnection,
);
// Returns: { id: 123, name: "Frank" }

// Execute UPDATE with affected row count
const updateCount = await executeUpdate(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 29 }))
      .where((u) => u.id === insertedUser.id),
  {},
  pgConnection,
);
// Returns number of affected rows

// Execute DELETE
const deleteCount = await executeDelete(
  () => deleteFrom(db, "users").where((u) => u.id === insertedUser.id),
  {},
  pgConnection,
);
```

#### SQLite (better-sqlite3)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-better-sqlite3";

// Execute INSERT with lastInsertRowid
const result = executeInsert(
  () => insertInto(db, "users").values(() => ({ name: "Grace", age: 30 })),
  {},
  sqliteDb,
);
// Returns: { lastInsertRowid: 124, changes: 1 }

// Execute with RETURNING (SQLite 3.35.0+)
const insertedUser = executeInsert(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "Henry", age: 32 }))
      .returning((u) => u),
  {},
  sqliteDb,
);
// Returns the inserted row
```

#### Transaction Support

Both adapters support transactions through their respective database drivers:

```typescript
// PostgreSQL transactions
await pgConnection.tx(async (t) => {
  const user = await executeInsert(
    () =>
      insertInto(db, "users")
        .values(() => ({ name: "Ivy" }))
        .returning((u) => u.id),
    {},
    t, // Use transaction object
  );

  await executeInsert(
    () =>
      insertInto(db, "user_logs").values(() => ({
        userId: user.id,
        action: "created",
      })),
    {},
    t,
  );
});

// SQLite transactions
const transaction = sqliteDb.transaction(() => {
  executeInsert(/* ... */);
  executeUpdate(/* ... */);
});
transaction();
```

---

## 8. Execution APIs

### 8.1 `selectStatement` Function

Returns the generated SQL and merged parameters without executing the statement.

```typescript
const { sql, params } = selectStatement(
  () =>
    from<User>("users")
      .where((u) => u.active)
      .orderBy((u) => u.name)
      .take(10),
  {},
);
```

### 8.2 `executeSelect` and `executeSelectSimple`

#### PostgreSQL

```typescript
const rows = await executeSelect(
  db,
  () =>
    from<User>("users")
      .where((u) => u.active)
      .orderBy((u) => u.id)
      .skip(20)
      .take(10),
  {},
  {
    onSql: ({ sql, params }) => {
      console.log(sql, params);
    },
  },
);

const allUsers = await executeSelectSimple(db, () => from<User>("users"));
```

#### SQLite

```typescript
const rows = await executeSelect(
  sqlite,
  (params: { category: string }) =>
    from<Product>("products")
      .where((p) => p.category === params.category)
      .orderByDescending((p) => p.price),
  { category: "electronics" },
);

const everything = await executeSelectSimple(sqlite, () => from<Product>("products"));
```

### 8.3 CRUD Execution Functions

The adapter packages provide specialized execution functions for CRUD operations:

- `insertStatement(builder, params)` - Generate INSERT SQL
- `updateStatement(builder, params)` - Generate UPDATE SQL
- `deleteStatement(builder, params)` - Generate DELETE SQL
- `executeInsert(builder, params, db)` - Execute INSERT and return results
- `executeUpdate(builder, params, db)` - Execute UPDATE and return affected rows
- `executeDelete(builder, params, db)` - Execute DELETE and return affected rows

### 8.4 `toSql`

```typescript
const queryable = from<User>("users").where((u) => u.age >= 21);
const { text, parameters } = toSql(queryable);
```

---

## 9. Adapter-Specific Notes

### 9.1 PostgreSQL (pg-promise)

- Parameters use pg-promise syntax `$(name)`.
- `executeSelect` uses `db.any` for sequences and `db.one` for scalar aggregates.
- `last*` operations emit `ORDER BY ... DESC LIMIT 1` when no explicit descending order exists.
- Parameters are forwarded without mutation.

### 9.2 SQLite (better-sqlite3)

- Parameters use `@name` placeholders.
- Booleans are converted to `1`/`0`; dates become `YYYY-MM-DD HH:MM:SS` strings.
- `executeSelect` prepares the SQL and invokes `.all()` or `.get()` depending on the terminal operation.

---

## 10. Type-Safe Contexts (`createContext`)

```typescript
import { createContext, from } from "@webpods/tinqer";

type Schema = {
  users: User;
  departments: Department;
};

const ctx = createContext<Schema>();

const users = from(ctx, "users");
const departments = from(ctx, "departments");
```

---

## 11. Helper Utilities (`createQueryHelpers`)

```typescript
const helpers = createQueryHelpers();

const caseInsensitive = selectStatement(
  (_: unknown, h = helpers) =>
    from<User>("users").where((u) => h.functions.iendsWith(u.email, ".org")),
  {},
);
```

---

## 12. Date and Time Handling

- Date literals should be created with `new Date("YYYY-MM-DDTHH:mm:ssZ")` and are treated as parameters.
- Comparisons (`==`, `!=`, `>`, `>=`, `<`, `<=`) are supported on date/time columns.
- SQLite adapter formats `Date` parameters as `YYYY-MM-DD HH:MM:SS`.
- Time zone transitions (e.g., DST) require explicit values; no automatic adjustment occurs.

Example:

```typescript
const upcoming = selectStatement(
  (params: { cutoff: Date }) =>
    from<Event>("events")
      .where((e) => e.startDate >= params.cutoff)
      .orderBy((e) => e.startDate),
  { cutoff: new Date("2024-03-10T00:00:00Z") },
);
```

---

## 13. Limitations and Unsupported Features

- No MERGE operations or built-in transaction APIs (use database driver transactions).
- Only inner joins are supported. Left/right joins, `DefaultIfEmpty`, and `GroupJoin` are not available.
- `selectMany`, set operators (`union`, `intersect`, `except`, `concat`), and `longCount` exist on the fluent API but are not implemented; using them throws an error.
- HAVING clauses are not generated. Filter grouped results with an additional `where` on the grouped projection.
- No window functions or analytic aggregates.
- No translation for `Math.*`, `Date.now()`, user-defined helper calls, or arbitrary library functions.
- String trimming, substring extraction, and length checks are not currently translated.
- `Queryable.contains` (terminal) is not implemented.
- Queries rely on `Function.prototype.toString()`; avoid minifying or transpiling query lambdas into incompatible forms.

---

## 13. Differences from .NET LINQ to SQL

- Lambdas cannot capture external variables; all values must be passed through a parameter object.
- Supported method set is limited compared to LINQ to SQL (string case methods, `startsWith`, `endsWith`, `includes`, arithmetic, null coalescing).
- Only inner joins are available; outer joins require manual SQL.
- Set operators, `SelectMany`, `GroupJoin`, and `DefaultIfEmpty` are not implemented.
- No deferred execution via enumeration; SQL generation only occurs inside the builder function.
- Grouping projections support `g.count`, `g.sum`, `g.avg`, `g.min`, `g.max`; more advanced grouping patterns require additional work.

---

## 14. CRUD Operations (INSERT, UPDATE, DELETE)

Tinqer supports CRUD operations with the same type-safety and lambda expression support as SELECT queries.

### 14.1 INSERT Statements

```typescript
import { insertInto, insertStatement } from "@webpods/tinqer";

// Basic INSERT with values
const insert = insertStatement(
  () =>
    insertInto(db, "users").values(() => ({
      name: "Alice",
      age: 30,
      email: "alice@example.com",
    })),
  {},
);
```

```sql
-- PostgreSQL
INSERT INTO "users" ("name", "age", "email")
VALUES ($(__p1), $(__p2), $(__p3))

-- SQLite
INSERT INTO "users" ("name", "age", "email")
VALUES (@__p1, @__p2, @__p3)
```

#### INSERT with parameters

```typescript
const insert = insertStatement(
  (p: { name: string; age: number }) =>
    insertInto(db, "users").values(() => ({
      name: p.name,
      age: p.age,
      email: "default@example.com",
    })),
  { name: "Bob", age: 25 },
);
```

#### INSERT with RETURNING clause

Both PostgreSQL and SQLite (3.35.0+) support the RETURNING clause:

```typescript
// Return specific columns
const insertWithReturn = insertStatement(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "Charlie", age: 35 }))
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
);

// Return all columns
const insertReturnAll = insertStatement(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "David", age: 40 }))
      .returning((u) => u),
  {},
);
```

```sql
-- Return specific columns
INSERT INTO "users" ("name", "age")
VALUES ($(__p1), $(__p2))
RETURNING "id" AS "id", "name" AS "name"

-- Return all columns
INSERT INTO "users" ("name", "age")
VALUES ($(__p1), $(__p2))
RETURNING *
```

### 14.2 UPDATE Statements

```typescript
import { updateTable, updateStatement } from "@webpods/tinqer";

// Basic UPDATE with WHERE clause
const update = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 31, email: "newemail@example.com" }))
      .where((u) => u.id === 1),
  {},
);
```

```sql
-- PostgreSQL
UPDATE "users"
SET "age" = $(__p1), "email" = $(__p2)
WHERE "id" = $(__p3)

-- SQLite
UPDATE "users"
SET "age" = @__p1, "email" = @__p2
WHERE "id" = @__p3
```

#### UPDATE with parameters

```typescript
const update = updateStatement(
  (p: { userId: number; newAge: number }) =>
    updateTable(db, "users")
      .set(() => ({ age: p.newAge }))
      .where((u) => u.id === p.userId),
  { userId: 1, newAge: 35 },
);
```

#### UPDATE with RETURNING clause

```typescript
const updateWithReturn = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 32 }))
      .where((u) => u.id === 2)
      .returning((u) => u.age),
  {},
);
```

#### Full table UPDATE (requires explicit permission)

```typescript
// Must explicitly allow full table updates
const updateAll = updateStatement(
  () =>
    updateTable(db, "users")
      .set(() => ({ isActive: true }))
      .allowFullTableUpdate(), // Required for UPDATE without WHERE
  {},
);
```

### 14.3 DELETE Statements

```typescript
import { deleteFrom, deleteStatement } from "@webpods/tinqer";

// Basic DELETE with WHERE clause
const del = deleteStatement(() => deleteFrom(db, "users").where((u) => u.age > 100), {});
```

```sql
-- PostgreSQL
DELETE FROM "users" WHERE "age" > $(__p1)

-- SQLite
DELETE FROM "users" WHERE "age" > @__p1
```

#### DELETE with complex conditions

```typescript
const del = deleteStatement(
  () =>
    deleteFrom(db, "users").where(
      (u) => u.isDeleted === true || (u.age < 18 && u.role !== "Admin"),
    ),
  {},
);
```

#### Full table DELETE (requires explicit permission)

```typescript
// Must explicitly allow full table deletes
const deleteAll = deleteStatement(
  () => deleteFrom(db, "users").allowFullTableDelete(), // Required for DELETE without WHERE
  {},
);
```

### 14.4 Safety Features

Tinqer includes safety guards for UPDATE and DELETE operations:

1. **Mandatory WHERE clause**: UPDATE and DELETE operations require a WHERE clause by default
2. **Explicit permission for full table operations**: Use `allowFullTableUpdate()` or `allowFullTableDelete()` to perform operations without WHERE clauses
3. **Type safety**: All CRUD operations maintain TypeScript type safety throughout the query builder chain
4. **Parameter sanitization**: All values are automatically parameterized to prevent SQL injection

### 14.5 Executing CRUD Operations

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

// Execute INSERT
const insertResult = await executeInsert(
  () =>
    insertInto(db, "users")
      .values(() => ({ name: "Eve", age: 28 }))
      .returning((u) => u.id),
  {},
  pgConnection,
);

// Execute UPDATE
const updateResult = await executeUpdate(
  () =>
    updateTable(db, "users")
      .set(() => ({ age: 29 }))
      .where((u) => u.id === insertResult.id),
  {},
  pgConnection,
);

// Execute DELETE
const deleteResult = await executeDelete(
  () => deleteFrom(db, "users").where((u) => u.id === insertResult.id),
  {},
  pgConnection,
);
```

---

## 15. Troubleshooting

| Symptom                                          | Cause                                                                                                    | Resolution                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Failed to parse query`                          | Lambda uses an unsupported construct (captured variable, named function, helper call, template literal). | Rewrite the lambda using the supported subset; pass values via the parameter object.   |
| `Unknown query method`                           | Fluent method (`union`, `selectMany`, `longCount`, etc.) not implemented.                                | Remove the call or implement support before using it.                                  |
| Query returns no rows for `last*`                | No ordering specified and result set is empty.                                                           | Provide an explicit `orderBy` or switch to `lastOrDefault`.                            |
| SQLite booleans stored as `true`/`false` strings | Manual execution without adapter conversion.                                                             | Use `executeSelect`/`executeSelectSimple`, which convert booleans to integers.         |
| Auto-parameter names unfamiliar                  | Literals are auto-parameterised (`__pN`).                                                                | Use the `params` object returned by `selectStatement`; do not assume positional order. |
| Grouped projection filter acts like HAVING       | `where` after `groupBy` translates to a standard `WHERE`.                                                | Filter in application code or extend the generator for HAVING support.                 |

---

## 15. Development Notes

- Query behaviour is covered by unit and integration tests under `packages/tinqer/tests`, `packages/tinqer-sql-pg-promise/tests`, and `packages/tinqer-sql-better-sqlite3/tests`.
- `npm run lint`, `npm run build`, and `npm test` run linting, builds, and tests across all packages.
- Integration tests expect access to PostgreSQL (`127.0.0.1:5432`) and SQLite databases.

---

## 16. Appendices

### 16.1 Expression Tree Example

The query

```typescript
() =>
  from<User>("users")
    .where((u) => u.age >= 30)
    .select((u) => ({ id: u.id, name: u.name }));
```

is parsed into the following abstract representation:

```json
{
  "type": "queryOperation",
  "operationType": "select",
  "selector": {
    "type": "object",
    "properties": {
      "id": { "type": "column", "name": "id" },
      "name": { "type": "column", "name": "name" }
    }
  },
  "source": {
    "type": "queryOperation",
    "operationType": "where",
    "predicate": {
      "type": "comparison",
      "operator": ">=",
      "left": { "type": "column", "name": "age" },
      "right": { "type": "constant", "value": 30 }
    },
    "source": {
      "type": "queryOperation",
      "operationType": "from",
      "table": "users"
    }
  }
}
```

### 16.2 Generated SQL Inventory

Examples in this README correspond to the following adapter test suites:

- `packages/tinqer-sql-pg-promise/tests/where.test.ts`
- `packages/tinqer-sql-pg-promise/tests/where-complex.test.ts`
- `packages/tinqer-sql-pg-promise/tests/string-operations.test.ts`
- `packages/tinqer-sql-pg-promise/tests/case-insensitive-functions.test.ts`
- `packages/tinqer-sql-pg-promise/tests/in-operator.test.ts`
- `packages/tinqer-sql-pg-promise/tests/groupby.test.ts`
- `packages/tinqer-sql-pg-promise/tests/any-all-operations.test.ts`
- `packages/tinqer-sql-pg-promise/tests/terminal-operations.test.ts`
- Corresponding suites under `packages/tinqer-sql-better-sqlite3/tests`

---

```text
All examples are based on the current repository state. Update this document whenever new query shapes, helper functions, or adapters are added.
```
