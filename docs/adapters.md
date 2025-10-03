[← Back to README](../README.md)

# Database Adapters

Tinqer provides SQL adapters for PostgreSQL and SQLite, translating expression trees to database-specific SQL.

## Table of Contents

- [1. PostgreSQL Adapter](#1-postgresql-adapter)
  - [1.1 Installation](#11-installation)
  - [1.2 Setup](#12-setup)
  - [1.3 PostgreSQL Features](#13-postgresql-features)
- [2. SQLite Adapter](#2-sqlite-adapter)
  - [2.1 Installation](#21-installation)
  - [2.2 Setup](#22-setup)
  - [2.3 SQLite Features and Limitations](#23-sqlite-features-and-limitations)
- [3. Key Differences](#3-key-differences)
  - [3.1 Parameter Placeholders](#31-parameter-placeholders)
  - [3.2 Data Types](#32-data-types)
  - [3.3 String Operations](#33-string-operations)
  - [3.4 RETURNING Clause](#34-returning-clause)
- [4. Adapter Interface](#4-adapter-interface)

---

## 1. PostgreSQL Adapter

### 1.1 Installation

```bash
npm install tinqer-sql-pg-promise pg-promise
```

### 1.2 Setup

```typescript
import pgPromise from "pg-promise";
import { pgPromiseAdapter, executeSelectSimple } from "tinqer-sql-pg-promise";
import { Queryable } from "tinqer";

const pgp = pgPromise();
const db = pgp({
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "user",
  password: "password",
});

interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
  };
}

const query = new Queryable<Schema, "users">("users")
  .where((u) => u.is_active === true)
  .select((u) => ({ id: u.id, name: u.name }));

const results = await executeSelectSimple(query, db, pgPromiseAdapter);
```

### 1.3 PostgreSQL Features

**Native Support:**

- Boolean type (`BOOLEAN`) with `true`/`false` values
- Case-insensitive matching with `ILIKE` operator
- `RETURNING` clause for INSERT, UPDATE, DELETE
- Full JSONB support for JSON operations
- Arrays and array operators
- Window functions
- CTEs (Common Table Expressions)

**Parameter Style:**

- Uses numbered placeholders: `$1`, `$2`, `$3`, etc.

---

## 2. SQLite Adapter

### 2.1 Installation

```bash
npm install tinqer-sql-better-sqlite3 better-sqlite3
```

### 2.2 Setup

```typescript
import Database from "better-sqlite3";
import { betterSqlite3Adapter } from "tinqer-sql-better-sqlite3";
import { selectStatement } from "tinqer-sql-better-sqlite3";
import { Queryable } from "tinqer";

const db = new Database("mydb.sqlite");

interface Schema {
  users: {
    id: number;
    name: string;
    email: string;
    is_active: number; // SQLite uses INTEGER (0/1) for boolean values
  };
}

const query = new Queryable<Schema, "users">("users")
  .where((u) => u.is_active === 1) // Use 1 for true, 0 for false
  .select((u) => ({ id: u.id, name: u.name }));

const { sql, params } = selectStatement(query, betterSqlite3Adapter);
const results = db.prepare(sql).all(...params);
```

### 2.3 SQLite Features and Limitations

**Native Support:**

- `RETURNING` clause (SQLite 3.35.0+)
- JSON functions (`json()`, `json_extract()`)
- Window functions (SQLite 3.25.0+)
- CTEs (SQLite 3.8.3+)

**Type System Limitations:**

- **No Boolean Type**: Use `INTEGER` with 0/1 values

  ```typescript
  interface Schema {
    users: {
      is_active: number; // NOT boolean
    };
  }

  // Query with 1/0 instead of true/false
  .where(u => u.is_active === 1)
  ```

- **Case-Insensitive Matching**: No native `ILIKE`, uses `LOWER()` function

  ```typescript
  // Tinqer helper functions handle this automatically
  const { contains } = createQueryHelpers<Schema>();

  .where(u => contains(u.name, "alice"))
  // SQLite: WHERE LOWER(u.name) LIKE LOWER($1)
  // PostgreSQL: WHERE u.name ILIKE $1
  ```

**Parameter Style:**

- Uses positional placeholders: `?`, `?`, `?`, etc.

---

## 3. Key Differences

### 3.1 Parameter Placeholders

**PostgreSQL:**

```sql
SELECT * FROM users WHERE age >= $1 AND status = $2
```

**SQLite:**

```sql
SELECT * FROM users WHERE age >= ? AND status = ?
```

Both adapters handle parameterization automatically. You work with the same TypeScript code; Tinqer generates the correct placeholders.

### 3.2 Data Types

| Type      | PostgreSQL                 | SQLite                     | Schema Type                             |
| --------- | -------------------------- | -------------------------- | --------------------------------------- |
| Boolean   | `BOOLEAN` (`true`/`false`) | `INTEGER` (0/1)            | PostgreSQL: `boolean`, SQLite: `number` |
| Integer   | `INTEGER`, `BIGINT`        | `INTEGER`                  | `number` or `bigint`                    |
| Decimal   | `NUMERIC`, `DECIMAL`       | `REAL`                     | `number`                                |
| String    | `TEXT`, `VARCHAR`          | `TEXT`                     | `string`                                |
| Date/Time | `TIMESTAMP`, `DATE`        | `TEXT` or `INTEGER`        | `string` or `Date`                      |
| JSON      | `JSONB`, `JSON`            | `TEXT` with JSON functions | `object`                                |

**Important:** Define schema types based on your target database:

```typescript
// PostgreSQL schema
interface PgSchema {
  users: {
    id: number;
    is_active: boolean; // Native boolean
  };
}

// SQLite schema
interface SqliteSchema {
  users: {
    id: number;
    is_active: number; // INTEGER (0/1)
  };
}
```

### 3.3 String Operations

**Case-Insensitive Matching:**

Using helper functions (recommended):

```typescript
const { ilike, contains } = createQueryHelpers<Schema>();

// Same TypeScript code works for both databases
.where(u => contains(u.name, "alice"))
```

Generated SQL:

```sql
-- PostgreSQL
WHERE u.name ILIKE $1  -- param: "%alice%"

-- SQLite
WHERE LOWER(u.name) LIKE LOWER(?)  -- param: "%alice%"
```

**Pattern Matching:**

PostgreSQL has more pattern operators:

```typescript
// Works in both, but uses different SQL
.where(u => u.email.includes("@example.com"))

// PostgreSQL: u.email LIKE $1
// SQLite: u.email LIKE ?
```

### 3.4 RETURNING Clause

Both adapters support `RETURNING` for INSERT, UPDATE, DELETE:

```typescript
const stmt = insert<Schema>("users")
  .values({ name: "Alice", email: "alice@example.com" })
  .returning((u) => u);

// PostgreSQL
const { results } = await executeInsert(stmt, pgDb, pgPromiseAdapter);

// SQLite (requires SQLite 3.35.0+)
const { sql, params } = toSql(stmt, betterSqlite3Adapter);
const results = sqliteDb.prepare(sql).all(...params);
```

**Note:** SQLite's `RETURNING` support requires SQLite version 3.35.0 or higher.

---

## 4. Adapter Interface

All adapters implement the `SQLAdapter` interface:

```typescript
interface SQLAdapter {
  // Parameter placeholder (e.g., "$1" for PostgreSQL, "?" for SQLite)
  parameterPlaceholder(index: number): string;

  // Quote identifiers (e.g., "users" for PostgreSQL, "users" for SQLite)
  quoteName(name: string): string;

  // Generate ILIKE or equivalent
  generateILike(left: string, right: string): string;

  // Database-specific expression handling
  visitBinaryExpression?(node: BinaryExpression, context: VisitorContext): string;
  visitCallExpression?(node: CallExpression, context: VisitorContext): string;
  // ... other visitor methods
}
```

**Creating Custom Adapters:**

You can create custom adapters for other databases by implementing this interface:

```typescript
import type { SQLAdapter } from "tinqer";

export const myCustomAdapter: SQLAdapter = {
  parameterPlaceholder: (index: number) => `:param${index}`,
  quoteName: (name: string) => `\`${name}\``,
  generateILike: (left: string, right: string) => `UPPER(${left}) LIKE UPPER(${right})`,
  // ... implement other methods
};
```

---

## Best Practices

1. **Define Schemas per Database:**
   - Use `boolean` for PostgreSQL
   - Use `number` (0/1) for SQLite boolean-like columns

2. **Use Helper Functions for Portability:**

   ```typescript
   const { contains, startsWith } = createQueryHelpers<Schema>();
   // Works across all databases
   ```

3. **Stay Close to Database Behavior:**
   - Tinqer is a SQL generator, not an ORM
   - No magic type conversions
   - Generated SQL reflects database capabilities

4. **Test with Target Database:**
   - SQL generation varies by adapter
   - Run integration tests with actual database

5. **Check Database Version:**
   - SQLite `RETURNING` requires 3.35.0+
   - Window functions require specific versions
   - Verify feature support for your database version

---

[← Back to README](../README.md)
