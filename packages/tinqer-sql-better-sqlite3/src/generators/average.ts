/**
 * AVG aggregate generator
 */

import type { AverageOperation } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate AVG aggregate
 */
export function generateAverage(operation: AverageOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    const expr = generateExpression(operation.selectorExpression, context);
    return `AVG(${expr})`;
  }
  return "AVG(*)";
}
