/**
 * FIRST operation generator
 */

import type { FirstOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateBooleanExpression } from "../expression-generator.js";

/**
 * Generate SQL for FIRST operation
 * In PostgreSQL, this is SELECT with LIMIT 1
 */
export function generateFirst(operation: FirstOperation, context: SqlContext): string {
  if (operation.predicate) {
    // FIRST with WHERE condition
    const predicate = generateBooleanExpression(operation.predicate, context);
    return `WHERE ${predicate} LIMIT 1`;
  } else {
    // Simple FIRST - just LIMIT 1
    return "LIMIT 1";
  }
}