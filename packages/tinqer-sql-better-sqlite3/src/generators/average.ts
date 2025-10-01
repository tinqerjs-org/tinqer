/**
 * AVG aggregate generator
 */

import type { AverageOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate AVG aggregate
 */
export function generateAverage(operation: AverageOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    // Use the full expression for complex selectors like arithmetic
    const expr = generateExpression(operation.selectorExpression, context);
    return `AVG(${expr})`;
  } else if (operation.selector) {
    // Fallback to simple column selector
    return `AVG("${operation.selector}")`;
  }
  return "AVG(*)";
}
