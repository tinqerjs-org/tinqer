/**
 * FROM clause generator
 */

import type { FromOperation } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate FROM clause
 */
export function generateFrom(operation: FromOperation, context: SqlContext): string {
  // Handle subquery (derived table)
  if (operation.subquery) {
    // Generate SQL for the subquery (this creates a fresh context internally)
    const innerSql = generateSql(operation.subquery, context.params);

    // Use aliasHint if available, otherwise generate a unique alias
    const alias = operation.aliasHint || `t${context.aliasCounter++}`;

    // Store the alias for potential use by outer expressions
    if (operation.aliasHint) {
      context.tableAliases.set(operation.aliasHint, alias);
    }

    return `FROM (${innerSql}) AS "${alias}"`;
  }

  // Regular table reference
  const table = operation.schema
    ? `"${operation.schema}"."${operation.table}"`
    : `"${operation.table}"`;

  // For single-table queries (no JOINs), don't use aliases
  // The presence of JOINs will be indicated by the hasJoins flag in context
  if (context.hasJoins) {
    // Generate a table alias if not already present
    if (!context.tableAliases.has(operation.table!)) {
      const alias = `t${context.aliasCounter++}`;
      context.tableAliases.set(operation.table!, alias);
    }

    const alias = context.tableAliases.get(operation.table!);
    return `FROM ${table} AS "${alias}"`;
  } else {
    // Single table - no alias needed
    return `FROM ${table}`;
  }
}
