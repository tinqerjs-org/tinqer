/**
 * UNION operation generator
 */

import type { UnionOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate UNION clause
 */
export function generateUnion(operation: UnionOperation, _context: SqlContext): string {
  // Generate SQL for both queries
  const firstSql = generateSql(operation.source, {});
  const secondSql = generateSql(operation.second, {});

  // Combine with UNION
  return `(${firstSql}) UNION (${secondSql})`;
}