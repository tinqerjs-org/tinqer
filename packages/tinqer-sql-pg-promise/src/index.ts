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

// Export types
export type { SqlResult } from "./types.js";
