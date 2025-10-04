/**
 * MIN aggregate generator
 */

import type { MinOperation } from "@webpods/tinqer";
import type { SqlContext } from "../types.js";
import { generateExpression } from "../expression-generator.js";

/**
 * Generate MIN aggregate
 */
export function generateMin(operation: MinOperation, context: SqlContext): string {
  if (operation.selectorExpression) {
    const expr = generateExpression(operation.selectorExpression, context);
    return `MIN(${expr})`;
  }
  return "MIN(*)";
}
