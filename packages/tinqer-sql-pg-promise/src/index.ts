/**
 * PostgreSQL SQL generator for Tinqer using pg-promise format
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
export function selectStatement<TParams, TResult>(
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

  // Return SQL with processed params (pg-promise will handle parameter substitution)
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
 * Database interface for pg-promise compatibility
 */
interface PgDatabase {
  any(sql: string, params?: unknown): Promise<unknown[]>;
  one(sql: string, params?: unknown): Promise<unknown>;
}

/**
 * Execute a query and return typed results
 * @param db pg-promise database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param params Parameters to pass to the query builder
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Promise with query results, properly typed based on the query
 */
export async function executeSelect<
  TParams,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: PgDatabase,
  queryBuilder: (params: TParams) => TQuery,
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
      const countResult = (await db.one(sql, sqlParams)) as { count: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return parseInt(countResult.count, 10) as any;
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return aggResult[keys[0]] as any;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return null as any;
    }

    case "any": {
      // Returns boolean - SQL is: SELECT CASE WHEN EXISTS(...) THEN 1 ELSE 0 END
      const anyResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
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
      const allResult = (await db.one(sql, sqlParams)) as Record<string, unknown>;
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
      return (await db.any(sql, sqlParams)) as any;
  }
}

/**
 * Execute a query with no parameters
 * @param db pg-promise database instance
 * @param queryBuilder Function that builds the query using LINQ operations
 * @param options Optional execution options (e.g., SQL inspection callback)
 * @returns Promise with query results, properly typed based on the query
 */
export async function executeSelectSimple<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TQuery extends Queryable<any> | OrderedQueryable<any> | TerminalQuery<any>,
>(
  db: PgDatabase,
  queryBuilder: () => TQuery,
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

// Export types
export type { SqlResult, ExecuteOptions } from "./types.js";
