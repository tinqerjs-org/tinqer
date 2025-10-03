/**
 * Visitor for UPDATE .returning() operation
 */

import type { UpdateOperation } from "../../query-tree/operations.js";
import type {
  ValueExpression,
  ObjectExpression,
  AllColumnsExpression,
} from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
} from "../../parser/ast-types.js";
import type { VisitorContext } from "../types.js";
import { visitExpression } from "../index.js";

export interface ReturningUpdateVisitorResult {
  operation: UpdateOperation;
  autoParams: Record<string, unknown>;
}

/**
 * Visit a .returning() operation on an UPDATE
 */
export function visitReturningUpdateOperation(
  ast: ASTCallExpression,
  source: UpdateOperation,
  visitorContext: VisitorContext,
): ReturningUpdateVisitorResult | null {
  // .returning((row) => row.id) or .returning((row) => ({ id: row.id, name: row.name }))
  const args = ast.arguments;
  if (!args || args.length === 0) {
    return null;
  }

  const lambda = args[0];
  if (!lambda || lambda.type !== "ArrowFunctionExpression") {
    throw new Error("returning() requires a lambda expression");
  }

  const arrowFn = lambda as ArrowFunctionExpression;

  // Extract parameter name (e.g., "row")
  const params = arrowFn.params;
  if (!params || params.length === 0 || params[0]?.type !== "Identifier") {
    throw new Error("returning() lambda must have a parameter");
  }

  const paramName = params[0].name;

  // Add to table params temporarily for expression resolution
  const originalTableParams = new Set(visitorContext.tableParams);
  visitorContext.tableParams.add(paramName);

  let bodyExpr = arrowFn.body;

  // Handle block statement with return
  if (bodyExpr.type === "BlockStatement") {
    const returnStmt = bodyExpr.body?.find((stmt) => stmt.type === "ReturnStatement");
    if (!returnStmt || !returnStmt.argument) {
      throw new Error("returning() lambda must return a value");
    }
    bodyExpr = returnStmt.argument;
  }

  // Check for identity returning (returning((u) => u))
  let returningExpr: ValueExpression | ObjectExpression;
  if (bodyExpr.type === "Identifier" && (bodyExpr as { name: string }).name === paramName) {
    // Return AllColumnsExpression to indicate "RETURNING *"
    const allColumns: AllColumnsExpression = { type: "allColumns" };
    returningExpr = allColumns as ValueExpression;
  } else {
    // Convert the returning expression normally
    returningExpr = visitExpression(bodyExpr, visitorContext) as ValueExpression | ObjectExpression;
  }

  // Restore table params
  visitorContext.tableParams = originalTableParams;

  // Create updated UPDATE operation with returning clause
  const updatedOperation: UpdateOperation = {
    ...source,
    returning: returningExpr,
  };

  return {
    operation: updatedOperation,
    autoParams: {},
  };
}
