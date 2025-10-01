# Tinqer

LINQ-to-SQL query builder for TypeScript. Parses lambda expressions at runtime to generate SQL.

## Installation

Tinqer ships as adapter packages. Install the adapters that match your driver:

```bash
# PostgreSQL with pg-promise
npm install @webpods/tinqer-sql-pg-promise

# SQLite with better-sqlite3
npm install @webpods/tinqer-sql-better-sqlite3
```

Do not install `@webpods/tinqer` directly. Use a database adapter.

### Supported adapters

- `@webpods/tinqer-sql-pg-promise` – PostgreSQL via pg-promise
- `@webpods/tinqer-sql-better-sqlite3` – SQLite via better-sqlite3

## Basic Usage

### Setup

```typescript
import { from, query, execute } from "@webpods/tinqer-sql-pg-promise";
import pgPromise from "pg-promise";

// Database connection
const pgp = pgPromise();
const db = pgp("postgresql://user:pass@localhost:5432/mydb");

// Table type
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  active: boolean;
  salary: number;
  departmentId: number;
}
```

The SQLite adapter exposes the same `from`, `query`, and `execute` helpers:

```typescript
import Database from "better-sqlite3";
import { from, query, execute } from "@webpods/tinqer-sql-better-sqlite3";

const db = new Database("app.db");
```

### Simple Queries

```typescript
// All users
const allUsers = from<User>("users");

// Filtered users
const adults = from<User>("users").where((u) => u.age >= 18);

// Multiple conditions
const activeAdults = from<User>("users")
  .where((u) => u.age >= 18)
  .where((u) => u.active === true);
```

### Generating SQL

```typescript
const result = query(() => from<User>("users").where((u) => u.age >= 18), {});

console.log(result.sql); // SELECT * FROM "users" AS t0 WHERE age >= $(__p1)
console.log(result.params); // { __p1: 18 }
```

### Executing Queries

```typescript
// Returns User[]
const users = await execute(db, () => from<User>("users").where((u) => u.age >= 18), {});

// Returns single User
const firstUser = await execute(db, () => from<User>("users").first(), {});

// Returns number
const count = await execute(db, () => from<User>("users").count(), {});
```

## Type-Safe Database Context

For better type safety and reusability:

```typescript
import { createContext, from } from "@webpods/tinqer";

// Define schema
interface Schema {
  users: User;
  departments: Department;
  orders: Order;
}

// Create context
const db = createContext<Schema>();

// Use with from
const users = from(db, "users"); // Type-safe table name
```

## Chainable Operations

### WHERE - Filtering

```typescript
// Single condition
from<User>("users").where((u) => u.age >= 18);

// Multiple WHERE clauses (combined with AND)
from<User>("users")
  .where((u) => u.age >= 18)
  .where((u) => u.age <= 65)
  .where((u) => u.active === true);

// Complex conditions
from<User>("users").where((u) => u.age >= 18 && u.active);
from<User>("users").where((u) => u.role === "admin" || u.role === "moderator");

// Negation
from<User>("users").where((u) => !u.deleted);
```

### SELECT - Projection

```typescript
// Single column
from<User>("users").select((u) => u.name);

// Object projection
from<User>("users").select((u) => ({
  userId: u.id,
  userName: u.name,
  userAge: u.age,
}));

// Nested objects
from<User>("users").select((u) => ({
  id: u.id,
  info: {
    name: u.name,
    email: u.email,
  },
}));

// After WHERE
from<User>("users")
  .where((u) => u.active)
  .select((u) => ({ id: u.id, name: u.name }));
```

### ORDER BY - Sorting

```typescript
// Single column ascending
from<User>("users").orderBy((u) => u.name);

// Single column descending
from<User>("users").orderByDescending((u) => u.createdAt);

// Multiple columns
from<User>("users")
  .orderBy((u) => u.department)
  .thenBy((u) => u.name);

// Mixed ordering
from<User>("users")
  .orderBy((u) => u.department)
  .thenByDescending((u) => u.salary)
  .thenBy((u) => u.name);
```

### DISTINCT - Unique Values

```typescript
// All distinct rows
from<User>("users").distinct();

// With WHERE
from<User>("users")
  .where((u) => u.active)
  .distinct();

// With SELECT
from<User>("users")
  .select((u) => u.department)
  .distinct();
```

### TAKE/SKIP - Pagination

```typescript
// First 10 rows
from<User>("users").take(10);

// Skip first 20 rows
from<User>("users").skip(20);

// Pagination
from<User>("users")
  .orderBy((u) => u.id)
  .skip(20)
  .take(10);

// With filtering
from<User>("users")
  .where((u) => u.active)
  .orderBy((u) => u.name)
  .skip(100)
  .take(25);
```

### JOIN - Combining Tables

```typescript
interface Department {
  id: number;
  name: string;
  budget: number;
}

// Inner join
from<User>("users").join(
  from<Department>("departments"),
  (u) => u.departmentId,
  (d) => d.id,
  (u, d) => ({
    userName: u.name,
    departmentName: d.name,
  }),
);

// With WHERE
from<User>("users")
  .where((u) => u.active)
  .join(
    from<Department>("departments"),
    (u) => u.departmentId,
    (d) => d.id,
    (u, d) => ({ user: u.name, dept: d.name }),
  )
  .where((r) => r.dept !== "IT");
```

### GROUP BY - Grouping

```typescript
// Simple grouping
from<User>("users").groupBy((u) => u.department);

// Group with aggregated filter (HAVING not generated yet)
from<Order>("orders")
  .groupBy((o) => o.customerId)
  .select((g) => ({
    customerId: g.key,
    totalSpent: g.sum((o) => o.total),
  }))
  .where((g) => g.totalSpent > 1000);

// Group with SELECT
from<User>("users")
  .groupBy((u) => u.department)
  .select((g) => ({
    department: g.key,
    count: g.count(),
  }));
```

## Terminal Operations

Terminal operations end the query chain and return a specific result type.

### Element Operations

```typescript
// first() - Returns first element or throws
const user = await execute(db, () => from<User>("users").first(), {});

// first() with predicate
const admin = await execute(db, () => from<User>("users").first((u) => u.role === "admin"), {});

// firstOrDefault() - Returns first element or undefined
const maybeUser = await execute(
  db,
  () => from<User>("users").firstOrDefault((u) => u.id === 999),
  {},
);

// single() - Returns single element or throws if none/multiple
const user = await execute(
  db,
  () => from<User>("users").single((u) => u.email === "john@example.com"),
  {},
);

// singleOrDefault() - Returns single element or undefined
const maybeUser = await execute(
  db,
  () => from<User>("users").singleOrDefault((u) => u.id === 1),
  {},
);

// last() - Returns last element or throws
const newest = await execute(
  db,
  () =>
    from<User>("users")
      .orderBy((u) => u.createdAt)
      .last(),
  {},
);

// lastOrDefault() - Returns last element or undefined
const maybeLast = await execute(
  db,
  () =>
    from<User>("users")
      .orderBy((u) => u.id)
      .lastOrDefault(),
  {},
);
```

### Aggregate Operations

```typescript
// count() - Count all rows
const total = await execute(db, () => from<User>("users").count(), {});

// count() with predicate
const activeCount = await execute(db, () => from<User>("users").count((u) => u.active), {});

// sum() - Sum numeric column
const totalSalary = await execute(db, () => from<User>("users").sum((u) => u.salary), {});

// average() - Average numeric column
const avgAge = await execute(db, () => from<User>("users").average((u) => u.age), {});

// min() - Minimum value
const minSalary = await execute(db, () => from<User>("users").min((u) => u.salary), {});

// max() - Maximum value
const maxAge = await execute(db, () => from<User>("users").max((u) => u.age), {});
```

### Boolean Operations

```typescript
// any() - Check if any rows exist
const hasUsers = await execute(db, () => from<User>("users").any(), {});

// any() with predicate
const hasAdults = await execute(db, () => from<User>("users").any((u) => u.age >= 18), {});

// all() - Check if all rows match predicate
const allActive = await execute(db, () => from<User>("users").all((u) => u.active), {});

// contains() - Check if value exists
const hasJohn = await execute(
  db,
  () =>
    from<User>("users")
      .select((u) => u.name)
      .contains("John"),
  {},
);
```

### Conversion Operations

```typescript
// toArray() - Execute query and return array
const users = await execute(
  db,
  () =>
    from<User>("users")
      .where((u) => u.active)
      .toArray(),
  {},
);
```

## Parameters

### External Parameters

```typescript
// Single parameter
const result = query(
  (p: { minAge: number }) => from<User>("users").where((u) => u.age >= p.minAge),
  { minAge: 21 },
);
// SQL: WHERE age >= $(minAge)

// Multiple parameters
const result = query(
  (p: { role: string; active: boolean }) =>
    from<User>("users")
      .where((u) => u.role === p.role)
      .where((u) => u.active === p.active),
  { role: "admin", active: true },
);
// SQL: WHERE role = $(role) AND active = $(active)

// With execute
const users = await execute(
  db,
  (p: { dept: string }) => from<User>("users").where((u) => u.department === p.dept),
  { dept: "Engineering" },
);
```

### Auto-Parameterization

Constants in queries are automatically parameterized:

```typescript
const result = query(() => from<User>("users").where((u) => u.age >= 18 && u.name === "John"), {});
// SQL: WHERE (age >= $(__p1) AND name = $(_name1))
// Params: { __p1: 18, _name1: "John" }
```

## Supported Operators

### Comparison Operators

```typescript
where((u) => u.age === 18); // Equality
where((u) => u.age !== 18); // Inequality
where((u) => u.age > 18); // Greater than
where((u) => u.age >= 18); // Greater than or equal
where((u) => u.age < 65); // Less than
where((u) => u.age <= 65); // Less than or equal
```

### Logical Operators

```typescript
where((u) => u.age >= 18 && u.active); // AND
where((u) => u.role === "admin" || u.super); // OR
where((u) => !u.deleted); // NOT
```

### NULL Handling

```typescript
where((u) => u.email === null); // IS NULL
where((u) => u.email !== null); // IS NOT NULL
```

### String Operations

```typescript
where((u) => u.name.toLowerCase() === "john");
where((u) => u.name.toUpperCase() === "JOHN");
where((u) => u.email.startsWith("admin"));
where((u) => u.email.endsWith("@company.com"));
where((u) => u.name.includes("john"));
where((u) => u.code.indexOf("X") === 0);
where((u) => u.name.trim() === "John");
where((u) => u.name.length > 10);
```

### Arithmetic Operations

```typescript
where((u) => u.age + 5 > 25);
where((u) => u.salary - 1000 >= 50000);
where((u) => u.quantity * u.price > 100);
where((u) => u.total / u.count < 10);
where((u) => u.value % 2 === 0);
```

### IN Operator

```typescript
// Array contains
const roles = ["admin", "moderator"];
where((u) => roles.includes(u.role));
// SQL: WHERE role IN ($(_role1), $(_role2))

// With parameters
const result = query(
  (p: { allowedRoles: string[] }) =>
    from<User>("users").where((u) => p.allowedRoles.includes(u.role)),
  { allowedRoles: ["admin", "user"] },
);
```

### Null Coalescing

```typescript
select((u) => u.nickname ?? u.name); // COALESCE(nickname, name)
where((u) => (u.manager ?? "none") === "none");
```

## Complex Examples

### Multi-table Query with Aggregation

```typescript
interface Order {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
  price: number;
  orderDate: Date;
}

interface Product {
  id: number;
  name: string;
  category: string;
}

const topProducts = await execute(
  db,
  () =>
    from<Order>("orders")
      .join(
        from<Product>("products"),
        (o) => o.productId,
        (p) => p.id,
        (o, p) => ({
          productName: p.name,
          category: p.category,
          revenue: o.quantity * o.price,
        }),
      )
      .where((r) => r.category === "Electronics")
      .groupBy((r) => r.productName)
      .select((g) => ({
        product: g.key,
        totalRevenue: g.sum((r) => r.revenue),
        orderCount: g.count(),
      }))
      .orderByDescending((r) => r.totalRevenue)
      .take(10),
  {},
);
```

### Subquery Pattern

```typescript
// High earners in each department
const highEarners = await execute(
  db,
  () =>
    from<User>("users")
      .where((u) => u.salary > 100000)
      .groupBy((u) => u.departmentId)
      .select((g) => ({
        department: g.key,
        count: g.count(),
        avgSalary: g.average((u) => u.salary),
      }))
      .where((d) => d.count > 5)
      .orderByDescending((d) => d.avgSalary),
  {},
);
```

### Conditional Aggregation

```typescript
const summary = await execute(
  db,
  () =>
    from<User>("users")
      .groupBy((u) => u.department)
      .select((g) => ({
        department: g.key,
        totalUsers: g.count(),
        activeUsers: g.count((u) => u.active),
        avgActiveSalary: g.where((u) => u.active).average((u) => u.salary),
        maxInactiveSalary: g.where((u) => !u.active).max((u) => u.salary),
      })),
  {},
);
```

## Type Safety

### Compile-Time Type Checking

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

const users = from<User>("users");

// Valid - all properties exist
users.where((u) => u.age >= 18);

// Compile error - property doesn't exist
users.where((u) => u.invalid); // Error: Property 'invalid' does not exist

// Type flows through transformations
const names: string[] = await execute(
  db,
  () => users.select((u) => u.name), // Returns string[]
  {},
);

const info: { id: number; name: string }[] = await execute(
  db,
  () => users.select((u) => ({ id: u.id, name: u.name })),
  {},
);
```

### Type Inference

```typescript
// execute() infers return types
const users = await execute(db, () => from<User>("users"), {});
// Type: User[]

const first = await execute(db, () => from<User>("users").first(), {});
// Type: User

const maybeFirst = await execute(db, () => from<User>("users").firstOrDefault(), {});
// Type: User | undefined

const count = await execute(db, () => from<User>("users").count(), {});
// Type: number

const hasUsers = await execute(db, () => from<User>("users").any(), {});
// Type: boolean
```

## SQL Generation Examples

### Basic Query

```typescript
from<User>("users")
  .where((u) => u.age >= 18)
  .select((u) => ({ id: u.id, name: u.name }))
  .orderBy((u) => u.name)
  .take(10);
```

Generates:

```sql
SELECT id AS id, name AS name
FROM "users" AS t0
WHERE age >= $(__p1)
ORDER BY name ASC
LIMIT $(__p1)
```

### Join Query

```typescript
from<User>("users")
  .join(
    from<Department>("departments"),
    (u) => u.departmentId,
    (d) => d.id,
    (u, d) => ({ userName: u.name, deptName: d.name }),
  )
  .where((r) => r.deptName !== "HR");
```

Generates:

```sql
SELECT * FROM "users" AS t0
INNER JOIN (SELECT * FROM "departments" AS t0) AS t1
ON t0.departmentId = t1.id
WHERE deptName != $(_deptName1)
```

### Aggregation Query

```typescript
from<Order>("orders")
  .where((o) => o.status === "completed")
  .groupBy((o) => o.customerId)
  .select((g) => ({
    customerId: g.key,
    totalSpent: g.sum((o) => o.amount),
    orderCount: g.count(),
  }))
  .orderByDescending((g) => g.totalSpent);
```

Generates:

```sql
SELECT "customerId" AS "customerId", SUM("amount") AS "totalSpent", COUNT(*) AS "orderCount"
FROM "orders" AS t0
WHERE "status" = $(_status1)
GROUP BY "customerId"
ORDER BY "totalSpent" DESC

```

Filter aggregated results (e.g., high spenders) in application code or by chaining `.where` after `.select`, because the SQL generator does not emit a `HAVING` clause yet.

## Limitations

### Lambda Restrictions

```typescript
// NOT SUPPORTED - External variables
const minAge = 18;
from<User>("users").where((u) => u.age >= minAge); // Error

// SUPPORTED - Parameters
from<User>("users").where((u, p: { minAge: number }) => u.age >= p.minAge);

// NOT SUPPORTED - Complex expressions
where((u) => Math.max(u.age, 18) > 20); // Error

// NOT SUPPORTED - Function calls
const isAdult = (age: number) => age >= 18;
where((u) => isAdult(u.age)); // Error
```

### SQL Feature Limitations

- No INSERT, UPDATE, DELETE operations
- No CTEs (Common Table Expressions)
- No HAVING clause generation (filter grouped results after aggregation)
- No window functions
- No stored procedures
- No transactions
- No UNION/INTERSECT/EXCEPT

### Runtime Parsing

Queries are parsed from function string representations at runtime:

- Functions must be inline
- No external dependencies
- Arrow functions only
- Single expression returns

## Architecture

### Processing Pipeline

1. **Lambda Expression**: TypeScript arrow function
2. **String Conversion**: Function.toString()
3. **AST Parsing**: OXC parser creates JavaScript AST
4. **Expression Tree**: AST converted to typed expressions
5. **Query Operations**: Chained operations build tree
6. **SQL Generation**: Tree traversed to generate SQL
7. **Parameterization**: Constants extracted as parameters
8. **Execution**: SQL sent to database with parameters

### Expression Tree Example

```typescript
from<User>("users")
  .where((u) => u.age >= 18)
  .select((u) => u.name);
```

Becomes:

```json
{
  "type": "queryOperation",
  "operationType": "select",
  "selector": {
    "type": "member",
    "property": "name",
    "object": { "type": "parameter", "name": "u" }
  },
  "source": {
    "type": "queryOperation",
    "operationType": "where",
    "predicate": {
      "type": "binary",
      "operator": ">=",
      "left": {
        "type": "member",
        "property": "age",
        "object": { "type": "parameter", "name": "u" }
      },
      "right": { "type": "constant", "value": 18 }
    },
    "source": {
      "type": "queryOperation",
      "operationType": "from",
      "table": "users"
    }
  }
}
```

## Troubleshooting

### Common Errors

#### "Failed to parse query"

Lambda function could not be parsed. Ensure:

- Using arrow functions
- No external variables
- Simple expressions only

#### "No elements found for first operation"

Query returned no results. Use `firstOrDefault()` to return undefined instead of throwing.

#### "Multiple elements found for single operation"

Query returned multiple results. Use `first()` if you only need one, or refine your WHERE clause.

#### Type Errors

Ensure table interfaces match database schema:

```typescript
interface User {
  id: number; // Must match database column type
  name: string;
  email: string | null; // Nullable columns need | null
}
```

### Performance Tips

1. **Use indexes**: Ensure WHERE columns have indexes
2. **Limit results**: Use `take()` to limit result sets
3. **Project early**: Use `select()` to reduce data transfer
4. **Parameterize queries**: Reuse query plans with parameters
5. **Batch operations**: Execute multiple queries in parallel

## Development

### Setup

```bash
git clone https://github.com/webpods-org/tinqer.git
cd tinqer
npm install
```

### Testing

```bash
npm test                         # Run all tests
npm run test:grep -- "pattern"   # Run specific tests
```

### Building

```bash
./scripts/build.sh               # Build all packages
./scripts/clean.sh               # Clean build artifacts
./scripts/lint-all.sh            # Run ESLint
./scripts/format-all.sh          # Format with Prettier
```

## License

MIT
