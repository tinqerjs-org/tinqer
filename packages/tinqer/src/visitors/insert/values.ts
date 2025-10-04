/**
 * Visitor for INSERT .values() operation
 */

import type { InsertOperation } from "../../query-tree/operations.js";
import type { ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ObjectExpression as ASTObjectExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";

export interface ValuesVisitorResult {
  operation: InsertOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .values() operation on an INSERT
 */
export function visitValuesOperation(
  ast: ASTCallExpression,
  source: InsertOperation,
  visitorContext: VisitorContext,
): ValuesVisitorResult | null {
  // .values({ column1: value1, column2: value2 })
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const firstArg = args[0];
  if (!firstArg) {
    return null;
  }

  // Must be an object expression
  if (firstArg.type !== "ObjectExpression") {
    throw new Error("values() must be an object literal");
  }

  // Visit the object expression to get column-value mappings
  const valuesExpr = visitExpression(firstArg as ASTObjectExpression, visitorContext);
  if (!valuesExpr || valuesExpr.type !== "object") {
    return null;
  }

  // Create updated INSERT operation with values
  const updatedOperation: InsertOperation = {
    ...source,
    values: valuesExpr as ObjectExpression,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
