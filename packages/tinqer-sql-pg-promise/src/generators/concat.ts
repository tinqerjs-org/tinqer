/**
 * CONCAT operation generator (UNION ALL)
 */

import type { ConcatOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate UNION ALL clause (keeps duplicates)
 */
export function generateConcat(operation: ConcatOperation, _context: SqlContext): string {
  // Generate SQL for both queries
  const firstSql = generateSql(operation.source, {});
  const secondSql = generateSql(operation.second, {});

  // Combine with UNION ALL
  return `(${firstSql}) UNION ALL (${secondSql})`;
}
