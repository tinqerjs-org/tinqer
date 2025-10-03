[← Back to README](../README.md)

# Tinqer Query Operations Guide

Complete reference for all query operations, parameters, and CRUD functionality in Tinqer.

## Table of Contents

- [1. Filtering Operations](#1-filtering-operations)
  - [1.1 Basic Comparison](#11-basic-comparison)
  - [1.2 Multiple Predicates](#12-multiple-predicates)
  - [1.3 Logical Nesting and Arithmetic](#13-logical-nesting-and-arithmetic)
  - [1.4 Null Checks and Null Coalescing](#14-null-checks-and-null-coalescing)
  - [1.5 String Operations](#15-string-operations)
  - [1.6 Case-Insensitive Helpers](#16-case-insensitive-helpers)
  - [1.7 Array Membership (IN)](#17-array-membership-in)
  - [1.8 Combined Filter Example](#18-combined-filter-example)
- [2. Projections](#2-projections)
  - [2.1 Full Row Projection](#21-full-row-projection)
  - [2.2 Object Projection](#22-object-projection)
  - [2.3 Projection with Null Coalescing and Arithmetic](#23-projection-with-null-coalescing-and-arithmetic)
- [3. Ordering](#3-ordering)
  - [3.1 Single Key Ascending](#31-single-key-ascending)
  - [3.2 Mixed Ordering](#32-mixed-ordering)
- [4. Distinct Operations](#4-distinct-operations)
- [5. Pagination](#5-pagination)
  - [5.1 Offset/Limit Pattern](#51-offsetlimit-pattern)
  - [5.2 Pagination with Filtering](#52-pagination-with-filtering)
- [6. Joins](#6-joins)
  - [6.1 Simple Inner Join](#61-simple-inner-join)
  - [6.2 Join with Additional Filter](#62-join-with-additional-filter)
  - [6.3 Join with Grouped Results](#63-join-with-grouped-results)
- [7. Grouping and Aggregation](#7-grouping-and-aggregation)
  - [7.1 Basic Grouping](#71-basic-grouping)
  - [7.2 Group with Multiple Aggregates](#72-group-with-multiple-aggregates)
  - [7.3 Group with Post-Filter](#73-group-with-post-filter)
- [8. Scalar Aggregates on Root Queries](#8-scalar-aggregates-on-root-queries)
- [9. Quantifiers](#9-quantifiers)
  - [9.1 Any Operation](#91-any-operation)
  - [9.2 All Operation](#92-all-operation)
- [10. Element Retrieval](#10-element-retrieval)
- [11. Materialisation](#11-materialisation)
- [12. Parameters and Auto-Parameterisation](#12-parameters-and-auto-parameterisation)
  - [12.1 External Parameter Objects](#121-external-parameter-objects)
  - [12.2 Literal Auto-Parameterisation](#122-literal-auto-parameterisation)
  - [12.3 Array Membership](#123-array-membership)
  - [12.4 Case-Insensitive Helper Functions](#124-case-insensitive-helper-functions)
- [13. CRUD Operations](#13-crud-operations)
  - [13.1 INSERT Statements](#131-insert-statements)
  - [13.2 UPDATE Statements](#132-update-statements)
  - [13.3 DELETE Statements](#133-delete-statements)
  - [13.4 Safety Features](#134-safety-features)
  - [13.5 Executing CRUD Operations](#135-executing-crud-operations)

---

## 1. Filtering Operations

The `where` method applies predicates to filter query results. Multiple `where` calls are combined with AND logic.

### 1.1 Basic Comparison

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

### 1.2 Multiple Predicates

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

### 1.3 Logical Nesting and Arithmetic

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

### 1.4 Null Checks and Null Coalescing

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

### 1.5 String Operations

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

### 1.6 Case-Insensitive Helpers

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

### 1.7 Array Membership (IN)

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

### 1.8 Combined Filter Example

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

---

## 2. Projections

The `select` method transforms query results by projecting columns or computed expressions.

### 2.1 Full Row Projection

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

### 2.2 Object Projection

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

### 2.3 Projection with Null Coalescing and Arithmetic

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

---

## 3. Ordering

Methods `orderBy`, `orderByDescending`, `thenBy`, and `thenByDescending` control result ordering.

### 3.1 Single Key Ascending

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

### 3.2 Mixed Ordering

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

---

## 4. Distinct Operations

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

---

## 5. Pagination

Methods `skip` and `take` implement OFFSET and LIMIT clauses.

### 5.1 Offset/Limit Pattern

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

### 5.2 Pagination with Filtering

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

---

## 6. Joins

The `join` method creates INNER JOIN operations. Only inner joins are supported.

### 6.1 Simple Inner Join

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

### 6.2 Join with Additional Filter

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

### 6.3 Join with Grouped Results

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

---

## 7. Grouping and Aggregation

The `groupBy` method groups results and enables aggregate functions: `count`, `sum`, `avg`, `min`, `max`.

### 7.1 Basic Grouping

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

### 7.2 Group with Multiple Aggregates

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

### 7.3 Group with Post-Filter

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

---

## 8. Scalar Aggregates on Root Queries

Aggregate methods can be called directly on queries to return single values.

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

Methods `count`, `average`, `min`, and `max` follow the same structure. The `count` method also accepts a predicate:

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

---

## 9. Quantifiers

Methods `any` and `all` test whether elements satisfy conditions.

### 9.1 Any Operation

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

### 9.2 All Operation

The `all` method emits a `NOT EXISTS` check:

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

---

## 10. Element Retrieval

Methods `first`, `firstOrDefault`, `single`, `singleOrDefault`, `last`, and `lastOrDefault` retrieve single elements.

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

- `single` ensures at most one result
- `firstOrDefault` / `singleOrDefault` return `NULL` when no rows match
- `last` and `lastOrDefault` automatically reverse ordering when no explicit `orderBy` exists

---

## 11. Materialisation

Queries are executed directly without requiring a materialization method. The query builder returns results as arrays by default.

```typescript
const activeUsers = await executeSelect(
  db,
  () =>
    from<User>("users")
      .where((u) => u.active)
      .orderBy((u) => u.name),
  {},
);
```

The generated SQL matches the entire query chain.

---

## 12. Parameters and Auto-Parameterisation

Tinqer automatically parameterizes all values to prevent SQL injection and enable prepared statements.

### 12.1 External Parameter Objects

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

### 12.2 Literal Auto-Parameterisation

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

### 12.3 Array Membership

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

### 12.4 Case-Insensitive Helper Functions

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

## 13. CRUD Operations

Tinqer provides full CRUD support with the same type-safety and lambda expression support as SELECT queries. All CRUD operations follow the same pattern: builder functions return operation chains, statement functions generate SQL, and execute functions run the queries.

### 13.1 INSERT Statements

The `insertInto` function creates INSERT operations. Values are specified using direct object syntax (no lambda wrapping required).

#### Basic INSERT

```typescript
import { insertInto, insertStatement } from "@webpods/tinqer";

// Insert with literal values - direct object syntax
const insert = insertStatement(
  () =>
    insertInto(db, "users").values({
      name: "Alice",
      age: 30,
      email: "alice@example.com",
    }),
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

External variables must be passed via the params object - closure variables are not supported:

```typescript
const insert = insertStatement(
  (p: { name: string; age: number }) =>
    insertInto(db, "users").values({
      name: p.name,
      age: p.age,
      email: "default@example.com",
    }),
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
      .values({ name: "Charlie", age: 35 })
      .returning((u) => ({ id: u.id, createdAt: u.createdAt })),
  {},
);

// Return all columns
const insertReturnAll = insertStatement(
  () =>
    insertInto(db, "users")
      .values({ name: "David", age: 40 })
      .returning((u) => u), // Returns *
  {},
);
```

#### NULL Values in INSERT

```typescript
const insert = insertStatement(
  () =>
    insertInto(db, "users").values({
      name: "Eve",
      email: null, // Generates NULL, not parameterized
      phone: undefined, // Column omitted from INSERT
    }),
  {},
);
```

### 13.2 UPDATE Statements

The `updateTable` function creates UPDATE operations. The `.set()` method uses direct object syntax (no lambda wrapping required).

#### Basic UPDATE

```typescript
import { updateTable, updateStatement } from "@webpods/tinqer";

const update = updateStatement(
  () =>
    updateTable(db, "users")
      .set({ age: 31, lastModified: new Date() })
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

#### UPDATE with External Parameters

External variables must be passed via the params object:

```typescript
const update = updateStatement(
  (p: { newAge: number }) =>
    updateTable(db, "users")
      .set({ age: p.newAge })
      .where((u) => u.id === 1),
  { newAge: 32 },
);
```

#### UPDATE with Complex WHERE

```typescript
const update = updateStatement(
  () =>
    updateTable(db, "users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < new Date("2023-01-01") && u.role !== "admin"),
  {},
);
```

#### UPDATE with RETURNING Clause

```typescript
const updateWithReturn = updateStatement(
  () =>
    updateTable(db, "users")
      .set({ age: 32 })
      .where((u) => u.id === 2)
      .returning((u) => ({ id: u.id, age: u.age, updatedAt: u.updatedAt })),
  {},
);
```

#### Full Table UPDATE (Requires Explicit Permission)

```typescript
// UPDATE without WHERE requires explicit permission
const updateAll = updateStatement(
  () => updateTable(db, "users").set({ isActive: true }).allowFullTableUpdate(), // Required flag
  {},
);
```

Without the flag, attempting an UPDATE without WHERE throws an error:

```
Error: UPDATE requires a WHERE clause or explicit allowFullTableUpdate().
Full table updates are dangerous and must be explicitly allowed.
```

### 13.3 DELETE Statements

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

### 13.4 Safety Features

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
insertInto<User>("users").values({
  username: "Alice", // ❌ Type error
});

// Type error: age must be number
updateTable<User>("users").set({
  age: "30", // ❌ Type error - must be number
});
```

#### Parameter Sanitization

All values are automatically parameterized to prevent SQL injection:

```typescript
const maliciousName = "'; DROP TABLE users; --";
const insert = insertStatement(
  () =>
    insertInto(db, "users").values({
      name: maliciousName, // Safely parameterized
    }),
  {},
);
// Generates: INSERT INTO "users" ("name") VALUES ($(__p1))
// Parameters: { __p1: "'; DROP TABLE users; --" }
```

### 13.5 Executing CRUD Operations

The adapter packages provide execution functions for all CRUD operations:

#### PostgreSQL (pg-promise)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

// Execute INSERT with RETURNING
const insertedUsers = await executeInsert(
  db,
  () =>
    insertInto(dbContext, "users")
      .values({ name: "Frank", age: 28 })
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
);
// Returns: [{ id: 123, name: "Frank" }]

// Execute UPDATE - returns affected row count
const updateCount = await executeUpdate(
  db,
  () =>
    updateTable(dbContext, "users")
      .set({ age: 29 })
      .where((u) => u.id === 123),
  {},
);
// Returns number of affected rows

// Execute DELETE - returns affected row count
const deleteCount = await executeDelete(
  db,
  () => deleteFrom(dbContext, "users").where((u) => u.id === 123),
  {},
);
```

#### SQLite (better-sqlite3)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-better-sqlite3";

// Execute INSERT - returns row count
const insertCount = executeInsert(
  db,
  () => insertInto(dbContext, "users").values({ name: "Grace", age: 30 }),
  {},
);
// Returns number of inserted rows

// Execute with RETURNING (SQLite 3.35.0+)
const insertedUsers = executeInsert(
  db,
  () =>
    insertInto(dbContext, "users")
      .values({ name: "Henry", age: 32 })
      .returning((u) => u),
  {},
);
// Returns array of inserted rows

// Execute UPDATE - returns row count
const updateCount = executeUpdate(
  db,
  () =>
    updateTable(dbContext, "users")
      .set({ age: 33 })
      .where((u) => u.name === "Henry"),
  {},
);

// Execute DELETE - returns row count
const deleteCount = executeDelete(
  db,
  () => deleteFrom(dbContext, "users").where((u) => u.age > 100),
  {},
);
```

#### Transaction Support

Both adapters support transactions through their respective database drivers:

```typescript
// PostgreSQL transactions
await db.tx(async (t) => {
  const users = await executeInsert(
    t,
    () =>
      insertInto(dbContext, "users")
        .values({ name: "Ivy" })
        .returning((u) => u.id),
    {},
  );

  await executeInsert(
    t,
    () =>
      insertInto(dbContext, "user_logs").values({
        userId: users[0]!.id,
        action: "created",
      }),
    {},
  );
});

// SQLite transactions
const transaction = sqliteDb.transaction(() => {
  executeInsert(db, () => insertInto(dbContext, "users").values({ name: "Jack" }), {});
  executeUpdate(
    db,
    () =>
      updateTable(dbContext, "users")
        .set({ lastLogin: new Date() })
        .where((u) => u.name === "Jack"),
    {},
  );
});
transaction();
```

---

[← Back to README](../README.md)
