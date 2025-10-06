/**
 * Better SQLite3 SQL generator for Tinqer
 */

import {
  parseQuery,
  type Queryable,
  type OrderedQueryable,
  type TerminalQuery,
  type QueryHelpers,
  type QueryBuilder,
  type DatabaseSchema,
  type Insertable,
  type InsertableWithReturning,
  type UpdatableWithSet,
  type UpdatableComplete,
  type UpdatableWithReturning,
  type Deletable,
  type DeletableComplete,
  type ParseQueryOptions,
} from "@webpods/tinqer";
import { generateSql } from "./sql-generator.js";
import type { SqlResult, ExecuteOptions } from "./types.js";

/**
 * Helper function to expand array parameters into indexed parameters
 * e.g., { ids: [1, 2, 3] } becomes { ids: [1, 2, 3], "ids_0": 1, "ids_1": 2, "ids_2": 3 }
 */
function expandArrayParams(params: Record<string, unknown>): Record<string, unknown> {
  const expanded: Record<string, unknown> = { ...params };

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        expanded[`${key}_${index}`] = item;
      });
    }
  }

  return expanded;
}

/**
 * Generate SQL from a query builder function (with params and helpers)
 */
export function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
    helpers: QueryHelpers,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult>;

/**
 * Generate SQL from a query builder function (with params only, no helpers)
 */
export function selectStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult>;

/**
 * Generate SQL from a query builder function (query builder only, no params or helpers)
 */
export function selectStatement<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
): SqlResult<Record<string, string | number | boolean | null>, TResult>;

// Implementation
export function selectStatement<TSchema, TParams, TResult>(
  _schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
        helpers: QueryHelpers,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult> {
  // Parse the query to get the operation tree and auto-params
  const parseResult = parseQuery(builder, options || {});

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Merge user params with auto-extracted params
  // User params take priority over auto-params to avoid collisions
  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };

  // Generate SQL from the operation tree
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters into indexed parameters for IN clause support
  // e.g., { ids: [1, 2, 3] } becomes { ids: [1, 2, 3], "ids[0]": 1, "ids[1]": 2, "ids[2]": 3 }
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return { sql, params: finalParams };
}

/**
 * Simpler API for generating SQL with auto-parameterization
 * @param queryable A Queryable or TerminalQuery object
 * @param options Parse options including cache control
 * @returns Object with text (SQL string), parameters, and preserved result type
 */
export function toSql<T>(
  queryable: Queryable<T> | OrderedQueryable<T> | TerminalQuery<T>,
  options: ParseQueryOptions = {},
): {
  text: string;
  parameters: Record<string, unknown>;
  _resultType?: T;
} {
  // Create a dummy function that returns the queryable
  const queryBuilder = () => queryable;

  // Parse and generate SQL
  const parseResult = parseQuery(queryBuilder, options);

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Generate SQL with auto-parameters
  const sql = generateSql(parseResult.operation, parseResult.autoParams);

  return {
    text: sql,
    parameters: parseResult.autoParams,
  };
}

/**
 * Database interface for Better SQLite3 compatibility
 */
interface BetterSqlite3Database {
  prepare(sql: string): {
    all(params?: Record<string, unknown>): unknown[];
    get(params?: Record<string, unknown>): unknown;
    run(params?: Record<string, unknown>): { changes: number };
  };
}

/**
 * Execute a query with params and helpers
 */
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

/**
 * Execute a query with params only (no helpers)
 */
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

/**
 * Execute a query with query builder only (no params, no helpers)
 */
export function executeSelect<
  TSchema,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => TQuery,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never;

// Implementation
export function executeSelect<
  TSchema,
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams, helpers: QueryHelpers) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>, params: TParams) => TQuery)
    | ((queryBuilder: QueryBuilder<TSchema>) => TQuery),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
  type ReturnType =
    TQuery extends Queryable<infer T>
      ? T[]
      : TQuery extends OrderedQueryable<infer T>
        ? T[]
        : TQuery extends TerminalQuery<infer T>
          ? T
          : never;

  // Call selectStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? selectStatement(schema, builder, params, options)
      : selectStatement(schema, builder as (q: QueryBuilder<TSchema>) => TQuery);

  // Call onSql callback if provided
  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  // Check if this is a terminal operation that returns a single value
  const parseResult = parseQuery(builder, options || {});
  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  const operationType = parseResult.operation.operationType;

  // Convert parameters for SQLite compatibility
  // - Booleans: SQLite doesn't have a native boolean type - use 0 for false, 1 for true
  // - Dates: Convert to SQLite DATETIME format 'YYYY-MM-DD HH:MM:SS'
  const convertedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sqlParams)) {
    if (typeof value === "boolean") {
      convertedParams[key] = value ? 1 : 0;
    } else if (
      value !== null &&
      value !== undefined &&
      Object.prototype.toString.call(value) === "[object Date]"
    ) {
      // Convert to SQLite DATETIME format: 'YYYY-MM-DD HH:MM:SS'
      const date = value as unknown as Date;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");
      // For date-only comparisons, use just the date part (time will be 00:00:00)
      convertedParams[key] = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      convertedParams[key] = value;
    }
  }

  // Prepare statement
  const stmt = db.prepare(sql);

  // Handle different terminal operations
  switch (operationType) {
    case "first":
    case "firstOrDefault":
    case "single":
    case "singleOrDefault":
    case "last":
    case "lastOrDefault": {
      // These return a single item
      const rows = stmt.all(convertedParams);
      if (rows.length === 0) {
        if (operationType.includes("OrDefault")) {
          return null as ReturnType;
        }
        throw new Error(`No elements found for ${operationType} operation`);
      }
      if (operationType.startsWith("single") && rows.length > 1) {
        throw new Error(`Multiple elements found for ${operationType} operation`);
      }
      return rows[0] as ReturnType;
    }

    case "count":
    case "longCount": {
      // These return a number - SQL is: SELECT COUNT(*) FROM ...
      // SQLite returns the result with column name "COUNT(*)", so get the first column value
      const countResult = stmt.get(convertedParams) as Record<string, unknown>;
      const keys = Object.keys(countResult);
      if (keys.length > 0 && keys[0]) {
        return countResult[keys[0]] as ReturnType;
      }
      return 0 as ReturnType;
    }

    case "sum":
    case "average":
    case "min":
    case "max": {
      // These return a single aggregate value - SQL is: SELECT SUM/AVG/MIN/MAX(column) FROM ...
      // The result is in the first column of the row
      const aggResult = stmt.get(convertedParams) as Record<string, unknown>;
      const keys = Object.keys(aggResult);
      if (keys.length > 0 && keys[0]) {
        return aggResult[keys[0]] as ReturnType;
      }
      return null as ReturnType;
    }

    case "any": {
      // Returns boolean - SQL is: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
      const anyResult = stmt.get(convertedParams) as Record<string, unknown>;
      const anyKeys = Object.keys(anyResult);
      if (anyKeys.length > 0 && anyKeys[0]) {
        return (anyResult[anyKeys[0]] === 1) as ReturnType;
      }
      return false as ReturnType;
    }

    case "all": {
      // Returns boolean - SQL is: SELECT CASE WHEN NOT EXISTS(...) THEN 1 ELSE 0 END
      const allResult = stmt.get(convertedParams) as Record<string, unknown>;
      const allKeys = Object.keys(allResult);
      if (allKeys.length > 0 && allKeys[0]) {
        return (allResult[allKeys[0]] === 1) as ReturnType;
      }
      return false as ReturnType;
    }

    default:
      // Regular query that returns an array
      return stmt.all(convertedParams) as ReturnType;
  }
}

/**
 * Execute a query with no parameters
 * @param dbClient Better SQLite3 database instance
 * @param schema Database context with schema information
 * @param builder Function that builds the query using LINQ operations with DSL and helpers
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Query results, properly typed based on the query
 */
export function executeSelectSimple<
  TSchema,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  dbClient: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    _params: Record<string, never>,
    helpers: QueryHelpers,
  ) => TQuery,
  options: ExecuteOptions & ParseQueryOptions = {},
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
  return executeSelect(dbClient, schema, builder, {}, options);
}

// ==================== INSERT Statement & Execution ====================

/**
 * Generate INSERT SQL statement (with params)
 */
export function insertStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

/**
 * Generate INSERT SQL statement (without params)
 */
export function insertStatement<TSchema, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
): SqlResult<
  Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

// Implementation
export function insertStatement<TSchema, TParams, TTable, TReturning = never>(
  _schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  const parseResult = parseQuery(builder, options || {});

  if (!parseResult) {
    throw new Error("Failed to parse INSERT query");
  }

  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters into indexed parameters for IN clause support
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return {
    sql,
    params: finalParams,
  };
}

/**
 * Execute INSERT with params, return row count
 */
export function executeInsert<TSchema, TParams, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>, params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute INSERT with params and RETURNING (not supported by SQLite)
 */
export function executeInsert<TSchema, TParams, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): never;

/**
 * Execute INSERT without params, return row count
 */
export function executeInsert<TSchema, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Insertable<TTable>,
): number;

/**
 * Execute INSERT without params, with RETURNING (not supported by SQLite)
 */
export function executeInsert<TSchema, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => InsertableWithReturning<TTable, TReturning>,
): never;

// Implementation
export function executeInsert<TSchema, TParams, TTable, TReturning = never>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number {
  // Call insertStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? insertStatement(schema, builder, params, options)
      : insertStatement(
          schema,
          builder as (
            q: QueryBuilder<TSchema>,
          ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(sqlParams);
  return result.changes;
}

// ==================== UPDATE Statement & Execution ====================

/**
 * Generate UPDATE SQL statement (with params)
 */
export function updateStatement<TSchema, TParams, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

/**
 * Generate UPDATE SQL statement (without params)
 */
export function updateStatement<TSchema, TTable, TReturning = never>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
): SqlResult<
  Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
>;

// Implementation
export function updateStatement<TSchema, TParams, TTable, TReturning = never>(
  _schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  const parseResult = parseQuery(builder, options || {});

  if (!parseResult) {
    throw new Error("Failed to parse UPDATE query");
  }

  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters into indexed parameters for IN clause support
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return {
    sql,
    params: finalParams,
  };
}

/**
 * Execute UPDATE with params, return row count
 */
export function executeUpdate<TSchema, TParams, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute UPDATE with params and RETURNING (not supported by SQLite)
 */
export function executeUpdate<TSchema, TParams, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): never;

/**
 * Execute UPDATE without params, return row count
 */
export function executeUpdate<TSchema, TTable>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
  ) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
): number;

/**
 * Execute UPDATE without params, with RETURNING (not supported by SQLite)
 */
export function executeUpdate<TSchema, TTable, TReturning>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => UpdatableWithReturning<TTable, TReturning>,
): never;

// Implementation
export function executeUpdate<TSchema, TParams, TTable, TReturning = never>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>)
    | ((
        queryBuilder: QueryBuilder<TSchema>,
      ) =>
        | UpdatableWithSet<TTable>
        | UpdatableComplete<TTable>
        | UpdatableWithReturning<TTable, TReturning>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number {
  // Call updateStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? updateStatement(schema, builder, params, options)
      : updateStatement(
          schema,
          builder as (
            q: QueryBuilder<TSchema>,
          ) =>
            | UpdatableWithSet<TTable>
            | UpdatableComplete<TTable>
            | UpdatableWithReturning<TTable, TReturning>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(sqlParams);
  return result.changes;
}

// ==================== DELETE Statement & Execution ====================

/**
 * Generate DELETE SQL statement (with params)
 */
export function deleteStatement<TSchema, TParams, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void>;

/**
 * Generate DELETE SQL statement (without params)
 */
export function deleteStatement<TSchema, TResult>(
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): SqlResult<Record<string, string | number | boolean | null>, void>;

// Implementation
export function deleteStatement<TSchema, TParams, TResult>(
  _schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Deletable<TResult> | DeletableComplete<TResult>)
    | ((queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>),
  params?: TParams,
  options?: ParseQueryOptions,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void> {
  const parseResult = parseQuery(builder, options || {});

  if (!parseResult) {
    throw new Error("Failed to parse DELETE query");
  }

  const mergedParams = { ...parseResult.autoParams, ...(params || {}) };
  const sql = generateSql(parseResult.operation, mergedParams);

  // Expand array parameters into indexed parameters for IN clause support
  const finalParams = expandArrayParams(mergedParams) as TParams &
    Record<string, string | number | boolean | null>;

  return {
    sql,
    params: finalParams,
  };
}

/**
 * Execute DELETE with params, return row count
 */
export function executeDelete<TSchema, TParams, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (
    queryBuilder: QueryBuilder<TSchema>,
    params: TParams,
  ) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number;

/**
 * Execute DELETE without params, return row count
 */
export function executeDelete<TSchema, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder: (queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
): number;

// Implementation
export function executeDelete<TSchema, TParams, TResult>(
  db: BetterSqlite3Database,
  schema: DatabaseSchema<TSchema>,
  builder:
    | ((
        queryBuilder: QueryBuilder<TSchema>,
        params: TParams,
      ) => Deletable<TResult> | DeletableComplete<TResult>)
    | ((queryBuilder: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>),
  params?: TParams,
  options?: ExecuteOptions & ParseQueryOptions,
): number {
  // Call deleteStatement with appropriate arguments based on whether params provided
  const { sql, params: sqlParams } =
    params !== undefined
      ? deleteStatement(schema, builder, params, options)
      : deleteStatement(
          schema,
          builder as (q: QueryBuilder<TSchema>) => Deletable<TResult> | DeletableComplete<TResult>,
        );

  if (options?.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const stmt = db.prepare(sql);
  const result = stmt.run(sqlParams);
  return result.changes;
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
