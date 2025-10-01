/**
 * FROM clause generator
 */

import type { FromOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";

/**
 * Generate FROM clause
 */
export function generateFrom(operation: FromOperation, context: SqlContext): string {
  const table = operation.schema
    ? `"${operation.schema}"."${operation.table}"`
    : `"${operation.table}"`;

  // For single-table queries (no JOINs), don't use aliases
  // The presence of JOINs will be indicated by the hasJoins flag in context
  if (context.hasJoins) {
    // Generate a table alias if not already present
    if (!context.tableAliases.has(operation.table)) {
      const alias = `t${context.aliasCounter++}`;
      context.tableAliases.set(operation.table, alias);
    }

    const alias = context.tableAliases.get(operation.table);
    return `FROM ${table} AS "${alias}"`;
  } else {
    // Single table - no alias needed
    return `FROM ${table}`;
  }
}
