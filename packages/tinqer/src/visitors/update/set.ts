/**
 * Visitor for UPDATE .set() operation
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type { ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
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

  // .set({ column1: value1, column2: value2 })
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
    throw new Error("set() must be an object literal");
  }

  // Visit the object expression to get column-value assignments
  const assignmentsExpr = visitExpression(firstArg as ASTObjectExpression, visitorContext);
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
