/**
 * ORDER BY and THEN BY operation visitors
 * Handles orderBy, orderByDescending, thenBy, thenByDescending
 */

import type {
  OrderByOperation,
  ThenByOperation,
  QueryOperation,
} from "../../query-tree/operations.js";
import type { ValueExpression, ColumnExpression } from "../../expressions/expression.js";
import type {
  CallExpression as ASTCallExpression,
  ArrowFunctionExpression,
  Expression as ASTExpression,
} from "../../parser/ast-types.js";

import { createOrderByContext } from "./context.js";
import { visitKeySelector } from "./key-selector.js";

/**
 * Visit ORDER BY operation
 * Handles both orderBy and orderByDescending
 */
export function visitOrderByOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>,
  methodName: string
): { operation: OrderByOperation; autoParams: Record<string, unknown> } | null {
  // ORDER BY expects a lambda: orderBy(x => x.name)
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const lambdaArg = ast.arguments[0];
  if (!lambdaArg || lambdaArg.type !== "ArrowFunctionExpression") {
    return null;
  }

  const lambda = lambdaArg as ArrowFunctionExpression;

  // Create ORDER BY context
  const context = createOrderByContext(tableParams, queryParams);

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const paramName = lambda.params[0].name;
    context.tableParams.add(paramName);
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

  // Visit key selector expression
  const keySelector = visitKeySelector(bodyExpr, context);

  if (!keySelector) {
    return null;
  }

  // For simple columns, use string name; for expressions, use full expression
  const selector = keySelector.type === "column"
    ? (keySelector as ColumnExpression).name
    : (keySelector as ValueExpression);

  return {
    operation: {
      type: "queryOperation",
      operationType: "orderBy",
      source,
      keySelector: selector,
      descending: methodName === "orderByDescending",
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}

/**
 * Visit THEN BY operation
 * Handles both thenBy and thenByDescending
 */
export function visitThenByOperation(
  ast: ASTCallExpression,
  source: QueryOperation,
  tableParams: Set<string>,
  queryParams: Set<string>,
  methodName: string
): { operation: ThenByOperation; autoParams: Record<string, unknown> } | null {
  // THEN BY expects a lambda: thenBy(x => x.age)
  if (!ast.arguments || ast.arguments.length === 0) {
    return null;
  }

  const lambdaArg = ast.arguments[0];
  if (!lambdaArg || lambdaArg.type !== "ArrowFunctionExpression") {
    return null;
  }

  const lambda = lambdaArg as ArrowFunctionExpression;

  // Create ORDER BY context (same as orderBy)
  const context = createOrderByContext(tableParams, queryParams);

  // Add lambda parameter to context
  if (lambda.params && lambda.params.length > 0) {
    const paramName = lambda.params[0].name;
    context.tableParams.add(paramName);
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

  // Visit key selector expression
  const keySelector = visitKeySelector(bodyExpr, context);

  if (!keySelector) {
    return null;
  }

  // For simple columns, use string name; for expressions, use full expression
  const selector = keySelector.type === "column"
    ? (keySelector as ColumnExpression).name
    : (keySelector as ValueExpression);

  return {
    operation: {
      type: "queryOperation",
      operationType: "thenBy",
      source,
      keySelector: selector,
      descending: methodName === "thenByDescending",
    },
    autoParams: Object.fromEntries(context.autoParams),
  };
}