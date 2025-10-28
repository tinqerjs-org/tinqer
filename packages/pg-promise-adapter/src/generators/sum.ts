/**
 * SUM aggregate generator
 */

import type { SumOperation } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate SUM aggregate
 */
export function generateSum(operation: SumOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    const expr = generateExpression(operation.selectorExpression, context);
    return `SUM(${expr})`;
  }
  return "SUM(*)";
}
