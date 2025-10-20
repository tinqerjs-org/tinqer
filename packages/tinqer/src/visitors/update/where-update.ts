/**
 * Visitor for UPDATE .where() operation
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type { BooleanExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";

export interface WhereUpdateVisitorResult {
  operation: UpdateOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .where() operation on an UPDATE
 */
export function visitWhereUpdateOperation(
  ast: ASTCallExpression,
  source: UpdateOperation,
  visitorContext: VisitorContext,
): WhereUpdateVisitorResult | null {
  // .where((row) => row.id === params.id)
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const lambda = args[0];
  if (!lambda || lambda.type !== "ArrowFunctionExpression") {
    throw new Error("where() requires a lambda expression");
  }

  const arrowFn = lambda as ArrowFunctionExpression;

  // Extract parameter name (e.g., "row")
  const params = arrowFn.params;
  if (!params || params.length === 0 || params[0]?.type !== "Identifier") {
    throw new Error("where() lambda must have a parameter");
  }

  const paramName = params[0].name;

  // Add to table params temporarily for expression resolution
  const originalTableParams = new Set(visitorContext.tableParams);
  visitorContext.tableParams.add(paramName);

  // Check for second parameter (external params)
  if (params.length > 1 && params[1]?.type === "Identifier") {
    const externalParamName = params[1].name;
    visitorContext.queryParams.add(externalParamName);
  }

  let bodyExpr = arrowFn.body;

  // Handle block statement with return
  if (bodyExpr.type === "BlockStatement") {
    const returnStmt = bodyExpr.body?.find((stmt) => stmt.type === "ReturnStatement");
    if (!returnStmt || !returnStmt.argument) {
      throw new Error("where() lambda must return a boolean expression");
    }
    bodyExpr = returnStmt.argument;
  }

  // Convert the where expression
  const whereExpr = visitExpression(bodyExpr, visitorContext);

  // Restore table params
  visitorContext.tableParams = originalTableParams;

  if (!whereExpr) {
    return null;
  }

  // Create updated UPDATE operation with where clause
  const updatedOperation: UpdateOperation = {
    ...source,
    predicate: whereExpr as BooleanExpression,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
