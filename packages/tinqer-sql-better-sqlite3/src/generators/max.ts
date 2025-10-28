/**
 * MAX aggregate generator
 */

import type { MaxOperation } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate MAX aggregate
 */
export function generateMax(operation: MaxOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    const expr = generateExpression(operation.selectorExpression, context);
    return `MAX(${expr})`;
  }
  return "MAX(*)";
}
