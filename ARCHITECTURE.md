# Architecture

Tinqer is a LINQ-to-SQL query builder for TypeScript that converts lambda expressions into SQL queries through runtime parsing and expression tree generation.

## Core Design Principles

### Expression Trees
Tinqer uses expression trees to represent queries, matching the design of .NET LINQ. Each query operation wraps its source operation, creating a nested tree structure that preserves the complete operation chain. This allows accurate SQL generation that respects operation order and composition.

### Runtime Lambda Parsing
TypeScript lambdas are parsed at runtime using the OXC parser to extract their abstract syntax tree (AST). The AST is then converted into strongly-typed expression objects that represent the query logic.

### Type Safety
The library provides compile-time type safety through TypeScript's type system while maintaining runtime flexibility. Operations like `select<TResult>` properly transform types through the query chain.

## System Components

### 1. Parser Layer
**Location**: `packages/tinqer/src/parser/`

The parser layer wraps the OXC JavaScript/TypeScript parser to convert lambda function strings into AST representations.

- **OxcParser**: Wrapper around the OXC WASM parser
- **Parser Module**: High-level parsing API that coordinates parsing and conversion

### 2. Converter Layer
**Location**: `packages/tinqer/src/converter/`

Converts OXC AST nodes into Tinqer's expression tree representation.

- **AstConverter**: Main conversion logic from AST to Expression types
- **ConversionContext**: Maintains context during conversion (parameter origins, external params)

Key responsibilities:
- Transform JavaScript AST nodes into typed Expression objects
- Handle parameter binding and scope resolution
- Extract lambda bodies (removing wrapper functions)
- Support for operators, member access, method calls, and literals

### 3. Expression Types
**Location**: `packages/tinqer/src/types/`

Strongly-typed representation of query expressions using discriminated unions.

Core expression types:
- **ConstantExpression**: Literal values
- **ParameterExpression**: Lambda parameters with origin tracking
- **MemberExpression**: Property/field access
- **BinaryExpression**: Binary operators (==, >, <, etc.)
- **LogicalExpression**: Logical operators (&&, ||)
- **CallExpression**: Method calls
- **LambdaExpression**: Lambda functions with parameters and body

Specialized query expressions:
- **WhereExpression**: Subset of expressions valid in WHERE clauses
- **SelectExpression**: Subset of expressions valid in SELECT projections
- **GroupByExpression**: Subset of expressions valid in GROUP BY
- **OrderByExpression**: Subset of expressions valid in ORDER BY

### 4. Query Operations
**Location**: `packages/tinqer/src/types/query-operations.ts`

Expression tree nodes that represent LINQ operations. Each operation contains its source, creating a tree structure.

Chainable operations:
- **FromOperation**: Root of query chain (table source)
- **WhereOperation**: Filter operation containing predicate
- **SelectOperation**: Projection operation containing selector
- **JoinOperation**: Join operation with keys and result selector
- **GroupByOperation**: Grouping with key/element/result selectors
- **OrderByOperation**: Sorting with key selector and direction
- **ThenByOperation**: Secondary sorting (chains after OrderBy)
- **DistinctOperation**: Distinct values
- **TakeOperation**: Limit results (LIMIT in SQL)
- **SkipOperation**: Offset results (OFFSET in SQL)

Terminal operations:
- **FirstOperation**: First element with optional predicate
- **SingleOperation**: Single element (error if multiple)
- **CountOperation**: Count elements with optional predicate
- **AnyOperation**: Check existence with optional predicate
- **AllOperation**: Check all match predicate
- **SumOperation**: Sum numeric values
- **AverageOperation**: Average numeric values
- **MinOperation**: Minimum value
- **MaxOperation**: Maximum value
- **ToArrayOperation**: Materialize to array

### 5. Queryable API
**Location**: `packages/tinqer/src/queryable/`

Fluent API for building queries using method chaining.

- **Queryable<T>**: Main query builder class
- **OrderedQueryable<T>**: Extended queryable supporting thenBy operations
- **TerminalQuery<T>**: Represents terminated queries that return values
- **from<T>()**: Factory function to create initial queryable

Key features:
- Method chaining for query composition
- Type transformation through operations (select changes T to TResult)
- Separation of chainable and terminal operations
- Expression tree preservation through operation chain

### 6. LINQ Interfaces
**Location**: `packages/tinqer/src/types/linq-interfaces.ts`

TypeScript interfaces matching .NET LINQ for compatibility.

- **IQueryable<T>**: Core queryable interface
- **IOrderedQueryable<T>**: Ordered queryable supporting thenBy
- **IGrouping<TKey, TElement>**: Grouped elements with common key
- **ILookup<TKey, TElement>**: Multi-value dictionary

## Data Flow

```
Lambda Function
    ↓
String Representation (.toString())
    ↓
OXC Parser (WASM)
    ↓
AST (Abstract Syntax Tree)
    ↓
AstConverter
    ↓
Expression Tree
    ↓
Query Operations (Nested Tree)
    ↓
SQL Adapter (PostgreSQL, MySQL, etc.)
    ↓
SQL Query String
```

## Query Execution Model

Queries in Tinqer follow a deferred execution model:

1. **Query Construction**: Operations build an expression tree without executing
2. **Terminal Operation**: Methods like `toArray()`, `first()`, `count()` terminate the chain
3. **SQL Generation**: Expression tree is traversed to generate SQL
4. **Database Execution**: SQL is executed against the database
5. **Result Mapping**: Results are mapped back to TypeScript types

## Extension Points

### SQL Adapters
Different SQL dialects are supported through adapter packages:

- `tinqer-sql-pg-promise`: PostgreSQL adapter using pg-promise
- Future: MySQL, SQLite, SQL Server adapters

Adapters implement:
- Expression tree to SQL conversion
- Dialect-specific SQL generation
- Parameter binding and escaping
- Result mapping

### Custom Expressions
The expression system is extensible through discriminated unions. New expression types can be added by:

1. Adding new type to Expression union
2. Implementing conversion in AstConverter
3. Implementing SQL generation in adapters

## Type Safety Guarantees

Tinqer provides multiple levels of type safety:

1. **Compile-time**: TypeScript ensures type correctness of lambda parameters and return types
2. **Parse-time**: Parser validates JavaScript syntax
3. **Conversion-time**: Converter validates expression types for each operation
4. **Generation-time**: SQL adapter validates expression semantics

## Performance Considerations

- **Parser Caching**: Parsed expressions could be cached to avoid re-parsing
- **Expression Reuse**: Common sub-expressions could be identified and reused
- **SQL Preparation**: Generated SQL could use prepared statements
- **Lazy Evaluation**: Operations build trees without immediate processing

## Security

- **Parameter Binding**: All values are parameterized, never concatenated
- **Expression Validation**: Only safe expressions are allowed
- **SQL Injection Prevention**: Expression tree approach prevents injection by design
- **Type Validation**: Strong typing prevents type confusion attacks