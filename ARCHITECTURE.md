# Tinqer - Architecture & Implementation Plan

## Core Concept

Tinqer is a LINQ-style query builder for TypeScript that:

1. Parses TypeScript lambda functions into expression trees (AST)
2. Outputs QueryExpression AST (NOT SQL)
3. Only supports SELECT queries (no INSERT/UPDATE/DELETE)
4. SQL generation is handled by separate adapter packages (tinqer-sql-pg-promise, etc.)
5. **Fully type-safe** - All queries, joins, and projections are type-checked at compile time

## Package Structure

```
@webpods/tinqer                 - Core library (users never import directly)
@webpods/tinqer-sql-pg-promise  - PostgreSQL adapter with pg-promise style parameters
@webpods/tinqer-sql-mysql       - MySQL adapter (future)
@webpods/tinqer-sql-sqlite      - SQLite adapter (future)
```

## User-Facing API

Users ONLY import the adapter package, never tinqer directly:

```typescript
import { query } from "@webpods/tinqer-sql-pg-promise";

// Simple query with WHERE and SELECT
const minAge = 18;
const sql = query(
  (params) =>
    users
      .where((u) => u.age >= params.minAge && u.isActive)
      .select((u) => ({ id: u.id, name: u.name }))
      .orderBy((u) => u.createdAt),
  { minAge },
);
// Returns: "SELECT t0.id AS id, t0.name AS name FROM users t0 WHERE (t0.age >= :minAge AND t0.isActive = TRUE) ORDER BY t0.createdAt ASC"

// JOIN query example
const joinSql = query(
  (params) =>
    users
      .join(
        departments,
        (u) => u.departmentId, // Join key from users
        (d) => d.id, // Join key from departments
        (u, d) => ({
          // Result selector - both u and d are fully typed
          userId: u.id,
          userName: u.name,
          departmentName: d.name,
          departmentBudget: d.budget,
        }),
      )
      .where((result) => result.departmentBudget > params.minBudget)
      .orderBy((result) => result.userName),
  { minBudget: 50000 },
);
// Returns: "SELECT t0.id AS userId, t0.name AS userName, t1.name AS departmentName, t1.budget AS departmentBudget
//           FROM users t0
//           INNER JOIN departments t1 ON (t0.departmentId = t1.id)
//           WHERE (departmentBudget > :minBudget)
//           ORDER BY userName ASC"

// Multiple JOINs
const multiJoinSql = query(
  (params) =>
    orders
      .join(
        products,
        (o) => o.productId,
        (p) => p.id,
        (o, p) => ({ o, p }),
      )
      .join(
        categories,
        (r) => r.p.categoryId,
        (c) => c.id,
        (r, c) => ({
          orderId: r.o.id,
          productName: r.p.name,
          categoryName: c.name,
          total: r.o.quantity * r.o.price,
        }),
      )
      .where((r) => r.total > params.minTotal),
  { minTotal: 100 },
);
```

## Type Safety

### Complete Type Safety Throughout

All operations are fully type-safe with TypeScript's type system:

```typescript
interface User {
  id: number;
  name: string;
  age: number;
  departmentId: number;
}

interface Department {
  id: number;
  name: string;
  budget: number;
}

// Type-safe query - TypeScript knows all types
const sql = query(
  (params) =>
    users
      .where((u) => u.age >= params.minAge) // u is typed as User
      .select((u) => ({
        userId: u.id, // TypeScript knows u.id is number
        userName: u.name, // TypeScript knows u.name is string
      })),
  { minAge: 18 },
);

// Type-safe JOIN - result type is inferred
const joinSql = query(
  (params) =>
    users
      .join(
        departments,
        (u) => u.departmentId, // TypeScript validates this is valid for User
        (d) => d.id, // TypeScript validates this is valid for Department
        (u, d) => ({
          // u: User, d: Department - both fully typed
          userName: u.name,
          deptName: d.name,
          budget: d.budget,
        }),
      )
      .where((result) => result.budget > params.minBudget), // result is typed from join projection
  { minBudget: 100000 },
);

// Compilation errors for invalid field access:
// .where(u => u.invalid)     // Error: Property 'invalid' does not exist on type 'User'
// .select(u => u.notThere)   // Error: Property 'notThere' does not exist on type 'User'
```

### Type Safety Features

1. **Table types** - Each table has a TypeScript interface defining its shape
2. **Lambda parameters** - Automatically typed based on table/join context
3. **Projections** - SELECT clause results are type-inferred
4. **JOIN results** - Combined types from joined tables
5. **WHERE conditions** - Type-checked boolean expressions
6. **External parameters** - Params object is fully typed
7. **Aggregate functions** - Return types properly inferred (COUNT returns number, etc.)

## Key Architecture Decisions

### 1. No Closure Variable Access

- Lambda functions CANNOT access variables from outer scope
- All external values MUST be passed through the params object
- Parser validates and rejects any external references not through params
- This is because lambdas are parsed as strings, not executed

### 2. Generic Expression Trees (Most Important Decision)

**Everything is an expression tree. Simple cases are special cases of complex structures.**

Examples:

- JOIN conditions are generic Expression trees, not just column pairs
- WHERE, HAVING, SELECT, GROUP BY - all stored as expression trees
- FROM can be table, subquery, or VALUES - all handled generically

```typescript
// Simple JOIN - still uses generic expression structure
join.on = {
  type: "binary",
  operator: "==",
  left: { type: "lambda", body: { type: "member", property: "deptId" } },
  right: { type: "lambda", body: { type: "member", property: "id" } },
};

// Complex JOIN - same structure handles it
join.on = {
  type: "logical",
  operator: "&&",
  left: {
    /* condition 1 */
  },
  right: {
    /* condition 2 */
  },
};
```

### 3. Parameter Origin Tracking

Every parameter in the expression tree tracks its origin:

- `"table"` - References a table/row (e.g., `u` in `u => u.age`)
- `"external"` - References the params object (e.g., `params.minAge`)
- `"joined"` - References a joined result
- `"cte"` - References a CTE
- `"subquery"` - References a subquery result

### 4. SELECT Only

- No INSERT, UPDATE, DELETE support
- Simplifies the architecture significantly
- Aligns with read-heavy use cases

### 5. Expression Tree Structure

```typescript
interface QueryExpression {
  type: "query";
  operation: "SELECT";  // Only SELECT supported
  from: SourceExpression;
  select?: Expression;
  where?: Expression;
  groupBy?: Expression;
  having?: Expression;
  orderBy?: OrderExpression[];
  joins?: JoinExpression[];
  limit?: Expression;
  offset?: Expression;
  distinct?: boolean;

  // Set operations
  union?: QueryExpression;
  intersect?: QueryExpression;
  except?: QueryExpression;

  // CTEs
  with?: CteExpression[];
}

interface JoinExpression {
  type: "join";
  kind: "INNER" | "LEFT" | "RIGHT" | "FULL" | "CROSS";
  table: string;
  on?: Expression;  // Generic expression - can represent ANY condition
}

// Example JOIN expressions:

// Simple column equality join
{
  type: "join",
  kind: "INNER",
  table: "departments",
  on: {
    type: "binary",
    operator: "==",
    left: {
      type: "lambda",
      parameters: [{ type: "parameter", name: "u", origin: { type: "table" }}],
      body: { type: "member", property: "departmentId" }
    },
    right: {
      type: "lambda",
      parameters: [{ type: "parameter", name: "d", origin: { type: "table" }}],
      body: { type: "member", property: "id" }
    }
  }
}

// Complex multi-condition join
{
  type: "join",
  kind: "LEFT",
  table: "orders",
  on: {
    type: "logical",
    operator: "&&",
    left: {
      type: "binary",
      operator: "==",
      left: { /* u.id expression */ },
      right: { /* o.userId expression */ }
    },
    right: {
      type: "binary",
      operator: ">",
      left: { /* o.amount expression */ },
      right: { type: "constant", value: 100 }
    }
  }
}
```

## Implementation Components

### 1. OXC Parser (v0.90.0)

- Parses lambda function strings to ESTree AST
- Usage: `parseSync('query.ts', lambdaString, {})`

### 2. ESTreeConverter

- Converts ESTree AST to Tinqer Expression trees
- Tracks parameter origins via ConversionContext
- Validates that lambdas only reference allowed parameters

### 3. Queryable Class

- Fluent API for building queries
- Methods: where(), select(), orderBy(), groupBy(), having(), join(), leftJoin(), etc.
- Aggregate methods: count(), sum(), avg(), min(), max()
- build() returns QueryExpression
- NO support for insert(), update(), delete()
- **Fully typed** - Queryable<T> maintains type information throughout the chain
- Type transformations preserved through joins and projections

### 4. SQL Generator (in adapter packages)

- Converts QueryExpression to SQL strings
- Handles database-specific syntax
- Maps external parameters to :paramName style for pg-promise
- Generates table aliases (t0, t1, t2, etc.)
- Handles string method transformations (toLowerCase → LOWER, etc.)

## Testing Strategy

### Tree Helper Utilities

Tests use helper functions that create the SAME expression tree structures the parser creates:

```typescript
// Import the test utilities
import { expr, tree } from "./utils/tree-helpers.js";

// Shortcuts expand to full expression trees
tree.eq("age", 18); // Returns: { type: "binary", operator: "==", left: {...}, right: {...} }

// Mix shortcuts with explicit construction
expect(query.where).to.deep.equal(
  tree.and(
    tree.eq("isActive", true), // Shortcut for simple equality
    expr.binary(
      // Full control for complex expression
      expr.call("toLowerCase", expr.member("name")),
      "==",
      expr.constant("john"),
    ),
  ),
);
```

### Tree Helper Expansion Example

```typescript
// This tree helper code:
tree.and(
  tree.eq("isActive", true),
  tree.eq("departmentCode", "ENG")
)

// Expands to this full expression tree:
{
  type: "logical",
  operator: "&&",
  left: {
    type: "binary",
    operator: "==",
    left: {
      type: "member",
      property: "isActive"
    },
    right: {
      type: "constant",
      value: true
    }
  },
  right: {
    type: "binary",
    operator: "==",
    left: {
      type: "member",
      property: "departmentCode"
    },
    right: {
      type: "constant",
      value: "ENG"
    }
  }
}
```

Key principle: **Test helpers create the exact same AST nodes that the parser produces**

### Test Example: Simple Query

```typescript
import { expect } from "chai";
import { Queryable } from "../src/index.js";
import { OxcParser } from "../src/parsers/oxc-parser.js";
import { expr, tree } from "./utils/tree-helpers.js";

describe("Simple WHERE Query", () => {
  it("should generate correct expression tree for age filter", () => {
    const parser = new OxcParser();
    const users = new Queryable<User>("users", parser);

    // Build the query
    const query = users
      .where("u => u.age >= 18")
      .select("u => ({ id: u.id, name: u.name })")
      .build();

    // Test the WHERE clause
    expect(query.where).to.deep.equal(
      tree.gte("age", 18), // Shortcut helper
    );

    // Test the SELECT projection
    expect(query.select).to.deep.equal(
      expr.lambda(
        expr.object([
          { key: "id", value: expr.member("id") },
          { key: "name", value: expr.member("name") },
        ]),
        ["u"],
      ),
    );

    // Test the FROM clause
    expect(query.from).to.deep.equal({
      type: "source",
      source: { type: "table", name: "users" },
    });
  });
});
```

### Test Example: Complex JOIN Query

```typescript
import { expect } from "chai";
import { Queryable } from "../src/index.js";
import { OxcParser } from "../src/parsers/oxc-parser.js";
import { expr, tree, ANY } from "./utils/tree-helpers.js";

describe("Complex JOIN Query", () => {
  it("should generate correct expression tree for user-department join", () => {
    const parser = new OxcParser();
    const users = new Queryable<User>("users", parser);
    const departments = new Queryable<Department>("departments", parser);

    // Build the query
    const query = users
      .where((u) => u.isActive === true)
      .join(
        departments,
        (u) => u.departmentId,
        (d) => d.id,
        (u, d) => ({
          userId: u.id,
          userName: u.name,
          departmentName: d.name,
          departmentCode: d.code,
        }),
      )
      .where((result) => result.departmentCode === "ENG")
      .orderBy((result) => result.userName)
      .build();

    // Test the WHERE clause (combined conditions)
    expect(query.where).to.deep.equal(
      tree.and(tree.eq("isActive", true), tree.eq("departmentCode", "ENG")),
    );

    // Test the JOIN structure
    expect(query.joins).to.have.lengthOf(1);
    expect(query.joins![0]).to.deep.equal({
      type: "join",
      kind: "INNER",
      table: "departments",
      on: expr.binary(
        expr.lambda(expr.member("departmentId"), ["u"]),
        "==",
        expr.lambda(expr.member("id"), ["d"]),
      ),
    });

    // Test the SELECT projection
    expect(query.select).to.deep.equal(
      expr.lambda(
        expr.object([
          { key: "userId", value: expr.member("id", expr.parameter("u")) },
          { key: "userName", value: expr.member("name", expr.parameter("u")) },
          { key: "departmentName", value: expr.member("name", expr.parameter("d")) },
          { key: "departmentCode", value: expr.member("code", expr.parameter("d")) },
        ]),
        ["u", "d"],
      ),
    );

    // Test ORDER BY
    expect(query.orderBy).to.have.lengthOf(1);
    expect(query.orderBy![0]).to.deep.equal({
      type: "order",
      expression: expr.lambda(expr.member("userName"), ANY),
      direction: "ASC",
    });
  });

  it("should handle external parameters in JOIN query", () => {
    const parser = new OxcParser();
    const context = { params: { minBudget: 50000 } };
    const users = new Queryable<User>("users", parser, context);
    const departments = new Queryable<Department>("departments", parser, context);

    const query = users
      .join(
        departments,
        (u) => u.departmentId,
        (d) => d.id,
        (u, d) => ({ userId: u.id, budget: d.budget }),
      )
      .where("result => result.budget > params.minBudget")
      .build();

    // Test external parameter reference
    expect(query.where).to.deep.equal(
      expr.binary(expr.member("budget"), ">", expr.parameter("minBudget", { type: "external" })),
    );
  });
});
```

### SQL Generator Tests

```typescript
import { expect } from "chai";
import { generateSql } from "../src/sql-generator.js";
import type { QueryExpression } from "@webpods/tinqer";

describe("SQL Generation", () => {
  it("should generate SQL for simple query", () => {
    const query: QueryExpression = {
      type: "query",
      operation: "SELECT",
      from: {
        type: "source",
        source: { type: "table", name: "users" },
      },
      where: {
        type: "binary",
        operator: ">=",
        left: { type: "member", property: "age" },
        right: {
          type: "parameter",
          name: "minAge",
          origin: { type: "external" },
        },
      },
    };

    const sql = generateSql(query);
    expect(sql).to.equal("SELECT * FROM users WHERE (age >= :minAge)");
  });

  it("should generate SQL for JOIN query", () => {
    const query: QueryExpression = {
      type: "query",
      operation: "SELECT",
      from: {
        type: "source",
        source: { type: "table", name: "users" },
      },
      joins: [
        {
          type: "join",
          kind: "INNER",
          table: "departments",
          on: {
            type: "binary",
            operator: "==",
            left: {
              type: "lambda",
              body: { type: "member", property: "departmentId" },
            },
            right: {
              type: "lambda",
              body: { type: "member", property: "id" },
            },
          },
        },
      ],
      select: {
        type: "lambda",
        body: {
          type: "object",
          properties: [
            {
              key: { type: "constant", value: "userName" },
              value: { type: "member", property: "name" },
            },
            {
              key: { type: "constant", value: "deptName" },
              value: { type: "member", property: "name" },
            },
          ],
        },
      },
    };

    const sql = generateSql(query);
    expect(sql).to.equal(
      "SELECT t0.name AS userName, t1.name AS deptName " +
        "FROM users t0 " +
        "INNER JOIN departments t1 ON (t0.departmentId = t1.id)",
    );
  });
});
```

## Package Inputs and Outputs

### @webpods/tinqer

**Input:**

- Lambda function strings (e.g., `"u => u.age > 18"`)
- Method calls on Queryable instances

**Output:**

- QueryExpression AST object
- Expression tree nodes with parameter origin tracking
- NO SQL generation
- NO execution

**Example:**

```typescript
// Input to tinqer (internally called by sql-pg-promise)
const queryable = new Queryable<User>("users", parser);
queryable.where("u => u.age > 18").select("u => ({ id: u.id, name: u.name })");

// Output from tinqer
const ast: QueryExpression = {
  type: "query",
  operation: "SELECT",
  from: { type: "source", source: { type: "table", name: "users" } },
  where: {
    type: "binary",
    operator: ">",
    left: { type: "member", property: "age" },
    right: { type: "constant", value: 18 },
  },
  select: {
    type: "lambda",
    parameters: [{ type: "parameter", name: "u" }],
    body: {
      type: "object",
      properties: [
        { key: { type: "constant", value: "id" }, value: { type: "member", property: "id" } },
        { key: { type: "constant", value: "name" }, value: { type: "member", property: "name" } },
      ],
    },
  },
};
```

### @webpods/tinqer-sql-pg-promise

**Input:**

- Query builder lambda function
- Params object with external values

**Output:**

- SQL string with :paramName placeholders for pg-promise
- Just the string, NOT an object with sql and params

**Example:**

```typescript
// Input to sql-pg-promise
const sql = query(
  (params) =>
    users.where((u) => u.age >= params.minAge).select((u) => ({ id: u.id, name: u.name })),
  { minAge: 18 },
);

// Output from sql-pg-promise
("SELECT t0.id AS id, t0.name AS name FROM users t0 WHERE (t0.age >= :minAge)");
// Note: The params object ({ minAge: 18 }) is used by pg-promise separately
```

## Processing Pipeline

1. **Query Function** (in tinqer-sql-pg-promise):
   - Receives lambda function and params object
   - Parses the lambda to extract table references
   - Creates Queryable instances with proper context
   - Validates parameter usage

2. **Expression Tree Building** (in tinqer):
   - Lambda functions → OXC Parser → ESTree AST
   - ESTree → ESTreeConverter → Tinqer Expression trees
   - Queryable methods build up QueryExpression structure

3. **SQL Generation** (in tinqer-sql-pg-promise):
   - Traverses QueryExpression tree
   - Generates SQL with proper table aliases
   - Maps external params to :paramName format
   - Returns SQL string (NOT {sql, params} object)

## Project Structure & Standards

### Follows WebPods Standards

- TypeScript with ES modules (.js extensions in imports)
- Mocha + Chai for testing
- No build step for tests (using Node's native TypeScript support)
- Simple package structure (not a traditional monorepo with workspaces)
- Tests in `tests/` directory with `.test.ts` files

## Supported Features

### Query Operations

- WHERE clauses with complex conditions
- SELECT projections (including object literals)
- ORDER BY (ASC/DESC)
- GROUP BY
- HAVING
- JOIN (INNER, LEFT, RIGHT, FULL, CROSS)
- LIMIT and OFFSET
- DISTINCT
- Aggregate functions (COUNT, SUM, AVG, MIN, MAX)
- Subqueries
- CTEs (Common Table Expressions)
- Set operations (UNION, INTERSECT, EXCEPT)

### String Methods

- `toLowerCase()` → `LOWER()`
- `toUpperCase()` → `UPPER()`
- `startsWith()` → `LIKE 'prefix%'`
- `endsWith()` → `LIKE '%suffix'`
- `includes()` → `LIKE '%substring%'`

## Limitations

1. **No Dynamic Queries** - Query structure must be static (lambdas are parsed as strings)
2. **No External Variables** - Cannot access closure variables
3. **Limited Method Support** - Only specific string methods are supported
4. **No Runtime Evaluation** - Lambdas are not executed, only parsed
5. **SELECT Only** - No support for INSERT, UPDATE, DELETE
6. **No Array Methods** - Methods like `map`, `filter` not supported (use query operations instead)

## TODO List

### Phase 1: Core Implementation

- [ ] Delete all existing code and tests
- [ ] Implement QueryExpression interfaces with generic structure from the start
- [ ] Implement OxcParser wrapper
- [ ] Implement ESTreeConverter with parameter origin tracking
- [ ] Implement Queryable class (SELECT only)
- [ ] Implement comprehensive tree helper utilities for testing

### Phase 2: Query Function

- [ ] Implement table detection from lambda function
- [ ] Implement parameter validation (only params.xxx allowed)
- [ ] Create proxy wrapper for params object
- [ ] Implement Queryable creation with proper context

### Phase 3: SQL Generation

- [ ] Implement SQL generator with table aliasing
- [ ] Handle all expression types
- [ ] Map external parameters to :paramName format
- [ ] Support complex JOINs with generic ON conditions
- [ ] Handle string methods (toLowerCase, startsWith, etc.)

### Phase 4: Testing

- [ ] Write tests using tree helpers exclusively
- [ ] Test all expression types
- [ ] Test parameter origin tracking
- [ ] Test complex JOIN scenarios
- [ ] Test error cases (invalid parameter access, etc.)

### Phase 5: Documentation

- [ ] API documentation
- [ ] Usage examples
- [ ] Migration guide from raw SQL
- [ ] Performance considerations

## Important Notes

1. **Generic First**: Always implement the generic case first. Simple cases should fall out naturally.
2. **No Special Cases**: Avoid special-case handling. Use generic expressions everywhere.
3. **Tree Helpers**: Test helpers must produce identical AST to what the parser creates.
4. **User Never Sees Tinqer**: Users only import from adapter packages.
5. **Return SQL String Only**: query() returns just the SQL string, not an object.

## Complete Example: JOIN Query Flow

### User Code

```typescript
import { query } from "@webpods/tinqer-sql-pg-promise";

// Define table types
interface User {
  id: number;
  name: string;
  email: string;
  departmentId: number;
  isActive: boolean;
}

interface Department {
  id: number;
  name: string;
  code: string;
  budget: number;
}

// Assume these are table references (created by tinqer-sql-pg-promise)
declare const users: Queryable<User>;
declare const departments: Queryable<Department>;

// User writes this query
const sql = query(
  (params) =>
    users
      .where((u) => u.isActive === true)
      .join(
        departments,
        (u) => u.departmentId,
        (d) => d.id,
        (u, d) => ({
          userId: u.id,
          userName: u.name,
          departmentName: d.name,
          departmentCode: d.code,
        }),
      )
      .where((result) => result.departmentCode === params.deptCode)
      .orderBy((result) => result.userName),
  { deptCode: "ENG" },
);
```

### Step 1: Parse to Expression Tree (tinqer)

```typescript
// The above query generates this QueryExpression:
{
  type: "query",
  operation: "SELECT",
  from: {
    type: "source",
    source: { type: "table", name: "users" }
  },
  where: {
    type: "logical",
    operator: "&&",
    left: {
      type: "binary",
      operator: "===",
      left: { type: "member", property: "isActive" },
      right: { type: "constant", value: true }
    },
    right: {
      type: "binary",
      operator: "===",
      left: { type: "member", property: "departmentCode" },
      right: {
        type: "parameter",
        name: "deptCode",
        origin: { type: "external" }
      }
    }
  },
  joins: [{
    type: "join",
    kind: "INNER",
    table: "departments",
    on: {
      type: "binary",
      operator: "==",
      left: {
        type: "lambda",
        parameters: [{ type: "parameter", name: "u", origin: { type: "table" } }],
        body: { type: "member", property: "departmentId" }
      },
      right: {
        type: "lambda",
        parameters: [{ type: "parameter", name: "d", origin: { type: "table" } }],
        body: { type: "member", property: "id" }
      }
    }
  }],
  select: {
    type: "lambda",
    parameters: [
      { type: "parameter", name: "u" },
      { type: "parameter", name: "d" }
    ],
    body: {
      type: "object",
      properties: [
        {
          key: { type: "constant", value: "userId" },
          value: { type: "member", property: "id", object: { type: "parameter", name: "u" } }
        },
        {
          key: { type: "constant", value: "userName" },
          value: { type: "member", property: "name", object: { type: "parameter", name: "u" } }
        },
        {
          key: { type: "constant", value: "departmentName" },
          value: { type: "member", property: "name", object: { type: "parameter", name: "d" } }
        },
        {
          key: { type: "constant", value: "departmentCode" },
          value: { type: "member", property: "code", object: { type: "parameter", name: "d" } }
        }
      ]
    }
  },
  orderBy: [{
    type: "order",
    expression: {
      type: "lambda",
      body: { type: "member", property: "userName" }
    },
    direction: "ASC"
  }]
}
```

### Step 2: Generate SQL (tinqer-sql-pg-promise)

```sql
SELECT
  t0.id AS userId,
  t0.name AS userName,
  t1.name AS departmentName,
  t1.code AS departmentCode
FROM users t0
INNER JOIN departments t1 ON (t0.departmentId = t1.id)
WHERE (t0.isActive = TRUE AND departmentCode = :deptCode)
ORDER BY userName ASC
```

### Final Output

```typescript
// The query() function returns just this SQL string:
"SELECT t0.id AS userId, t0.name AS userName, t1.name AS departmentName, t1.code AS departmentCode FROM users t0 INNER JOIN departments t1 ON (t0.departmentId = t1.id) WHERE (t0.isActive = TRUE AND departmentCode = :deptCode) ORDER BY userName ASC";

// The params object { deptCode: "ENG" } is used separately by pg-promise
```

## Simple Query Flow (Without JOIN)

```typescript
// User writes:
const sql = query((params) => users.where((u) => u.age >= params.minAge), { minAge: 18 });

// 1. Parse the lambda to get "users" table reference
// 2. Create Queryable<User> with proper context
// 3. Parse where lambda: "u => u.age >= params.minAge"
// 4. Build expression tree with origin tracking
// 5. Generate SQL: "SELECT * FROM users t0 WHERE (t0.age >= :minAge)"
// 6. Return SQL string
```

## Critical Success Factors

1. **Generic expression trees that handle all cases uniformly**
2. **Proper parameter origin tracking throughout**
3. **Clean separation between AST generation and SQL generation**
4. **Test utilities that accurately represent parser output**
5. **No leaky abstractions - users never see implementation details**
