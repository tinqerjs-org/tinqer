/**
 * SINGLE operation generator
 */

import type { SingleOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateBooleanExpression } from "../expression-generator.js";

/**
 * Generate SQL for SINGLE operation
 * In PostgreSQL, we use LIMIT 2 and check for exactly 1 result in the client
 */
export function generateSingle(operation: SingleOperation, context: SqlContext): string {
  if (operation.predicate) {
    // SINGLE with WHERE condition
    const predicate = generateBooleanExpression(operation.predicate, context);
    return `WHERE ${predicate} LIMIT 2`;
  } else {
    // Simple SINGLE - LIMIT 2 to check for multiple results
    return "LIMIT 2";
  }
}