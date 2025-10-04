/**
 * PostgreSQL SQL generator for Tinqer using pg-promise format
 */

import {
  parseQuery,
  type Queryable,
  type OrderedQueryable,
  type TerminalQuery,
  type QueryHelpers,
  type Insertable,
  type InsertableWithReturning,
  type UpdatableWithSet,
  type UpdatableComplete,
  type UpdatableWithReturning,
  type Deletable,
  type DeletableComplete,
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
 * Generate SQL from a query builder function
 * @param queryBuilder Function that builds the query using LINQ operations with helpers
 * @param params Parameters to pass to the query builder
 * @returns SQL string and merged params (user params + auto-extracted params)
 */
export function selectStatement<TParams, TResult>(
  queryBuilder: (
    params: TParams,
    helpers: QueryHelpers,
  ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>, TResult> {
  // Parse the query to get the operation tree and auto-params
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Merge user params with auto-extracted params
  // User params take priority over auto-params to avoid collisions
  const mergedParams = { ...parseResult.autoParams, ...params };

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
 * @returns Object with text (SQL string) and parameters
 */
export function toSql<T>(queryable: Queryable<T> | OrderedQueryable<T> | TerminalQuery<T>): {
  text: string;
  parameters: Record<string, unknown>;
} {
  // Create a dummy function that returns the queryable
  const queryBuilder = () => queryable;

  // Parse and generate SQL
  const parseResult = parseQuery(queryBuilder);

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
 * Database interface for pg-promise compatibility
 */
interface PgDatabase {
  any(sql: string, params?: unknown): Promise<unknown[]>;
  one(sql: string, params?: unknown): Promise<unknown>;
  result(sql: string, params?: unknown): Promise<{ rowCount: number }>;
}

/**
 * Execute a query and return typed results
 * @param db pg-promise database instance
 * @param queryBuilder Function that builds the query using LINQ operations with helpers
 * @param params Parameters to pass to the query builder
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Promise with query results, properly typed based on the query
 */
export async function executeSelect<
  TParams,
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase,
  queryBuilder: (params: TParams, helpers: QueryHelpers) => TQuery,
  params: TParams,
  options: ExecuteOptions = {},
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
> {
  type ReturnType =
    TQuery extends Queryable<infer T>
      ? T[]
      : TQuery extends OrderedQueryable<infer T>
        ? T[]
        : TQuery extends TerminalQuery<infer T>
          ? T
          : never;
  const { sql, params: sqlParams } = selectStatement(queryBuilder, params);

  // Call onSql callback if provided
  if (options.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  // Check if this is a terminal operation that returns a single value
  const parseResult = parseQuery(queryBuilder);
  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  const operationType = parseResult.operation.operationType;

  // Handle different terminal operations
  switch (operationType) {
    case "first":
    case "firstOrDefault":
    case "single":
    case "singleOrDefault":
    case "last":
    case "lastOrDefault": {
      // These return a single item
      const rows = await db.any(sql, sqlParams);
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
      const countResult = (await db.one(sql, sqlParams)) as { count: string };
      return parseInt(countResult.count, 10) as ReturnType;
    }

    case "sum":
    case "average":
    case "min":
    case "max": {
      // These return a single aggregate value - SQL is: SELECT SUM/AVG/MIN/MAX(column) FROM ...
      // The result is in the first column of the row
      const aggResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
      // pg-promise returns the aggregate with the function name as key
      const keys = Object.keys(aggResult);
      if (keys.length > 0 && keys[0]) {
        return aggResult[keys[0]] as ReturnType;
      }
      return null as ReturnType;
    }

    case "any": {
      // Returns boolean - SQL is: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
      const anyResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
      const anyKeys = Object.keys(anyResult);
      if (anyKeys.length > 0 && anyKeys[0]) {
        return (anyResult[anyKeys[0]] === 1) as ReturnType;
      }
      return false as ReturnType;
    }

    case "all": {
      // Returns boolean - SQL is: SELECT CASE WHEN NOT EXISTS(...) THEN 1 ELSE 0 END
      const allResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
      const allKeys = Object.keys(allResult);
      if (allKeys.length > 0 && allKeys[0]) {
        return (allResult[allKeys[0]] === 1) as ReturnType;
      }
      return false as ReturnType;
    }

    default:
      // Regular query that returns an array
      return (await db.any(sql, sqlParams)) as ReturnType;
  }
}

/**
 * Execute a query with no parameters
 * @param db pg-promise database instance
 * @param queryBuilder Function that builds the query using LINQ operations with helpers
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Promise with query results, properly typed based on the query
 */
export async function executeSelectSimple<
  TQuery extends Queryable<unknown> | OrderedQueryable<unknown> | TerminalQuery<unknown>,
>(
  db: PgDatabase,
  queryBuilder: (_params: Record<string, never>, helpers: QueryHelpers) => TQuery,
  options: ExecuteOptions = {},
): Promise<
  TQuery extends Queryable<infer T>
    ? T[]
    : TQuery extends OrderedQueryable<infer T>
      ? T[]
      : TQuery extends TerminalQuery<infer T>
        ? T
        : never
> {
  return executeSelect(db, queryBuilder, {}, options);
}

// ==================== INSERT Statement & Execution ====================

/**
 * Generate INSERT SQL statement
 */
export function insertStatement<TParams, TTable, TReturning = never>(
  queryBuilder: (
    params: TParams,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse INSERT query");
  }

  const mergedParams = { ...parseResult.autoParams, ...params };
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
 * Execute INSERT and return row count
 */
export async function executeInsert<TParams, TTable>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => Insertable<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

/**
 * Execute INSERT with RETURNING
 */
export async function executeInsert<TParams, TTable, TReturning>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;

// Implementation
export async function executeInsert<TParams, TTable, TReturning = never>(
  db: PgDatabase,
  queryBuilder: (
    params: TParams,
  ) => Insertable<TTable> | InsertableWithReturning<TTable, TReturning>,
  params: TParams,
  options: ExecuteOptions = {},
): Promise<number | TReturning[]> {
  const { sql, params: sqlParams } = insertStatement(queryBuilder, params);

  if (options.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const parseResult = parseQuery(queryBuilder);
  if (!parseResult) {
    throw new Error("Failed to parse INSERT query");
  }

  // Check if RETURNING clause is present
  const hasReturning =
    parseResult.operation.operationType === "insert" &&
    (parseResult.operation as { returning?: unknown }).returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
}

// ==================== UPDATE Statement & Execution ====================

/**
 * Generate UPDATE SQL statement
 */
export function updateStatement<TParams, TTable, TReturning = never>(
  queryBuilder: (
    params: TParams,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
): SqlResult<
  TParams & Record<string, string | number | boolean | null>,
  TReturning extends never ? void : TReturning
> {
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse UPDATE query");
  }

  const mergedParams = { ...parseResult.autoParams, ...params };
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
 * Execute UPDATE and return row count
 */
export async function executeUpdate<TParams, TTable>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => UpdatableWithSet<TTable> | UpdatableComplete<TTable>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<number>;

/**
 * Execute UPDATE with RETURNING
 */
export async function executeUpdate<TParams, TTable, TReturning>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options?: ExecuteOptions,
): Promise<TReturning[]>;

// Implementation
export async function executeUpdate<TParams, TTable, TReturning = never>(
  db: PgDatabase,
  queryBuilder: (
    params: TParams,
  ) =>
    | UpdatableWithSet<TTable>
    | UpdatableComplete<TTable>
    | UpdatableWithReturning<TTable, TReturning>,
  params: TParams,
  options: ExecuteOptions = {},
): Promise<number | TReturning[]> {
  const { sql, params: sqlParams } = updateStatement(queryBuilder, params);

  if (options.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const parseResult = parseQuery(queryBuilder);
  if (!parseResult) {
    throw new Error("Failed to parse UPDATE query");
  }

  // Check if RETURNING clause is present
  const hasReturning =
    parseResult.operation.operationType === "update" &&
    (parseResult.operation as { returning?: unknown }).returning;

  if (hasReturning) {
    return (await db.any(sql, sqlParams)) as TReturning[];
  } else {
    const result = await db.result(sql, sqlParams);
    return result.rowCount;
  }
}

// ==================== DELETE Statement & Execution ====================

/**
 * Generate DELETE SQL statement
 */
export function deleteStatement<TParams, TResult>(
  queryBuilder: (params: TParams) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>, void> {
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse DELETE query");
  }

  const mergedParams = { ...parseResult.autoParams, ...params };
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
 * Execute DELETE and return row count
 */
export async function executeDelete<TParams, TResult>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => Deletable<TResult> | DeletableComplete<TResult>,
  params: TParams,
  options: ExecuteOptions = {},
): Promise<number> {
  const { sql, params: sqlParams } = deleteStatement(queryBuilder, params);

  if (options.onSql) {
    options.onSql({ sql, params: sqlParams });
  }

  const result = await db.result(sql, sqlParams);
  return result.rowCount;
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
