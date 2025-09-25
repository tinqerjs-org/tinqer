/**
 * WHERE operation visitor
 * Orchestrates predicate parsing for WHERE clauses
 */

import type { WhereOperation, QueryOperation } from "../../query-tree/operations.js";
import type { BooleanExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
  Identifier,
} from "../../parser/ast-types.js";

import type { VisitorContext } from "../types.js";
import { visitPredicate } from "./predicate.js";
import { createWhereContext } from "./context.js";

/**
 * Visit WHERE operation
 * Produces WhereOperation with BooleanExpression predicate
 */
export function visitWhereOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  visitorContext: VisitorContext,
): { operation: WhereOperation; autoParams: Record<string, unknown> } | null {
  // WHERE expects a lambda: where(x => x.age > 18)
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const lambdaArg = ast.arguments[0];
  if (!lambdaArg || lambdaArg.type !== "ArrowFunctionExpression") {
    return null;
  }

  const lambda = lambdaArg as ArrowFunctionExpression;

  // Create WHERE-specific context that wraps the shared visitor context
  const context = createWhereContext(
    visitorContext.tableParams,
    visitorContext.queryParams,
    visitorContext.autoParamCounter,
  );

  // Important: Replace the context's autoParams and autoParamInfos with the shared ones
  context.autoParams = visitorContext.autoParams;
  context.autoParamInfos = visitorContext.autoParamInfos;

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const firstParam = lambda.params[0];
    if (firstParam && firstParam.type === "Identifier") {
      const paramName = (firstParam as Identifier).name;
      context.tableParams.add(paramName);
    }
  }

  // Set current table if available
  context.currentTable = visitorContext.currentTable;

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

  // Visit predicate expression
  const predicateResult = visitPredicate(bodyExpr, context);

  if (!predicateResult.value) {
    return null;
  }

  // Update the global counter with the final value from this visitor
  visitorContext.autoParamCounter = predicateResult.counter;

  return {
    operation: {
      type: "queryOperation",
      operationType: "where",
      source,
      predicate: predicateResult.value as BooleanExpression,
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}
