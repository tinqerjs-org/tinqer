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
  - [6.4 Left Outer Join](#64-left-outer-join)
  - [6.5 Cross Join](#65-cross-join)
- [7. Grouping and Aggregation](#7-grouping-and-aggregation)
  - [7.1 Basic Grouping](#71-basic-grouping)
  - [7.2 Group with Multiple Aggregates](#72-group-with-multiple-aggregates)
  - [7.3 Group with Post-Filter](#73-group-with-post-filter)
- [8. Window Functions](#8-window-functions)
  - [8.1 ROW_NUMBER](#81-row_number)
  - [8.2 RANK](#82-rank)
  - [8.3 DENSE_RANK](#83-dense_rank)
  - [8.4 Multiple Window Functions](#84-multiple-window-functions)
  - [8.5 Filtering on Window Function Results](#85-filtering-on-window-function-results)
- [9. Scalar Aggregates on Root Queries](#9-scalar-aggregates-on-root-queries)
- [10. Quantifiers](#10-quantifiers)
  - [10.1 Any Operation](#101-any-operation)
  - [10.2 All Operation](#102-all-operation)
- [11. Element Retrieval](#11-element-retrieval)
- [12. Materialisation](#12-materialisation)
- [13. Parameters and Auto-Parameterisation](#13-parameters-and-auto-parameterisation)
  - [13.1 External Parameter Objects](#131-external-parameter-objects)
  - [13.2 Literal Auto-Parameterisation](#132-literal-auto-parameterisation)
  - [13.3 Array Membership](#133-array-membership)
  - [13.4 Case-Insensitive Helper Functions](#134-case-insensitive-helper-functions)
- [14. CRUD Operations](#14-crud-operations)
  - [14.1 INSERT Statements](#141-insert-statements)
  - [14.2 UPDATE Statements](#142-update-statements)
  - [14.3 DELETE Statements](#143-delete-statements)
  - [14.4 Safety Features](#144-safety-features)
  - [14.5 Executing CRUD Operations](#145-executing-crud-operations)

---

## 1. Filtering Operations

The `where` method applies predicates to filter query results. Multiple `where` calls are combined with AND logic.

### 1.1 Basic Comparison

```typescript
import { createSchema } from "@webpods/tinqer";

interface Schema {
  users: { id: number; name: string; age: number; email: string; active: boolean };
}

const schema = createSchema<Schema>();

const adults = selectStatement(schema, (q) => q.from("users").where((u) => u.age >= 18), {});
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
  schema,
  (q) =>
    q
      .from("users")
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
  schema,
  (q) =>
    q.from("users").where((u) => (u.salary * 0.9 > 150_000 && u.age < 55) || u.active === false),
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
  schema,
  (q) => q.from("users").where((u) => (u.nickname ?? u.name) === "anonymous"),
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
  schema,
  (q) =>
    q
      .from("users")
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
const insensitive = selectStatement(
  schema,
  (q, params, helpers) => q.from("users").where((u) => helpers.functions.iequals(u.name, "ALICE")),
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
  schema,
  (q) => q.from("users").where((u) => ["admin", "support", "auditor"].includes(u.role)),
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
const advancedFilter = selectStatement(
  schema,
  (q, params, helpers) =>
    q
      .from("users")
      .where((u) => u.age >= params.minAge)
      .where((u) => params.categories.includes(u.departmentId.toString()))
      .where((u) => helpers.functions.icontains(u.email, "company")),
  { minAge: 25, categories: ["10", "11"] },
);
```

```sql
-- PostgreSQL
SELECT * FROM "users"
WHERE "age" >= $(minAge)
  AND "departmentId" IN ($(categories_0), $(categories_1))
  AND LOWER("email") LIKE '%' || LOWER($(__p1)) || '%'
```

```sql
-- SQLite
SELECT * FROM "users"
WHERE "age" >= @minAge
  AND "departmentId" IN (@categories_0, @categories_1)
  AND LOWER("email") LIKE '%' || LOWER(@__p1) || '%'
```

```json
{
  "minAge": 25,
  "categories": ["10", "11"],
  "categories_0": "10",
  "categories_1": "11",
  "__p1": "company"
}
```

---

## 2. Projections

The `select` method transforms query results by projecting columns or computed expressions.

### 2.1 Full Row Projection

```typescript
const fullRow = selectStatement(schema, (q) => q.from("users"), {});
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
  schema,
  (q) =>
    q
      .from("users")
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
interface ProductSchema {
  products: { id: number; name: string; price: number; discount: number | null };
}
const schema = createSchema<ProductSchema>();

const pricing = selectStatement(
  schema,
  (q) =>
    q.from("products").select((p) => ({
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
const alphabetical = selectStatement(schema, (q) => q.from("users").orderBy((u) => u.name), {});
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
  schema,
  (q) =>
    q
      .from("users")
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
  schema,
  (q) =>
    q
      .from("users")
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
  schema,
  (q) =>
    q
      .from("users")
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
  schema,
  (q) =>
    q
      .from("users")
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

The `join` method creates INNER JOIN operations. Left outer joins and cross joins follow the same LINQ patterns used in .NET: `groupJoin` + `selectMany(...defaultIfEmpty())` for left joins, and `selectMany` with a query-returning collection selector for cross joins.

### 6.1 Simple Inner Join

```typescript
interface JoinSchema {
  users: { id: number; name: string; departmentId: number };
  departments: { id: number; name: string };
}
const schema = createSchema<JoinSchema>();

const userDepartments = selectStatement(
  schema,
  (q) =>
    q.from("users").join(
      q.from("departments"),
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
interface OrderSchema {
  users: { id: number; name: string };
  orders: { id: number; userId: number; total: number };
}
const schema = createSchema<OrderSchema>();

const regionOrders = selectStatement(
  schema,
  (q) =>
    q
      .from("users")
      .where((u) => u.id > 100)
      .join(
        q.from("orders"),
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
  schema,
  (q) =>
    q
      .from("users")
      .join(
        q.from("orders"),
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

### 6.4 Left Outer Join

Model the classic LINQ pattern: start with `groupJoin`, then expand the grouped results with `selectMany(...defaultIfEmpty())`. Any missing matches appear as `null` in the projection.

```typescript
const usersWithDepartments = selectStatement(
  schema,
  (q) =>
    q
      .from("users")
      .groupJoin(
        q.from("departments"),
        (user) => user.departmentId,
        (department) => department.id,
        (user, deptGroup) => ({ user, deptGroup }),
      )
      .selectMany(
        (g) => g.deptGroup.defaultIfEmpty(),
        (g, department) => ({ user: g.user, department }),
      )
      .select((row) => ({
        userId: row.user.id,
        departmentName: row.department ? row.department.name : null,
      })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "t0"."id" AS "userId", CASE WHEN "t1"."id" IS NOT NULL THEN "t1"."name" ELSE NULL END AS "departmentName"
FROM "users" AS "t0"
LEFT OUTER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"
```

```sql
-- SQLite
SELECT "t0"."id" AS "userId", CASE WHEN "t1"."id" IS NOT NULL THEN "t1"."name" ELSE NULL END AS "departmentName"
FROM "users" AS "t0"
LEFT OUTER JOIN "departments" AS "t1" ON "t0"."departmentId" = "t1"."id"
```

### 6.5 Cross Join

Return a `Queryable` from the collection selector passed to `selectMany`. Because we skip `defaultIfEmpty`, the parser normalizes the operation into a `CROSS JOIN`.

```typescript
const departmentUsers = selectStatement(
  schema,
  (q) =>
    q
      .from("departments")
      .selectMany(
        () => q.from("users"),
        (department, user) => ({ department, user }),
      )
      .select((row) => ({
        departmentId: row.department.id,
        userId: row.user.id,
      })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "t0"."id" AS "departmentId", "t1"."id" AS "userId"
FROM "departments" AS "t0"
CROSS JOIN "users" AS "t1"
```

```sql
-- SQLite
SELECT "t0"."id" AS "departmentId", "t1"."id" AS "userId"
FROM "departments" AS "t0"
CROSS JOIN "users" AS "t1"
```

Right and full outer joins still require manual SQL, mirroring the .NET APIs.

---

## 7. Grouping and Aggregation

The `groupBy` method groups results and enables aggregate functions: `count`, `sum`, `avg`, `min`, `max`.

### 7.1 Basic Grouping

```typescript
const byDepartment = selectStatement(
  schema,
  (q) => q.from("users").groupBy((u) => u.departmentId),
  {},
);
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
  schema,
  (q) =>
    q
      .from("users")
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
  schema,
  (q) =>
    q
      .from("users")
      .groupBy((u) => u.departmentId)
      .select((g) => ({ departmentId: g.key, headcount: g.count() }))
      .where((row) => row.headcount > 5),
  {},
);
```

The adapter emits the `WHERE` on the grouped projection; explicit HAVING clauses are not generated.

---

## 8. Window Functions

Window functions perform calculations across rows related to the current row without collapsing the result set. Tinqer supports `ROW_NUMBER()`, `RANK()`, and `DENSE_RANK()` for ranking operations with optional partitioning and required ordering.

All window functions are accessed via the helpers parameter (second parameter in query builders) and support:

- **`partitionBy(...selectors)`**: Optional partitioning (0 or more selectors)
- **`orderBy(selector)`** / **`orderByDescending(selector)`**: Required ordering (at least one)
- **`thenBy(selector)`** / **`thenByDescending(selector)`**: Additional ordering

### 8.1 ROW_NUMBER

`ROW_NUMBER()` assigns sequential numbers to rows within a partition, starting from 1. The numbering resets for each partition.

```typescript
interface EmployeeSchema {
  employees: { id: number; name: string; department: string; salary: number };
}
const schema = createSchema<EmployeeSchema>();

const rankedEmployees = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      department: e.department,
      salary: e.salary,
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .rowNumber(),
    })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "name", "department", "salary",
  ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

```sql
-- SQLite
SELECT "name", "department", "salary",
  ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

#### Without Partition

```typescript
interface OrderTimeSchema {
  orders: { id: number; createdAt: Date };
}
const schema = createSchema<OrderTimeSchema>();

const chronological = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("orders").select((o) => ({
      orderId: o.id,
      rowNum: helpers
        .window(o)
        .orderBy((r) => r.createdAt)
        .rowNumber(),
    })),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT "id" AS "orderId", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) AS "rowNum"
FROM "orders"
```

#### Multiple Partitions

```typescript
interface RegionEmployeeSchema {
  employees: { name: string; region: string; department: string; salary: number };
}
const schema = createSchema<RegionEmployeeSchema>();

const multiPartition = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      rank: helpers
        .window(e)
        .partitionBy(
          (r) => r.region,
          (r) => r.department,
        )
        .orderByDescending((r) => r.salary)
        .rowNumber(),
    })),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT "name",
  ROW_NUMBER() OVER (PARTITION BY "region", "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

#### Secondary Ordering with thenBy

```typescript
const ranked = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .thenBy((r) => r.name)
        .rowNumber(),
    })),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT "name",
  ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC, "name" ASC) AS "rank"
FROM "employees"
```

### 8.2 RANK

`RANK()` assigns ranks with gaps for tied values. If two rows have the same rank, the next rank skips numbers.

```typescript
const rankedSalaries = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      salary: e.salary,
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .rank(),
    })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "name", "salary",
  RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

```sql
-- SQLite
SELECT "name", "salary",
  RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

Example result with gaps:

| name  | salary | rank |
| ----- | ------ | ---- |
| Alice | 90000  | 1    |
| Bob   | 90000  | 1    |
| Carol | 85000  | 3    |

Notice rank 2 is skipped because two employees share rank 1.

#### RANK Without Partition

```typescript
interface PlayerSchema {
  players: { name: string; score: number };
}
const schema = createSchema<PlayerSchema>();

const globalRank = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("players").select((p) => ({
      player: p.name,
      score: p.score,
      rank: helpers
        .window(p)
        .orderByDescending((r) => r.score)
        .rank(),
    })),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT "name" AS "player", "score", RANK() OVER (ORDER BY "score" DESC) AS "rank"
FROM "players"
```

### 8.3 DENSE_RANK

`DENSE_RANK()` assigns ranks without gaps. Tied values receive the same rank, and the next rank is consecutive.

```typescript
const denseRanked = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      salary: e.salary,
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .denseRank(),
    })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "name", "salary",
  DENSE_RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

```sql
-- SQLite
SELECT "name", "salary",
  DENSE_RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
FROM "employees"
```

Example result without gaps:

| name  | salary | rank |
| ----- | ------ | ---- |
| Alice | 90000  | 1    |
| Bob   | 90000  | 1    |
| Carol | 85000  | 2    |

#### Complex thenBy Chain

```typescript
interface EmployeeAgeSchema {
  employees: { name: string; department: string; salary: number; age: number };
}
const schema = createSchema<EmployeeAgeSchema>();

const complexRanking = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .thenByDescending((r) => r.age)
        .thenBy((r) => r.name)
        .denseRank(),
    })),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT "name",
  DENSE_RANK() OVER (
    PARTITION BY "department"
    ORDER BY "salary" DESC, "age" DESC, "name" ASC
  ) AS "rank"
FROM "employees"
```

### 8.4 Multiple Window Functions

Combine multiple window functions in a single SELECT:

```typescript
const allRankings = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("employees").select((e) => ({
      name: e.name,
      department: e.department,
      salary: e.salary,
      rowNum: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .rowNumber(),
      rank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .rank(),
      denseRank: helpers
        .window(e)
        .partitionBy((r) => r.department)
        .orderByDescending((r) => r.salary)
        .denseRank(),
    })),
  {},
);
```

```sql
-- PostgreSQL
SELECT "name", "department", "salary",
  ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rowNum",
  RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank",
  DENSE_RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "denseRank"
FROM "employees"
```

```sql
-- SQLite
SELECT "name", "department", "salary",
  ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rowNum",
  RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank",
  DENSE_RANK() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "denseRank"
FROM "employees"
```

### 8.5 Filtering on Window Function Results

Window function results can be filtered using `where()` clauses. Tinqer automatically wraps queries in subqueries when window function columns are referenced in WHERE conditions, since SQL does not allow filtering on window functions in the same query level where they're defined.

#### Top-N Per Group

Get the top earner from each department:

```typescript
const topEarners = await executeSelect(
  db,
  schema,
  (q, params, helpers) =>
    q
      .from("employees")
      .select((e) => ({
        ...e,
        rank: helpers
          .window(e)
          .partitionBy((r) => r.department)
          .orderByDescending((r) => r.salary)
          .rowNumber(),
      }))
      .where((r) => r.rank === 1)
      .orderBy((r) => r.department),
  {},
);
```

```sql
-- PostgreSQL (automatically wrapped in subquery)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
  FROM "employees"
) AS "employees"
WHERE "rank" = 1
ORDER BY "department" ASC
```

```sql
-- SQLite (automatically wrapped in subquery)
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "rank"
  FROM "employees"
) AS "employees"
WHERE "rank" = 1
ORDER BY "department" ASC
```

#### Top-3 Per Group

Get the top 3 highest-paid employees from a specific department:

```typescript
interface EmployeeDeptSchema {
  employees: { name: string; salary: number; department_id: number };
}
const schema = createSchema<EmployeeDeptSchema>();

const top3Engineering = await executeSelect(
  db,
  schema,
  (q, params, helpers) =>
    q
      .from("employees")
      .select((e) => ({
        name: e.name,
        salary: e.salary,
        rank: helpers
          .window(e)
          .partitionBy((r) => r.department_id)
          .orderByDescending((r) => r.salary)
          .rowNumber(),
      }))
      .where((r) => r.rank <= 3 && r.department_id === params.deptId)
      .orderBy((r) => r.rank),
  { deptId: 1 },
);
```

```sql
-- PostgreSQL and SQLite
SELECT * FROM (
  SELECT "name", "salary", "department_id",
    ROW_NUMBER() OVER (PARTITION BY "department_id" ORDER BY "salary" DESC) AS "rank"
  FROM "employees"
) AS "employees"
WHERE "rank" <= 3 AND "department_id" = $(deptId)
ORDER BY "rank" ASC
```

#### Filtering with Spread Operator

The spread operator (`...e`) includes all original columns along with window function results:

```typescript
interface PerformanceSchema {
  employees: { id: number; name: string; performance_score: number };
}
const schema = createSchema<PerformanceSchema>();

const topPerformers = await executeSelect(
  db,
  schema,
  (q, params, helpers) =>
    q
      .from("employees")
      .select((e) => ({
        ...e, // All original columns
        performance_rank: helpers
          .window(e)
          .orderByDescending((r) => r.performance_score)
          .rowNumber(),
      }))
      .where((r) => r.performance_rank <= 10),
  {},
);
```

```sql
-- PostgreSQL and SQLite
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY "performance_score" DESC) AS "performance_rank"
  FROM "employees"
) AS "employees"
WHERE "performance_rank" <= 10
```

#### Combined Filters

Combine window function filters with regular WHERE conditions:

```typescript
interface ActiveEmployeeSchema {
  employees: { name: string; department: string; salary: number; is_active: boolean };
}
const schema = createSchema<ActiveEmployeeSchema>();

const activeTopEarners = await executeSelect(
  db,
  schema,
  (q, params, helpers) =>
    q
      .from("employees")
      .select((e) => ({
        name: e.name,
        department: e.department,
        salary: e.salary,
        is_active: e.is_active,
        dept_rank: helpers
          .window(e)
          .partitionBy((r) => r.department)
          .orderByDescending((r) => r.salary)
          .rowNumber(),
      }))
      .where((r) => r.dept_rank <= 2 && r.is_active === true)
      .orderBy((r) => r.department)
      .thenBy((r) => r.dept_rank),
  {},
);
```

```sql
-- PostgreSQL and SQLite (note: is_active filter can be applied before or after window function)
SELECT * FROM (
  SELECT "name", "department", "salary", "is_active",
    ROW_NUMBER() OVER (PARTITION BY "department" ORDER BY "salary" DESC) AS "dept_rank"
  FROM "employees"
) AS "employees"
WHERE "dept_rank" <= 2 AND "is_active" = TRUE
ORDER BY "department" ASC, "dept_rank" ASC
```

**Note**: Tinqer automatically detects when WHERE clauses reference window function columns and wraps the query in a subquery. This transformation is transparent—you write natural TypeScript code, and Tinqer generates the correct SQL structure.

**Note**: SQLite window function support requires SQLite 3.25 or later.

---

## 9. Scalar Aggregates on Root Queries

Aggregate methods can be called directly on queries to return single values.

```typescript
const totals = selectStatement(
  schema,
  (q) =>
    q
      .from("users")
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
const activeCount = selectStatement(schema, (q) => q.from("users").count((u) => u.active), {});
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

## 10. Quantifiers

Methods `any` and `all` test whether elements satisfy conditions.

### 10.1 Any Operation

```typescript
const hasAdults = selectStatement(schema, (q) => q.from("users").any((u) => u.age >= 18), {});
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

### 10.2 All Operation

The `all` method emits a `NOT EXISTS` check:

```typescript
const allActive = selectStatement(
  schema,
  (q) => q.from("users").all((u) => u.active === true),
  {},
);
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

## 11. Element Retrieval

Methods `first`, `firstOrDefault`, `single`, `singleOrDefault`, `last`, and `lastOrDefault` retrieve single elements.

```typescript
const newestUser = selectStatement(
  schema,
  (q) =>
    q
      .from("users")
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

## 12. Materialisation

Queries are executed directly without requiring a materialization method. The query builder returns results as arrays by default.

```typescript
const activeUsers = await executeSelect(
  db,
  schema,
  (q) =>
    q
      .from("users")
      .where((u) => u.active)
      .orderBy((u) => u.name),
  {},
);
```

The generated SQL matches the entire query chain.

---

## 13. Parameters and Auto-Parameterisation

Tinqer automatically parameterizes all values to prevent SQL injection and enable prepared statements.

### 13.1 External Parameter Objects

```typescript
const filtered = selectStatement(
  schema,
  (q, params) =>
    q
      .from("users")
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

### 13.2 Literal Auto-Parameterisation

```typescript
const autoParams = selectStatement(
  schema,
  (q) => q.from("users").where((u) => u.departmentId === 7 && u.name.startsWith("A")),
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

### 13.3 Array Membership

```typescript
const membership = selectStatement(
  schema,
  (q) => q.from("users").where((u) => [1, 2, 3].includes(u.id)),
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
  schema,
  (q, params) => q.from("users").where((u) => params.allowed.includes(u.id)),
  { allowed: [5, 8] },
);
```

```json
{ "allowed[0]": 5, "allowed[1]": 8 }
```

### 13.4 Case-Insensitive Helper Functions

```typescript
const ic = selectStatement(
  schema,
  (q, params, helpers) =>
    q.from("users").where((u) => helpers.functions.icontains(u.email, "support")),
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

## 14. CRUD Operations

Tinqer provides full CRUD support with the same type-safety and lambda expression support as SELECT queries. All CRUD operations follow the same pattern: builder functions return operation chains, statement functions generate SQL, and execute functions run the queries.

### 14.1 INSERT Statements

The `insertInto` function creates INSERT operations. Values are specified using direct object syntax (no lambda wrapping required).

#### Basic INSERT

```typescript
import { createSchema, insertInto } from "@webpods/tinqer";
import { insertStatement } from "@webpods/tinqer-sql-pg-promise";

interface Schema {
  users: { id: number; name: string; age: number; email: string };
}
const schema = createSchema<Schema>();

// Insert with literal values - direct object syntax
const insert = insertStatement(
  schema,
  (q) =>
    q.insertInto("users").values({
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
  schema,
  (q, params) =>
    q.insertInto("users").values({
      name: params.name,
      age: params.age,
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

> **Tip:** When a property in `.values()` evaluates to `undefined`, the column is omitted from the INSERT. Explicit `null` values still emit `NULL`. The insert throws if every value is `undefined`.

#### INSERT with RETURNING Clause

Both PostgreSQL and SQLite (3.35.0+) support the RETURNING clause to retrieve values from inserted rows:

```typescript
// Return specific columns
const insertWithReturn = insertStatement(
  schema,
  (q) =>
    q
      .insertInto("users")
      .values({ name: "Charlie", age: 35 })
      .returning((u) => ({ id: u.id, createdAt: u.createdAt })),
  {},
);

// Return all columns
const insertReturnAll = insertStatement(
  schema,
  (q) =>
    q
      .insertInto("users")
      .values({ name: "David", age: 40 })
      .returning((u) => u), // Returns *
  {},
);
```

#### NULL Values in INSERT

```typescript
const insert = insertStatement(
  schema,
  (q) =>
    q.insertInto("users").values({
      name: "Eve",
      email: null, // Generates NULL, not parameterized
      phone: undefined, // Column omitted from INSERT
    }),
  {},
);
```

### 14.2 UPDATE Statements

The `update` function creates UPDATE operations. The `.set()` method uses direct object syntax (no lambda wrapping required).

#### Basic UPDATE

```typescript
import { createSchema, update } from "@webpods/tinqer";
import { updateStatement } from "@webpods/tinqer-sql-pg-promise";

const schema = createSchema<Schema>();

const updateStmt = updateStatement(
  schema,
  (q) =>
    q
      .update("users")
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

> **Tip:** If any property in the `.set()` object evaluates to `undefined` (for example because a parameter was omitted), Tinqer simply skips that column. Explicit `null` values still generate `SET column = NULL`. The query builder throws if every assignment resolves to `undefined`.

#### UPDATE with External Parameters

External variables must be passed via the params object:

```typescript
const updateStmt = updateStatement(
  schema,
  (q, params) =>
    q
      .update("users")
      .set({ age: params.newAge })
      .where((u) => u.id === 1),
  { newAge: 32 },
);
```

#### UPDATE with Complex WHERE

```typescript
const updateStmt = updateStatement(
  schema,
  (q) =>
    q
      .update("users")
      .set({ status: "inactive" })
      .where((u) => u.lastLogin < new Date("2023-01-01") && u.role !== "admin"),
  {},
);
```

#### UPDATE with RETURNING Clause

```typescript
const updateWithReturn = updateStatement(
  schema,
  (q) =>
    q
      .update("users")
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
  schema,
  (q) => q.update("users").set({ isActive: true }).allowFullTableUpdate(), // Required flag
  {},
);
```

Without the flag, attempting an UPDATE without WHERE throws an error:

```
Error: UPDATE requires a WHERE clause or explicit allowFullTableUpdate().
Full table updates are dangerous and must be explicitly allowed.
```

### 14.3 DELETE Statements

The `deleteFrom` function creates DELETE operations with optional WHERE conditions.

#### Basic DELETE

```typescript
import { createSchema, deleteFrom } from "@webpods/tinqer";
import { deleteStatement } from "@webpods/tinqer-sql-pg-promise";

const schema = createSchema<Schema>();

const del = deleteStatement(schema, (q) => q.deleteFrom("users").where((u) => u.age > 100), {});
```

Generated SQL:

```sql
DELETE FROM "users" WHERE "age" > $(__p1)  -- PostgreSQL
DELETE FROM "users" WHERE "age" > @__p1    -- SQLite
```

#### DELETE with Complex Conditions

```typescript
const del = deleteStatement(
  schema,
  (q) =>
    q
      .deleteFrom("users")
      .where((u) => u.isDeleted === true || (u.age < 18 && u.role !== "admin") || u.email === null),
  {},
);
```

#### DELETE with IN Clause

```typescript
const del = deleteStatement(
  schema,
  (q, params) => q.deleteFrom("users").where((u) => params.userIds.includes(u.id)),
  { userIds: [1, 2, 3, 4, 5] },
);
```

Generated SQL:

```sql
-- PostgreSQL
DELETE FROM "users"
WHERE "id" IN ($(userIds_0), $(userIds_1), $(userIds_2), $(userIds_3), $(userIds_4))

-- SQLite
DELETE FROM "users"
WHERE "id" IN (@userIds_0, @userIds_1, @userIds_2, @userIds_3, @userIds_4)
```

```json
{
  "userIds": [1, 2, 3, 4, 5],
  "userIds_0": 1,
  "userIds_1": 2,
  "userIds_2": 3,
  "userIds_3": 4,
  "userIds_4": 5
}
```

#### Full Table DELETE (Requires Explicit Permission)

```typescript
// DELETE without WHERE requires explicit permission
const deleteAll = deleteStatement(
  schema,
  (q) => q.deleteFrom("users").allowFullTableDelete(), // Required flag
  {},
);
```

### 14.4 Safety Features

Tinqer includes multiple safety guards for CRUD operations:

#### Mandatory WHERE Clauses

UPDATE and DELETE operations require WHERE clauses by default to prevent accidental full-table operations:

```typescript
// This throws an error
deleteStatement(schema, (q) => q.deleteFrom("users"), {});
// Error: DELETE requires a WHERE clause or explicit allowFullTableDelete()

// This works
deleteStatement(schema, (q) => q.deleteFrom("users").allowFullTableDelete(), {});
```

#### Type Safety

All CRUD operations maintain full TypeScript type safety:

```typescript
interface UserSchema {
  users: { id: number; name: string; email: string | null; age: number };
}
const schema = createSchema<UserSchema>();

// Type error: 'username' doesn't exist on users table
insertStatement(
  schema,
  (q) =>
    q.insertInto("users").values({
      username: "Alice", // ❌ Type error
    }),
  {},
);

// Type error: age must be number
updateStatement(
  schema,
  (q) =>
    q.update("users").set({
      age: "30", // ❌ Type error - must be number
    }),
  {},
);
```

#### Parameter Sanitization

All values are automatically parameterized to prevent SQL injection:

```typescript
const maliciousName = "'; DROP TABLE users; --";
const insert = insertStatement(
  schema,
  (q) =>
    q.insertInto("users").values({
      name: maliciousName, // Safely parameterized
    }),
  {},
);
// Generates: INSERT INTO "users" ("name") VALUES ($(__p1))
// Parameters: { __p1: "'; DROP TABLE users; --" }
```

### 14.5 Executing CRUD Operations

The adapter packages provide execution functions for all CRUD operations:

#### PostgreSQL (pg-promise)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-pg-promise";

// Execute INSERT with RETURNING
const insertedUsers = await executeInsert(
  db,
  schema,
  (q) =>
    q
      .insertInto("users")
      .values({ name: "Frank", age: 28 })
      .returning((u) => ({ id: u.id, name: u.name })),
  {},
);
// Returns: [{ id: 123, name: "Frank" }]

// Execute UPDATE - returns affected row count
const updateCount = await executeUpdate(
  db,
  schema,
  (q) =>
    q
      .update("users")
      .set({ age: 29 })
      .where((u) => u.id === 123),
  {},
);
// Returns number of affected rows

// Execute DELETE - returns affected row count
const deleteCount = await executeDelete(
  db,
  schema,
  (q) => q.deleteFrom("users").where((u) => u.id === 123),
  {},
);
```

#### SQLite (better-sqlite3)

```typescript
import { executeInsert, executeUpdate, executeDelete } from "@webpods/tinqer-sql-better-sqlite3";

// Execute INSERT - returns row count
const insertCount = executeInsert(
  db,
  schema,
  (q) => q.insertInto("users").values({ name: "Grace", age: 30 }),
  {},
);
// Returns number of inserted rows

// Execute UPDATE - returns row count
const updateCount = executeUpdate(
  db,
  schema,
  (q) =>
    q
      .update("users")
      .set({ age: 33 })
      .where((u) => u.name === "Henry"),
  {},
);

// Execute DELETE - returns row count
const deleteCount = executeDelete(
  db,
  schema,
  (q) => q.deleteFrom("users").where((u) => u.age > 100),
  {},
);
```

SQLite helpers always return the number of affected rows. To inspect row data after an insert or update, run a follow-up `selectStatement` query.

#### Transaction Support

Both adapters support transactions through their respective database drivers:

```typescript
interface TxSchema {
  users: { id: number; name: string; lastLogin: Date };
  user_logs: { userId: number; action: string };
}
const schema = createSchema<TxSchema>();

// PostgreSQL transactions
await db.tx(async (t) => {
  const users = await executeInsert(
    t,
    schema,
    (q) =>
      q
        .insertInto("users")
        .values({ name: "Ivy" })
        .returning((u) => u.id),
    {},
  );

  await executeInsert(
    t,
    schema,
    (q) =>
      q.insertInto("user_logs").values({
        userId: users[0]!.id,
        action: "created",
      }),
    {},
  );
});

// SQLite transactions
const transaction = sqliteDb.transaction(() => {
  executeInsert(db, schema, (q) => q.insertInto("users").values({ name: "Jack" }), {});
  executeUpdate(
    db,
    schema,
    (q) =>
      q
        .update("users")
        .set({ lastLogin: new Date() })
        .where((u) => u.name === "Jack"),
    {},
  );
});
transaction();
```

---

[← Back to README](../README.md)
