/**
 * JOIN operation generator
 */

import type { JoinOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate JOIN clause
 */
export function generateJoin(operation: JoinOperation, context: SqlContext): string {
  // Generate SQL for the inner query
  const innerSql = generateSql(operation.inner, {});

  // Get table aliases
  const outerAlias = context.tableAliases.values().next().value || "t0";
  const innerAlias = `t${context.aliasCounter++}`;

  // Build JOIN clause
  const joinClause = `INNER JOIN (${innerSql}) AS ${innerAlias}`;

  // Build ON clause
  const onClause = `ON ${outerAlias}.${operation.outerKey} = ${innerAlias}.${operation.innerKey}`;

  return `${joinClause} ${onClause}`;
}
