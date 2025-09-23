/**
 * INTERSECT operation generator
 */

import type { IntersectOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate INTERSECT clause
 */
export function generateIntersect(operation: IntersectOperation, _context: SqlContext): string {
  // Generate SQL for both queries
  const firstSql = generateSql(operation.source, {});
  const secondSql = generateSql(operation.second, {});

  // Combine with INTERSECT
  return `(${firstSql}) INTERSECT (${secondSql})`;
}
