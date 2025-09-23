/**
 * EXCEPT operation generator
 */

import type { ExceptOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateSql } from "../sql-generator.js";

/**
 * Generate EXCEPT clause
 */
export function generateExcept(operation: ExceptOperation, _context: SqlContext): string {
  // Generate SQL for both queries
  const firstSql = generateSql(operation.source, {});
  const secondSql = generateSql(operation.second, {});

  // Combine with EXCEPT
  return `(${firstSql}) EXCEPT (${secondSql})`;
}
