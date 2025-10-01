/**
 * Better SQLite3 SQL generator for Tinqer
 */

import {
  parseQuery,
  type Queryable,
  type OrderedQueryable,
  type TerminalQuery,
  type QueryHelpers,
} from "@webpods/tinqer";
import { generateSql } from "./sql-generator.js";
import type { SqlResult, ExecuteOptions } from "./types.js";

/**
 * Generate SQL from a query builder function
 * @param queryBuilder Function that builds the query using LINQ operations, optionally with helpers
 * @param params Parameters to pass to the query builder
 * @returns SQL string and merged params (user params + auto-extracted params)
 */
export function query<TParams, TResult>(
  queryBuilder:
    | ((params: TParams) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>)
    | ((
        params: TParams,
        helpers: QueryHelpers,
      ) => Queryable<TResult> | OrderedQueryable<TResult> | TerminalQuery<TResult>),
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>> {
  // Parse the query to get the operation tree and auto-params
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Merge user params with auto-extracted params
  // User params take priority over auto-params to avoid collisions
  const mergedParams = { ...parseResult.autoParams, ...params };

  // Process array indexing in parameters
  // Look for parameters like "roles[0]" and resolve them
  const processedParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(mergedParams)) {
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
      const arrayName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      if (arrayName in mergedParams) {
        const arrayValue = mergedParams[arrayName];
        if (Array.isArray(arrayValue) && index < arrayValue.length) {
          processedParams[key] = arrayValue[index];
        }
      }
    } else {
      processedParams[key] = value;
    }
  }

  // Generate SQL from the operation tree
  const sql = generateSql(parseResult.operation, mergedParams);

  // Return SQL with processed params (Better SQLite3 will handle parameter substitution)
  // Include both processed and original params
  const finalParams = { ...mergedParams, ...processedParams } as TParams &
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
 * Database interface for Better SQLite3 compatibility
 */
interface BetterSqlite3Database {
  prepare(sql: string): {
    all(params?: Record<string, unknown>): unknown[];
    get(params?: Record<string, unknown>): unknown;
  };
}

/**
 * Execute a query and return typed results
 * @param db Better SQLite3 database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param params Parameters to pass to the query builder
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Query results, properly typed based on the query
 */
export function execute<
  TParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: BetterSqlite3Database,
  queryBuilder: (params: TParams) => TQuery,
  params: TParams,
  options: ExecuteOptions = {},
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
  const { sql, params: sqlParams } = query(queryBuilder, params);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return null as any; // Return null for OrDefault operations
        }
        throw new Error(`No elements found for ${operationType} operation`);
      }
      if (operationType.startsWith("single") && rows.length > 1) {
        throw new Error(`Multiple elements found for ${operationType} operation`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rows[0] as any; // Return single item
    }

    case "count":
    case "longCount": {
      // These return a number - SQL is: SELECT COUNT(*) FROM ...
      // SQLite returns the result with column name "COUNT(*)", so get the first column value
      const countResult = stmt.get(convertedParams) as Record<string, unknown>;
      const keys = Object.keys(countResult);
      if (keys.length > 0 && keys[0]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return countResult[keys[0]] as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return 0 as any;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return aggResult[keys[0]] as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return null as any;
    }

    case "any": {
      // Returns boolean - SQL is: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
      const anyResult = stmt.get(convertedParams) as Record<string, unknown>;
      const anyKeys = Object.keys(anyResult);
      if (anyKeys.length > 0 && anyKeys[0]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (anyResult[anyKeys[0]] === 1) as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return false as any;
    }

    case "all": {
      // Returns boolean - SQL is: SELECT CASE WHEN NOT EXISTS(...) THEN 1 ELSE 0 END
      const allResult = stmt.get(convertedParams) as Record<string, unknown>;
      const allKeys = Object.keys(allResult);
      if (allKeys.length > 0 && allKeys[0]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (allResult[allKeys[0]] === 1) as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return false as any;
    }

    case "toArray":
    case "toList":
    default:
      // Regular query that returns an array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return stmt.all(convertedParams) as any;
  }
}

/**
 * Execute a query with no parameters
 * @param db Better SQLite3 database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Query results, properly typed based on the query
 */
export function executeSimple<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: BetterSqlite3Database,
  queryBuilder: () => TQuery,
  options: ExecuteOptions = {},
): TQuery extends Queryable<infer T>
  ? T[]
  : TQuery extends OrderedQueryable<infer T>
    ? T[]
    : TQuery extends TerminalQuery<infer T>
      ? T
      : never {
  return execute(db, queryBuilder, {}, options);
}

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
