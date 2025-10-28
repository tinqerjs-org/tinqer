/**
 * TAKE (LIMIT) clause generator
 */

import type { TakeOperation, ValueExpression } from "@tinqerjs/tinqer";
import type { SqlContext } from "../types.js";
import { generateValueExpression } from "../expression-generator.js";

/**
 * Generate LIMIT clause
 */
export function generateTake(operation: TakeOperation, context: SqlContext): string {
  if (typeof operation.count === "number") {
    return `LIMIT ${operation.count}`;
  } else {
    // Handle as expression (ParamRef, ArithmeticExpression, etc.)
    const expr = generateValueExpression(operation.count as ValueExpression, context);
    return `LIMIT ${expr}`;
  }
}
