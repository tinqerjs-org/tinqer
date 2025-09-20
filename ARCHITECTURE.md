# Architecture

Tinqer is a LINQ-to-SQL query builder for TypeScript that converts lambda expressions into SQL queries through runtime parsing and expression tree generation.

## Core Design Principles

### Dual Type System

Tinqer employs a dual type system to provide both compile-time type safety and runtime SQL generation:

1. **Compile-time Layer**: TypeScript classes (`Queryable<T>`, `TerminalQuery<T>`) provide type-safe APIs for users
2. **Runtime Layer**: Simplified expression trees without generics for parsing and SQL generation

This separation allows users to write fully type-safe queries while the parser works with simplified data structures.

### Expression Trees

Tinqer uses expression trees to represent queries, matching the design of .NET LINQ. Each query operation wraps its source operation, creating a nested tree structure that preserves the complete operation chain.

### Runtime Lambda Parsing

TypeScript lambdas are parsed at runtime using the OXC parser. The function string representation is converted to AST, then to our expression tree format.

## Expression Type System

### Expression Type Hierarchy

Expressions are precisely typed based on their evaluation result:

```typescript
// Base type - all possible expressions
export type Expression = BooleanExpression | ValueExpression | ObjectExpression | ArrayExpression;

// Boolean expressions - evaluate to true/false
export type BooleanExpression =
  | ComparisonExpression // x.age >= 18
  | LogicalExpression // x.age >= 18 && x.isActive
  | BooleanMemberExpression // x.isActive
  | BooleanMethodExpression // x.name.startsWith("J")
  | NotExpression // !x.isDeleted
  | BooleanConstantExpression // true or false
  | ExistsExpression; // EXISTS (subquery)

// Value expressions - evaluate to a value
export type ValueExpression =
  | ColumnExpression // x.name
  | ConstantExpression // 42, "hello"
  | ParameterExpression // p.minAge
  | ArithmeticExpression // x.age + 1
  | StringMethodExpression // x.name.toLowerCase()
  | CaseExpression; // CASE WHEN ... THEN ...
```

### Detailed Expression Types

#### ComparisonExpression

Represents binary comparisons that produce boolean results.

```typescript
export interface ComparisonExpression {
  type: "comparison";
  operator: "==" | "!=" | ">" | ">=" | "<" | "<=";
  left: ValueExpression;
  right: ValueExpression;
}
```

**Example Input**: `x => x.age >= 18`
**Example Output**:

```typescript
{
  type: "comparison",
  operator: ">=",
  left: { type: "column", name: "age" },
  right: { type: "constant", value: 18 }
}
```

#### LogicalExpression

Combines boolean expressions with logical operators.

```typescript
export interface LogicalExpression {
  type: "logical";
  operator: "&&" | "||";
  left: BooleanExpression;
  right: BooleanExpression;
}
```

**Example Input**: `x => x.age >= 18 && x.isActive`
**Example Output**:

```typescript
{
  type: "logical",
  operator: "&&",
  left: {
    type: "comparison",
    operator: ">=",
    left: { type: "column", name: "age" },
    right: { type: "constant", value: 18 }
  },
  right: { type: "column", name: "isActive" }
}
```

#### ColumnExpression

References a table column.

```typescript
export interface ColumnExpression {
  type: "column";
  name: string;
  table?: string; // Optional table alias for joins
}
```

**Example Input**: `x => x.name`
**Example Output**: `{ type: "column", name: "name" }`

#### ParameterExpression

References an external parameter passed to the query.

```typescript
export interface ParameterExpression {
  type: "param";
  param: string; // Parameter name (e.g., "p")
  property?: string; // Property path (e.g., "minAge")
}
```

**Example Input**: `p => p.minAge`
**Example Output**: `{ type: "param", param: "p", property: "minAge" }`

#### ObjectExpression

Represents object literals, typically used in SELECT projections.

```typescript
export interface ObjectExpression {
  type: "object";
  properties: Array<{
    key: string;
    value: ValueExpression | BooleanExpression;
  }>;
}
```

**Example Input**: `x => ({ id: x.id, name: x.name })`
**Example Output**:

```typescript
{
  type: "object",
  properties: [
    { key: "id", value: { type: "column", name: "id" } },
    { key: "name", value: { type: "column", name: "name" } }
  ]
}
```

## Query Operations

### Simplified Operation Structure

Query operations no longer use complex generics. Each operation has a precise structure with specific expression types.

### Base QueryOperation

```typescript
export interface QueryOperation {
  type: "queryOperation";
  operationType: string;
}
```

### Chainable Operations

#### FromOperation

The root of all query chains.

```typescript
export interface FromOperation extends QueryOperation {
  operationType: "from";
  table: string;
  schema?: string;
}
```

**Example**: `from<User>("users")`
**Output**:

```typescript
{
  type: "queryOperation",
  operationType: "from",
  table: "users"
}
```

#### WhereOperation

Filters rows based on a boolean predicate.

```typescript
export interface WhereOperation extends QueryOperation {
  operationType: "where";
  source: QueryOperation;
  predicate: BooleanExpression; // Must be boolean
}
```

**Example Input**: `.where(x => x.age >= 18 && x.isActive)`
**Example Output**:

```typescript
{
  operationType: "where",
  source: { /* previous operation */ },
  predicate: {
    type: "logical",
    operator: "&&",
    left: {
      type: "comparison",
      operator: ">=",
      left: { type: "column", name: "age" },
      right: { type: "constant", value: 18 }
    },
    right: { type: "column", name: "isActive" }
  }
}
```

#### SelectOperation

Projects data into a new shape.

```typescript
export interface SelectOperation extends QueryOperation {
  operationType: "select";
  source: QueryOperation;
  selector: ValueExpression | ObjectExpression;
}
```

**Example Input**: `.select(x => ({ id: x.id, name: x.name }))`
**Example Output**:

```typescript
{
  operationType: "select",
  source: { /* previous operation */ },
  selector: {
    type: "object",
    properties: [
      { key: "id", value: { type: "column", name: "id" } },
      { key: "name", value: { type: "column", name: "name" } }
    ]
  }
}
```

#### JoinOperation

Joins two tables on matching keys.

```typescript
export interface JoinOperation extends QueryOperation {
  operationType: "join";
  source: QueryOperation;
  inner: QueryOperation;
  outerKey: string; // Simple column name
  innerKey: string; // Simple column name
  resultSelector: ObjectExpression;
  joinType: "inner" | "left" | "right" | "full" | "cross";
}
```

**Example Input**:

```typescript
users.join(
  departments,
  (u) => u.departmentId,
  (d) => d.id,
  (u, d) => ({ userName: u.name, deptName: d.name }),
);
```

**Example Output**:

```typescript
{
  operationType: "join",
  source: { /* users table */ },
  inner: { /* departments table */ },
  outerKey: "departmentId",
  innerKey: "id",
  resultSelector: {
    type: "object",
    properties: [
      { key: "userName", value: { type: "column", name: "name", table: "t0" } },
      { key: "deptName", value: { type: "column", name: "name", table: "t1" } }
    ]
  },
  joinType: "inner"
}
```

#### OrderByOperation

Sorts results by a key.

```typescript
export interface OrderByOperation extends QueryOperation {
  operationType: "orderBy";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  direction: "ascending" | "descending";
}
```

**Example Input**: `.orderBy(x => x.name)`
**Example Output**:

```typescript
{
  operationType: "orderBy",
  source: { /* previous operation */ },
  keySelector: "name",
  direction: "ascending"
}
```

#### GroupByOperation

Groups rows by a key.

```typescript
export interface GroupByOperation extends QueryOperation {
  operationType: "groupBy";
  source: QueryOperation;
  keySelector: string | ValueExpression;
  elementSelector?: ValueExpression | ObjectExpression;
}
```

**Example Input**: `.groupBy(x => x.departmentId)`
**Example Output**:

```typescript
{
  operationType: "groupBy",
  source: { /* previous operation */ },
  keySelector: "departmentId"
}
```

#### TakeOperation / SkipOperation

Limits or skips rows.

```typescript
export interface TakeOperation extends QueryOperation {
  operationType: "take";
  source: QueryOperation;
  count: number | ParamRef;
}

export interface SkipOperation extends QueryOperation {
  operationType: "skip";
  source: QueryOperation;
  count: number | ParamRef;
}
```

**Example Input**: `.take(10).skip(p => p.offset)`
**Example Output**:

```typescript
{
  operationType: "take",
  source: {
    operationType: "skip",
    source: { /* previous */ },
    count: { param: "p", property: "offset" }
  },
  count: 10
}
```

### Terminal Operations

Terminal operations end the query chain and produce a result.

#### CountOperation

Counts rows.

```typescript
export interface CountOperation extends QueryOperation {
  operationType: "count";
  source: QueryOperation;
  predicate?: BooleanExpression;
}
```

**Example Input**: `.count(x => x.isActive)`
**Example Output**:

```typescript
{
  operationType: "count",
  source: { /* previous operation */ },
  predicate: { type: "column", name: "isActive" }
}
```

#### FirstOperation / SingleOperation

Gets first or single row.

```typescript
export interface FirstOperation extends QueryOperation {
  operationType: "first";
  source: QueryOperation;
  predicate?: BooleanExpression;
}
```

#### Aggregate Operations

Sum, Average, Min, Max operations.

```typescript
export interface SumOperation extends QueryOperation {
  operationType: "sum";
  source: QueryOperation;
  selector: ValueExpression;
}
```

**Example Input**: `.sum(x => x.amount)`
**Example Output**:

```typescript
{
  operationType: "sum",
  source: { /* previous operation */ },
  selector: { type: "column", name: "amount" }
}
```

## API Layers

### User-Facing API (Compile-Time)

```typescript
// Queryable class for type-safe chaining
class Queryable<T> {
  where(predicate: (item: T) => boolean): Queryable<T>;
  select<TResult>(selector: (item: T) => TResult): Queryable<TResult>;
  orderBy<TKey>(keySelector: (item: T) => TKey): OrderedQueryable<T>;

  // Terminal operations
  count(predicate?: (item: T) => boolean): TerminalQuery<number>;
  first(predicate?: (item: T) => boolean): TerminalQuery<T>;
  toArray(): TerminalQuery<T[]>;
}

// Terminal query marker
class TerminalQuery<T> {
  private _phantom?: T;
}

// Entry point
function from<T>(table: string): Queryable<T>;
```

### Parser API (Runtime)

```typescript
// Main parsing function
function parseQuery<TParams, TResult>(
  queryBuilder: (params: TParams) => Queryable<TResult> | TerminalQuery<TResult>,
): QueryOperation;

// Parses individual lambdas
function parseLambda(fn: Function): Expression;

// Converts AST to expressions
function convertAstToExpression(ast: any, context: Context): Expression;

// Converts method chains to operations
function convertAstToQueryOperation(ast: any): QueryOperation;
```

### SQL Adapter API

```typescript
// Main query function (in adapters)
function query<TParams, TResult>(
  queryBuilder: (params: TParams) => Queryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
): { sql: string; params: TParams };

// SQL generation
function generateSql(operation: QueryOperation, params: any): string;
```

## Complete Example Flow

### User Code

```typescript
const result = query(
  (p: { minAge: number; dept: string }) =>
    from<User>("users")
      .where((x) => x.age >= p.minAge && x.department === p.dept)
      .select((x) => ({ id: x.id, name: x.name, age: x.age }))
      .orderBy((x) => x.name)
      .take(10),
  { minAge: 18, dept: "Engineering" },
);
```

### Parsed Expression Tree

```typescript
{
  type: "queryOperation",
  operationType: "take",
  count: 10,
  source: {
    operationType: "orderBy",
    keySelector: "name",
    direction: "ascending",
    source: {
      operationType: "select",
      selector: {
        type: "object",
        properties: [
          { key: "id", value: { type: "column", name: "id" } },
          { key: "name", value: { type: "column", name: "name" } },
          { key: "age", value: { type: "column", name: "age" } }
        ]
      },
      source: {
        operationType: "where",
        predicate: {
          type: "logical",
          operator: "&&",
          left: {
            type: "comparison",
            operator: ">=",
            left: { type: "column", name: "age" },
            right: { type: "param", param: "p", property: "minAge" }
          },
          right: {
            type: "comparison",
            operator: "==",
            left: { type: "column", name: "department" },
            right: { type: "param", param: "p", property: "dept" }
          }
        },
        source: {
          operationType: "from",
          table: "users"
        }
      }
    }
  }
}
```

### Generated SQL

```sql
SELECT id, name, age
FROM users
WHERE age >= :minAge AND department = :dept
ORDER BY name ASC
LIMIT 10
```

## Data Flow

```
User TypeScript Code
    ↓
Function.toString()
    ↓
OXC Parser (WASM)
    ↓
JavaScript AST
    ↓
convertAstToQueryOperation()
    ↓
Query Operation Tree (simplified, no generics)
    ↓
SQL Adapter generateSql()
    ↓
SQL String + Parameters
```

## Type Safety Guarantees

1. **Compile-time**: TypeScript validates lambda signatures and types
2. **Parse-time**: Expression types ensure correct operation combinations
3. **Generation-time**: SQL adapter validates expression semantics

## Performance Considerations

- **Parser Caching**: Cache parsed query functions to avoid re-parsing
- **Expression Reuse**: Identify and reuse common sub-expressions
- **Prepared Statements**: Generated SQL uses parameterized queries
- **Lazy Evaluation**: Operations build trees without immediate execution

## Security

- **No String Concatenation**: All values use parameterized queries
- **Expression Validation**: Only safe expressions allowed
- **No Dynamic Code**: No eval() or Function constructor usage
- **SQL Injection Prevention**: Expression tree approach prevents injection by design
