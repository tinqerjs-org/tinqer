# Tinqer

LINQ-to-SQL query builder for TypeScript with full type safety and expression tree generation.

## Overview

Tinqer brings .NET LINQ's expressive query syntax to TypeScript, allowing you to write strongly-typed database queries using familiar lambda expressions. Queries are parsed at runtime into expression trees and converted to SQL by database-specific adapters.

## Key Features

- **Full Type Safety**: Complete TypeScript type checking for all query operations
- **LINQ-Compatible API**: Methods and signatures match .NET LINQ
- **Expression Trees**: Preserves complete operation chain for accurate SQL generation
- **Runtime Lambda Parsing**: Converts TypeScript functions to AST at runtime
- **Multiple SQL Dialects**: PostgreSQL, MySQL, SQLite support through adapters
- **Deferred Execution**: Queries build expression trees without immediate execution

## Installation

```bash
# For PostgreSQL
npm install @webpods/tinqer-sql-pg-promise

# For MySQL (coming soon)
npm install @webpods/tinqer-sql-mysql

# For SQLite (coming soon)
npm install @webpods/tinqer-sql-sqlite
```

Note: Never install `@webpods/tinqer` directly - always use a database adapter package.

## Quick Start

```typescript
import { from } from "@webpods/tinqer-sql-pg-promise";

// Define your table types
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  isActive: boolean;
}

// Create a queryable
const users = from<User>("users");

// Build a query
const activeAdults = users
  .where((u) => u.age >= 18 && u.isActive)
  .select((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }))
  .orderBy((u) => u.name);

// Terminal operations return TerminalQuery<T>
const firstUser = users.first((u) => u.id === 1);
const userCount = users.count((u) => u.isActive);
const allUsers = users.toArray();
```

## Executing Queries

Tinqer provides two ways to work with queries:

### Generating SQL

Use `query()` to generate SQL and parameters:

```typescript
import { query } from "@webpods/tinqer-sql-pg-promise";

const result = query(
  (p: { minAge: number }) => from<User>("users").where((u) => u.age >= p.minAge),
  { minAge: 18 },
);

console.log(result.sql); // SELECT * FROM "users" AS t0 WHERE age >= $(minAge)
console.log(result.params); // { minAge: 18 }

// Execute with pg-promise
const rows = await db.any(result.sql, result.params);
```

### Direct Execution

Use `execute()` for type-safe query execution:

```typescript
import { execute } from "@webpods/tinqer-sql-pg-promise";
import db from "./database"; // Your pg-promise instance

// Returns User[]
const users = await execute(db, () => from<User>("users").where((u) => u.age >= 18), {});

// Returns { id: number, name: string }[]
const userInfo = await execute(
  db,
  () =>
    from<User>("users")
      .where((u) => u.isActive)
      .select((u) => ({ id: u.id, name: u.name })),
  {},
);

// Terminal operations return single values
const firstUser = await execute(db, () => from<User>("users").first(), {}); // Returns User (not User[])

const userCount = await execute(db, () => from<User>("users").count(), {}); // Returns number

const hasAdults = await execute(db, () => from<User>("users").any((u) => u.age >= 18), {}); // Returns boolean
```

## API Reference

### Chainable Operations

Operations that return `Queryable<T>` and can be chained:

#### Filtering

- `where(predicate: (item: T) => boolean)` - Filter elements
- `distinct()` - Return unique elements

#### Projection

- `select<TResult>(selector: (item: T) => TResult)` - Transform elements
- `selectMany<TResult>(selector: (item: T) => TResult[])` - Flatten nested collections

#### Joining

- `join<TInner, TKey, TResult>(inner, outerKey, innerKey, resultSelector)` - Inner join
- `groupJoin<TInner, TKey, TResult>(inner, outerKey, innerKey, resultSelector)` - Left outer join with grouping

#### Grouping

- `groupBy<TKey>(keySelector)` - Group by key returning `IGrouping<TKey, T>`
- `groupByWithElementSelector<TKey, TElement>(keySelector, elementSelector)` - Group with element projection
- `groupByWithResultSelector<TKey, TResult>(keySelector, resultSelector)` - Group with result transformation

#### Ordering

- `orderBy<TKey>(keySelector)` - Sort ascending, returns `OrderedQueryable<T>`
- `orderByDescending<TKey>(keySelector)` - Sort descending, returns `OrderedQueryable<T>`
- `thenBy<TKey>(keySelector)` - Secondary sort ascending (only on `OrderedQueryable<T>`)
- `thenByDescending<TKey>(keySelector)` - Secondary sort descending (only on `OrderedQueryable<T>`)

#### Partitioning

- `take(count: number | ((params) => number))` - Take first N elements
- `skip(count: number | ((params) => number))` - Skip first N elements

### Terminal Operations

Operations that end the chain and return `TerminalQuery<T>`:

#### Element Operators

- `first(predicate?)` - First element or throw
- `firstOrDefault(predicate?)` - First element or undefined
- `single(predicate?)` - Single element or throw
- `singleOrDefault(predicate?)` - Single element or undefined

#### Quantifiers

- `any(predicate?)` - Check if any element matches
- `all(predicate)` - Check if all elements match
- `contains(value)` - Check if sequence contains value

#### Aggregates

- `count(predicate?)` - Count elements
- `sum(selector?)` - Sum numeric values
- `average(selector?)` - Average numeric values
- `min(selector?)` - Minimum value
- `max(selector?)` - Maximum value

#### Conversion

- `toArray()` - Convert to array

## Advanced Examples

### Complex Filtering

```typescript
const query = users
  .where((u) => u.age >= 21)
  .where((u) => u.name.toLowerCase().startsWith("j"))
  .where((u) => u.email.endsWith("@company.com"));
```

### Joins

```typescript
interface Department {
  id: number;
  name: string;
  budget: number;
}

const users = from<User>("users");
const departments = from<Department>("departments");

const userDepartments = users
  .join(
    departments,
    (u) => u.departmentId,
    (d) => d.id,
    (u, d) => ({
      userName: u.name,
      departmentName: d.name,
      budget: d.budget,
    }),
  )
  .where((result) => result.budget > 100000)
  .orderBy((result) => result.userName);
```

### Grouping

```typescript
const usersByAge = users
  .groupBy((u) => u.age)
  .select((g) => ({
    age: g.key,
    count: g.toArray().length,
  }));

const departmentSummaries = users.groupByWithResultSelector(
  (u) => u.departmentId,
  (key, group) => ({
    departmentId: key,
    userCount: group.toArray().length,
    avgAge: group.average((u) => u.age),
  }),
);
```

### Multiple Ordering

```typescript
const sorted = users
  .orderBy((u) => u.departmentId)
  .thenByDescending((u) => u.salary)
  .thenBy((u) => u.name);
```

### Parameterized Queries

```typescript
const minAge = 18;
const maxAge = 65;

const query = users.where((u) => u.age >= minAge && u.age <= maxAge).take(10);
```

## Expression Tree Structure

Tinqer converts queries into expression trees that preserve the complete operation chain:

```typescript
// This query:
users.where(u => u.age >= 18).select(u => u.name)

// Becomes this expression tree:
{
  type: "queryOperation",
  operationType: "select",
  selector: { /* name expression */ },
  source: {
    type: "queryOperation",
    operationType: "where",
    predicate: { /* age >= 18 expression */ },
    source: {
      type: "queryOperation",
      operationType: "from",
      table: "users"
    }
  }
}
```

## Type Safety

All operations maintain full type safety:

```typescript
interface User {
  id: number;
  name: string;
  age: number;
}

const users = from<User>("users");

// TypeScript knows the types
users
  .where((u) => u.age >= 18) // u is User
  .select((u) => ({
    // u is User
    userId: u.id, // u.id is number
    userName: u.name, // u.name is string
  })) // Result is { userId: number, userName: string }
  .first(); // Returns TerminalQuery<{ userId: number, userName: string }>

// Compile errors for invalid access
users.where((u) => u.invalid); // Error: Property 'invalid' does not exist on type 'User'
```

## Limitations

- **No Closure Variables**: Lambdas cannot access outer scope variables (use parameters instead)
- **Runtime Parsing**: Lambda functions are parsed from their string representation
- **Read-Only**: Only SELECT queries supported, no INSERT/UPDATE/DELETE
- **Method Support**: Limited to specific string methods (toLowerCase, toUpperCase, startsWith, etc.)

## Architecture

Tinqer follows a multi-stage pipeline:

1. **Lambda Expression** → Written in TypeScript
2. **String Parsing** → Lambda converted to string and parsed with OXC
3. **AST Generation** → JavaScript AST created
4. **Expression Tree** → AST converted to typed expression tree
5. **Query Operations** → Operations build nested tree structure
6. **SQL Generation** → Adapter converts tree to SQL
7. **Database Execution** → SQL executed with parameters

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT
