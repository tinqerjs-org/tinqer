/**
 * SELECT operation visitor
 * Orchestrates projection parsing for SELECT clauses
 */

import type { SelectOperation, QueryOperation } from "../../query-tree/operations.js";
import type { ValueExpression, ObjectExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
  Identifier,
} from "../../parser/ast-types.js";

import { visitProjection } from "./projection.js";
import { createSelectContext } from "./context.js";
import { VisitorContext } from "../types.js";

/**
 * Visit SELECT operation
 * Produces SelectOperation with projection expression
 */
export function visitSelectOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  visitorContext: VisitorContext,
): { operation: SelectOperation; autoParams: Record<string, unknown> } | null {
  // SELECT expects a lambda: select(x => x.name) or select(x => ({ id: x.id, name: x.name }))
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const lambdaArg = ast.arguments[0];
  if (!lambdaArg || lambdaArg.type !== "ArrowFunctionExpression") {
    return null;
  }

  const lambda = lambdaArg as ArrowFunctionExpression;

  // Create SELECT-specific context with current param counter
  const context = createSelectContext(
    visitorContext.tableParams,
    visitorContext.queryParams,
    visitorContext.autoParamCounter,
  );
  context.inProjection = true;

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const firstParam = lambda.params[0];
    if (firstParam && firstParam.type === "Identifier") {
      const paramName = (firstParam as Identifier).name;
      context.tableParams.add(paramName);
      context.hasTableParam = true;
    } else {
      context.hasTableParam = false;
    }
  } else {
    context.hasTableParam = false;
  }

  // Extract body expression
  let bodyExpr: ASTExpression | null = null;
  if (lambda.body.type === "BlockStatement") {
    // Look for return statement
    const returnStmt = lambda.body.body.find(
      (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement",
    );
    if (returnStmt) {
      bodyExpr = (returnStmt as { argument?: ASTExpression }).argument || null;
    }
  } else {
    bodyExpr = lambda.body;
  }

  if (!bodyExpr) {
    return null;
  }

  // Visit projection expression
  const selector = visitProjection(bodyExpr, context);

  if (!selector) {
    return null;
  }

  // Update the global counter with the final value from this visitor
  visitorContext.autoParamCounter = context.autoParamCounter;

  return {
    operation: {
      type: "queryOperation",
      operationType: "select",
      source,
      selector: selector as ValueExpression | ObjectExpression,
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}
