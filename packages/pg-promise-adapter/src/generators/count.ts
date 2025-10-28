/**
 * COUNT aggregate generator
 */

import type { CountOperation } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";

/**
 * Generate COUNT aggregate
 */
export function generateCount(_operation: CountOperation, _context: SqlContext): string {
  // Always return just COUNT(*) - predicates are handled separately in WHERE clause
  return "COUNT(*)";
}
