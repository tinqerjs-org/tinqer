/**
 * PostgreSQL SQL generator for Tinqer using pg-promise format
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

  // Generate SQL from the operation tree
  const sql = generateSql(parseResult.operation, mergedParams);

  // Return SQL with merged params (pg-promise will handle parameter substitution)
  return { sql, params: mergedParams };
}

// Export types
export type { SqlResult } from "./types.js";
