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
 * @returns SQL string and the original params
 */
export function query<TParams, TResult>(
  queryBuilder: (params: TParams) => Queryable<TResult> | TerminalQuery<TResult>,
  params: TParams,
): SqlResult<TParams> {
  // Parse the query to get the operation tree
  const operation = parseQuery(queryBuilder);

  if (!operation) {
    throw new Error("Failed to parse query");
  }

  // Generate SQL from the operation tree
  const sql = generateSql(operation, params);

  // Return SQL with original params (pg-promise will handle parameter substitution)
  return { sql, params };
}

// Export types
export type { SqlResult } from "./types.js";
