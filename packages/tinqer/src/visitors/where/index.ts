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

import { visitPredicate } from "./predicate.js";
import { createWhereContext } from "./context.js";

/**
 * Visit WHERE operation
 * Produces WhereOperation with BooleanExpression predicate
 */
export function visitWhereOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>
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

  // Create WHERE-specific context
  const context = createWhereContext(tableParams, queryParams);

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const firstParam = lambda.params[0];
    if (firstParam && firstParam.type === "Identifier") {
      const paramName = (firstParam as Identifier).name;
      context.tableParams.add(paramName);
    }
  }

  // Extract body expression
  let bodyExpr: ASTExpression | null = null;
  if (lambda.body.type === "BlockStatement") {
    // Look for return statement
    const returnStmt = lambda.body.body.find(
      (stmt: unknown) => (stmt as { type?: string }).type === "ReturnStatement"
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
  const predicate = visitPredicate(bodyExpr, context);

  if (!predicate) {
    return null;
  }

  return {
    operation: {
      type: "queryOperation",
      operationType: "where",
      source,
      predicate: predicate as BooleanExpression,
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}