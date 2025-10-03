/**
 * Visitor for INSERT .values() operation
 */

import type { InsertOperation } from "../../query-tree/operations.js";
import type { ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
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
  // .values(() => ({ column1: value1, column2: value2 }))
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const lambda = args[0];
  if (!lambda || lambda.type !== "ArrowFunctionExpression") {
    throw new Error("values() requires a lambda expression");
  }

  const arrowFn = lambda as ArrowFunctionExpression;
  let bodyExpr = arrowFn.body;

  // Handle block statement with return
  if (bodyExpr.type === "BlockStatement") {
    const returnStmt = bodyExpr.body?.find((stmt) => stmt.type === "ReturnStatement");
    if (!returnStmt || !returnStmt.argument) {
      throw new Error("values() lambda must return an object");
    }
    bodyExpr = returnStmt.argument;
  }

  // Handle parenthesized expression (common pattern: () => ({ ... }))
  if (bodyExpr.type === "ParenthesizedExpression") {
    bodyExpr = (bodyExpr as { expression: typeof bodyExpr }).expression;
  }

  // Must be an object expression
  if (bodyExpr.type !== "ObjectExpression") {
    throw new Error("values() must return an object literal");
  }

  // Visit the object expression to get column-value mappings
  const valuesExpr = visitExpression(bodyExpr as ASTObjectExpression, visitorContext);
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
