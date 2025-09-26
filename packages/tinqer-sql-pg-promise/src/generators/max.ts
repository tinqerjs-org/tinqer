/**
 * MAX aggregate generator
 */

import type { MaxOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate MAX aggregate
 */
export function generateMax(operation: MaxOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    // Use the full expression for complex selectors like arithmetic
    const expr = generateExpression(operation.selectorExpression, context);
    return `MAX(${expr})`;
  } else if (operation.selector) {
    // Fallback to simple column selector
    return `MAX("${operation.selector}")`;
  }
  return "MAX(*)";
}
