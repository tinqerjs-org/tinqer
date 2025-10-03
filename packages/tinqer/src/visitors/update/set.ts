/**
 * Visitor for UPDATE .set() operation
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type { ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  ObjectExpression as ASTObjectExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";

export interface SetVisitorResult {
  operation: UpdateOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .set() operation on an UPDATE
 */
export function visitSetOperation(
  ast: ASTCallExpression,
  source: UpdateOperation,
  visitorContext: VisitorContext,
): SetVisitorResult | null {
  // Check if .set() has already been called (assignments should be empty object initially)
  if (
    source.assignments.type === "object" &&
    Object.keys(source.assignments.properties).length > 0
  ) {
    throw new Error("set() can only be called once per UPDATE query");
  }

  // .set(() => ({ column1: value1, column2: value2 }))
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const lambda = args[0];
  if (!lambda || lambda.type !== "ArrowFunctionExpression") {
    throw new Error("set() requires a lambda expression");
  }

  const arrowFn = lambda as ArrowFunctionExpression;
  let bodyExpr = arrowFn.body;

  // Handle block statement with return
  if (bodyExpr.type === "BlockStatement") {
    const returnStmt = bodyExpr.body?.find((stmt) => stmt.type === "ReturnStatement");
    if (!returnStmt || !returnStmt.argument) {
      throw new Error("set() lambda must return an object");
    }
    bodyExpr = returnStmt.argument;
  }

  // Handle parenthesized expression (common pattern: () => ({ ... }))
  if (bodyExpr.type === "ParenthesizedExpression") {
    bodyExpr = (bodyExpr as { expression: typeof bodyExpr }).expression;
  }

  // Must be an object expression
  if (bodyExpr.type !== "ObjectExpression") {
    throw new Error("set() must return an object literal");
  }

  // Visit the object expression to get column-value assignments
  const assignmentsExpr = visitExpression(bodyExpr as ASTObjectExpression, visitorContext);
  if (!assignmentsExpr || assignmentsExpr.type !== "object") {
    return null;
  }

  // Validate that assignments object is not empty
  if (Object.keys(assignmentsExpr.properties).length === 0) {
    throw new Error("set() must specify at least one column assignment");
  }

  // Create updated UPDATE operation with assignments
  const updatedOperation: UpdateOperation = {
    ...source,
    assignments: assignmentsExpr as ObjectExpression,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
