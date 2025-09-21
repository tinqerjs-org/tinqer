/**
 * LAST operation generator
 */

import type { LastOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateBooleanExpression } from "../expression-generator.js";

/**
 * Generate SQL for LAST operation
 * In PostgreSQL, this requires ORDER BY DESC with LIMIT 1
 * Note: The orchestrator should handle reversing the ORDER BY
 */
export function generateLast(operation: LastOperation, context: SqlContext): string {
  if (operation.predicate) {
    // LAST with WHERE condition
    const predicate = generateBooleanExpression(operation.predicate, context);
    return `WHERE ${predicate} ORDER BY 1 DESC LIMIT 1`;
  } else {
    // Simple LAST - need to reverse order
    return "ORDER BY 1 DESC LIMIT 1";
  }
}