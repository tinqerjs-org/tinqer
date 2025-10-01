/**
 * SUM aggregate generator
 */

import type { SumOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate SUM aggregate
 */
export function generateSum(operation: SumOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    // Use the full expression for complex selectors like arithmetic
    const expr = generateExpression(operation.selectorExpression, context);
    return `SUM(${expr})`;
  } else if (operation.selector) {
    // Fallback to simple column selector
    return `SUM("${operation.selector}")`;
  }
  return "SUM(*)";
}
