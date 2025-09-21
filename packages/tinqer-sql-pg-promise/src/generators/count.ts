/**
 * COUNT aggregate generator
 */

import type { CountOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateBooleanExpression } from "../expression-generator.js";

/**
 * Generate COUNT aggregate
 */
export function generateCount(operation: CountOperation, context: SqlContext): string {
  if (operation.predicate) {
    // COUNT with WHERE condition
    const predicate = generateBooleanExpression(operation.predicate, context);
    return `COUNT(*) WHERE ${predicate}`;
  } else {
    // Simple COUNT(*)
    return "COUNT(*)";
  }
}