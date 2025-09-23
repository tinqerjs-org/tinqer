/**
 * SQLite SQL generator for Tinqer using better-sqlite3 format
 */

import { parseQuery, type Queryable, type TerminalQuery } from "@webpods/tinqer";
import { generateSql } from "./sql-generator.js";
import type { SqlResult } from "./types.js";

/**
 * Generate SQL from a query builder function
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param params Parameters to pass to the query builder
 * @returns SQL string and merged params (user params + auto-extracted params)
 */
export function query<TParams, TResult>(
  queryBuilder: (params: TParams) => Queryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
): SqlResult<TParams & Record<string, string | number | boolean | null>> {
  // Parse the query to get the operation tree and auto-params
  const parseResult = parseQuery(queryBuilder);

  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  // Merge user params with auto-extracted params
  const mergedParams = { ...params, ...parseResult.autoParams };

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

  // Return SQL with processed params (better-sqlite3 will handle parameter substitution)
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
export function toSql<T>(queryable: Queryable<T> | TerminalQuery<T>): {
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
 * Database interface for better-sqlite3 compatibility
 */
interface SqliteDatabase {
  prepare(sql: string): {
    all(params?: any): any[];
    get(params?: any): any;
    run(params?: any): { changes: number; lastInsertRowid: number | bigint };
  };
}

/**
 * Execute a query and return typed results
 * @param db better-sqlite3 database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param params Parameters to pass to the query builder
 * @returns Query results, properly typed based on the query
 */
export function execute<TParams, TQuery extends Queryable<any> | TerminalQuery<any>>(
  db: SqliteDatabase,
  queryBuilder: (params: TParams) => TQuery,
  params: TParams,
): TQuery extends Queryable<infer T> ? T[] : TQuery extends TerminalQuery<infer T> ? T : never {
  const { sql, params: sqlParams } = query(queryBuilder, params);

  // Check if this is a terminal operation that returns a single value
  const parseResult = parseQuery(queryBuilder);
  if (!parseResult) {
    throw new Error("Failed to parse query");
  }

  const operationType = parseResult.operation.operationType;

  // Prepare the statement
  const stmt = db.prepare(sql);

  // Handle different terminal operations
  switch (operationType) {
    case "first":
    case "firstOrDefault":
    case "single":
    case "singleOrDefault":
    case "last":
    case "lastOrDefault":
      // These return a single item
      const rows = stmt.all(sqlParams);
      if (rows.length === 0) {
        if (operationType.includes("OrDefault")) {
          return null as any; // Return null for OrDefault operations
        }
        throw new Error(`No elements found for ${operationType} operation`);
      }
      if (operationType.startsWith("single") && rows.length > 1) {
        throw new Error(`Multiple elements found for ${operationType} operation`);
      }
      return rows[0] as any; // Return single item

    case "count":
    case "longCount":
      // These return a number - SQL is: SELECT COUNT(*) FROM ...
      const countResult = stmt.get(sqlParams) as { count: number };
      return countResult.count as any;

    case "sum":
    case "average":
    case "min":
    case "max":
      // These return a single aggregate value - SQL is: SELECT SUM/AVG/MIN/MAX(column) FROM ...
      // The result is in the first column of the row
      const aggResult = stmt.get(sqlParams);
      // better-sqlite3 returns the aggregate with the function name as key
      const keys = Object.keys(aggResult);
      if (keys.length > 0 && keys[0]) {
        return aggResult[keys[0]] as any;
      }
      return null as any;

    case "any":
      // Returns boolean - SQL is: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
      const anyResult = stmt.get(sqlParams);
      const anyKeys = Object.keys(anyResult);
      if (anyKeys.length > 0 && anyKeys[0]) {
        return (anyResult[anyKeys[0]] === 1) as any;
      }
      return false as any;

    case "all":
      // Returns boolean - SQL is: SELECT CASE WHEN NOT EXISTS(...) THEN 1 ELSE 0 END
      const allResult = stmt.get(sqlParams);
      const allKeys = Object.keys(allResult);
      if (allKeys.length > 0 && allKeys[0]) {
        return (allResult[allKeys[0]] === 1) as any;
      }
      return false as any;

    case "toArray":
    case "toList":
    default:
      // Regular query that returns an array
      return stmt.all(sqlParams) as any;
  }
}

/**
 * Execute a query with no parameters
 * @param db better-sqlite3 database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @returns Query results, properly typed based on the query
 */
export function executeSimple<TQuery extends Queryable<any> | TerminalQuery<any>>(
  db: SqliteDatabase,
  queryBuilder: () => TQuery,
): TQuery extends Queryable<infer T> ? T[] : TQuery extends TerminalQuery<infer T> ? T : never {
  return execute(db, queryBuilder, {});
}

// Export types
export type { SqlResult } from "./types.js";
